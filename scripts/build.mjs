import { createHash } from 'node:crypto';
import { readdir, readFile, mkdir, copyFile, writeFile, unlink } from 'node:fs/promises';
import { createMarkdown } from './markdown.mjs';
const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function load(directory) {
    const files = await readdir(directory).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
    return Promise.all(files.filter(file => file.endsWith('.md')).map(async file => {
        const raw = await readFile(`${directory}/${file}`, 'utf8');
        const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
        if (!match) throw new Error(`${file}: missing front matter`);
        const meta = Object.fromEntries(match[1].split(/\r?\n/).map(line => {
            const i = line.indexOf(':');
            if (i < 1) throw new Error(`${file}: invalid metadata`);
            return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
        }));
        if (!meta.title) throw new Error(`${file}: missing title`);
        const slug = file.slice(0, -3);
        if (!/^[a-zA-Z0-9_-]+$/.test(slug)) throw new Error(`${file}: use letters, numbers, hyphens or underscores in filenames`);
        return { ...meta, slug, body: match[2], source: `${directory}/${file}` };
    }));
}
const entries = await load('content');
const notes = await load('notes');
const concepts = await load('knowledge');
function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
for (const document of [...notes, ...concepts]) {
    if (document.date && !validDate(document.date)) throw new Error(`${document.source}: date must be a valid YYYY-MM-DD date, or omitted`);
}
// Daily entries stay on the Timeline. Only files in notes/ create standalone Notes pages.
const targets = new Set([...notes.map(note => `notes/${note.slug}`), ...concepts.map(e => `knowledge/${e.slug}`)]);
const markdown = createMarkdown();
markdown.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
    const link = tokens[index];
    const href = link.attrGet('href');
    const [target, fragment] = href.split('#', 2);
    const page = target.replace(/\.md$/, '');
    if (/^(notes|knowledge)\//.test(page) && !page.endsWith('.html')) {
        if (!targets.has(page)) throw new Error(`Unknown internal link: ${href}`);
        link.attrSet('href', `../${page}.html${fragment ? '#' + fragment : ''}`);
    }
    if (/^https?:\/\//.test(href)) {
        link.attrSet('target', '_blank');
        link.attrSet('rel', 'noopener noreferrer');
    }
    return renderer.renderToken(tokens, index, options);
};
function inline(text, prefix = '.', labelLinkedPages = false) {
    // Treat code as literal text so instructional link examples do not become links.
    return escape(text).replace(/`([^`]+)`|\[([^\]]+)\]\(([^\s)]+)\)|\*\*([^*]+)\*\*/g, (_, code, label, escapedUrl, bold) => {
        if (code !== undefined) return `<code>${code}</code>`;
        if (bold !== undefined) return `<strong>${bold}</strong>`;
        if (/^https?:\/\//.test(escapedUrl)) return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
        const [target, fragment] = escapedUrl.replace(/\.md(?=#|$)/, '').split('#');
        if (!targets.has(target)) throw new Error(`Unknown internal link: ${escapedUrl}`);
        const tag = target.startsWith('notes/') ? 'Note' : target.startsWith('knowledge/') ? 'Knowledge' : '';
        return `<a href="${prefix}/${target}.html${fragment ? `#${fragment}` : ''}">${label}</a>${labelLinkedPages && tag ? `<span class="output-tag">${tag}</span>` : ''}`;
    });
}
function blocks(text, prefix, labelLinkedPages = false) {
    return text.trim().split(/\n\s*\n/).filter(Boolean).map(block => {
        const lines = block.split('\n');
        if (lines.every(line => /^- /.test(line))) return `<ul>${lines.map(line => `<li>${inline(line.slice(2), prefix, labelLinkedPages)}</li>`).join('')}</ul>`;
        return `<p>${inline(block, prefix, labelLinkedPages).replace(/\n/g, '<br>')}</p>`;
    }).join('');
}
function sections(body) {
    return body.trim().split(/^#{2,4} /m).filter(Boolean).map(part => {
        const [title, ...lines] = part.trim().split('\n');
        return { title, body: lines.join('\n').trim() };
    });
}
function paperLink(body, source) {
    const links = [...body.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)].map(match => ({ label: match[1], url: match[2] }));
    if (!links.length) throw new Error(`${source}: each Paper section needs a paper title and HTTP(S) link`);
    const authors = body.match(/^Authors:[ \t]*(.*)$/im)?.[1].trim() || '';
    const publishedValue = body.match(/^Published:[ \t]*(.*)$/im)?.[1].trim() || '';
    const published = publishedValue === 'YYYY-MM-DD' ? '' : publishedValue;
    return { title: links[0].label, url: links[0].url, authors, published, links };
}
for (const entry of entries) {
    if (!validDate(entry.date) || !['Research', 'Projects', 'Notes'].includes(entry.category)) throw new Error(`${entry.source}: invalid date or category`);
    entry.sections = sections(entry.body);
    entry.papers = [];
    entry.outputs = '';
    let currentPaper;
    for (const section of entry.sections) {
        if (/^paper$/i.test(section.title)) {
            currentPaper = { ...paperLink(section.body, entry.source), takeaways: '' };
            entry.papers.push(currentPaper);
        } else if (/^takeaways$/i.test(section.title)) {
            // Compatibility with older single-paper notes that use metadata for Paper.
            if (!currentPaper && entry.paper) {
                currentPaper = { title: entry.paperTitle || entry.title, url: entry.paper, authors: entry.authors || '', published: entry.published || '', links: [{ label: 'Paper', url: entry.paper }], takeaways: '' };
                entry.papers.push(currentPaper);
            }
            if (!currentPaper) throw new Error(`${entry.source}: put a Paper section before its Takeaways`);
            currentPaper.takeaways += blocks(section.body, '.');
        } else if (/^outputs?$/i.test(section.title)) {
            entry.outputs += blocks(section.body, '.', true);
        }
    }
    if (!entry.papers.length && entry.paper) entry.papers.push({ title: entry.paperTitle || entry.title, url: entry.paper, authors: entry.authors || '', published: entry.published || '', links: [{ label: 'Paper', url: entry.paper }], takeaways: '' });
    if (!entry.papers.length) throw new Error(`${entry.source}: add at least one Paper section`);
    for (const paper of entry.papers) {
        if (!/^https?:\/\//.test(paper.url)) throw new Error(`${entry.source}: invalid paper URL`);
        paper.takeaways ||= blocks(entry.takeaway || 'Notes in progress.', '.');
    }
}
entries.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
const grouped = new Map();
for (const entry of entries) {
    if (!grouped.has(entry.date)) grouped.set(entry.date, []);
    grouped.get(entry.date).push(entry);
}
const days = [...grouped].map(([date, documents]) => {
    const categories = [...new Set(documents.map(document => document.category))];
    const tags = [...new Set(documents.map(document => document.tag).filter(Boolean))];
    const title = documents.find(document => document.dayTitle)?.dayTitle || documents.find(document => document.papers.length > 1)?.title || (documents.length === 1 ? documents[0].title : 'A day of learning');
    const papers = documents.flatMap(document => document.papers);
    const outputs = documents.map(document => document.outputs).join('');
    return { date, title, categories, tag: tags.join(' · '), papers, outputs };
});
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'style.css', 'app.js']) await copyFile(file, `dist/${file}`);
for (const [directory, documents] of [['notes', notes], ['knowledge', concepts]]) {
    await mkdir(`dist/${directory}`, { recursive: true });
    // Removed source notes must not survive in the published output.
    const activePages = new Set(documents.map(document => `${document.slug}.html`));
    for (const file of await readdir(`dist/${directory}`)) {
        if (file.endsWith('.html') && !activePages.has(file)) await unlink(`dist/${directory}/${file}`);
    }
    for (const document of documents) {
        const content = `<div class="markdown-body">${markdown.render(document.body)}</div>`;
        await writeFile(`dist/${directory}/${document.slug}.html`, `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(document.title)} · Notes</title><link rel="stylesheet" href="../style.css"><script defer src="../app.js"></script></head>
<body><div class="shell"><header class="topbar"><a class="brand" href="../index.html">← Learning journal</a><button id="theme" aria-label="Switch color theme">☼</button></header><main class="reading-note">${document.date ? `<p class="note-date">${escape(document.date)}</p>` : ''}<h1>${escape(document.title)}<span class="heading-decoration" aria-hidden="true">୨୧</span></h1>${document.paper ? `<a class="paper-link" href="${escape(document.paper)}" target="_blank" rel="noopener noreferrer">Read paper ↗</a>` : ''}${content}</main></div></body></html>`);
    }
}
// The four views share the same source files; repeated reading dates belong to one paper.
const paperIndex = new Map();
for (const entry of entries) {
    for (const paper of entry.papers) {
        let record = paperIndex.get(paper.url);
        if (!record) {
            record = { title: paper.title, url: paper.url, authors: paper.authors, published: paper.published, links: [], readDates: [] };
            paperIndex.set(paper.url, record);
        }
        record.authors ||= paper.authors;
        record.published ||= paper.published;
        if (!record.readDates.includes(entry.date)) record.readDates.push(entry.date);
        for (const link of paper.links) if (!record.links.some(existing => existing.url === link.url)) record.links.push(link);
    }
}
function plainText(body) {
    return body.replace(/^#{2,4} .*$/gm, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*`]/g, '').replace(/\s+/g, ' ').trim();
}
function documentSummary(document, directory) {
    const text = plainText(document.body);
    return { title: document.title, date: document.date || '', tag: document.tag || '', url: `./${directory}/${document.slug}.html`, excerpt: text.slice(0, 150) + (text.length > 150 ? '…' : ''), searchText: text };
}
const sortDocuments = (a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title);
const library = {
    papers: [...paperIndex.values()].map(paper => ({ ...paper, readDates: paper.readDates.sort().reverse() })),
    notes: notes.map(document => documentSummary(document, 'notes')).sort(sortDocuments),
    knowledge: concepts.map(document => documentSummary(document, 'knowledge')).sort(sortDocuments)
};
await writeFile('dist/library.json', JSON.stringify(library));
await writeFile('dist/entries.json', JSON.stringify(days));
// Content-based URLs prevent a new page from reusing stale scripts, styles or data.
async function fingerprint(filename, content) {
    const hash = createHash('sha256').update(content).digest('hex').slice(0, 12);
    const versioned = filename.replace(/(\.[^.]+)$/, `.${hash}$1`);
    await writeFile(`dist/${versioned}`, content);
    return versioned;
}
const entriesAsset = await fingerprint('entries.json', JSON.stringify(days));
const libraryAsset = await fingerprint('library.json', JSON.stringify(library));
const appSource = (await readFile('app.js', 'utf8'))
    .replaceAll("'entries.json'", `'${entriesAsset}'`)
    .replaceAll("'library.json'", `'${libraryAsset}'`);
const appAsset = await fingerprint('app.js', appSource);
const styleAsset = await fingerprint('style.css', await readFile('style.css', 'utf8'));
// Keep the previous URLs working for tabs that still have an older HTML page.
await writeFile('dist/app.js', appSource);
const editorOrigin = process.env.EDITOR_URL ? new URL(process.env.EDITOR_URL).origin : '';
if (editorOrigin && !editorOrigin.startsWith('https://') && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(editorOrigin)) throw new Error('EDITOR_URL must use HTTPS');
const pages = ['dist/index.html', ...notes.map(document => `dist/notes/${document.slug}.html`), ...concepts.map(document => `dist/knowledge/${document.slug}.html`)];
for (const page of pages) {
    const sourcePath = page === 'dist/index.html' ? '' : page.replace(/^dist\//, '').replace(/\.html$/, '.md');
    const editControl = editorOrigin
        ? `<a class="edit-link" href="${escape(editorOrigin)}/?path=${encodeURIComponent(sourcePath)}">编辑</a>`
        : '<button class="edit-link" disabled title="请先配置编辑服务 EDITOR_URL">编辑</button>';
    const html = (await readFile(page, 'utf8'))
        .replace('<button id="theme"', `${editControl}<button id="theme"`)
        .replace(/(href=["'](?:\.\/|\.\.\/))style\.css(["'])/g, `$1${styleAsset}$2`)
        .replace(/(src=["'](?:\.\/|\.\.\/))app\.js(["'])/g, `$1${appAsset}$2`);
    await writeFile(page, html);
}
const currentAssets = new Set([entriesAsset, libraryAsset, appAsset, styleAsset]);
for (const file of await readdir('dist')) {
    if (/^(?:style|app|entries|library)\.[a-f0-9]{12}\.(?:css|js|json)$/.test(file) && !currentAssets.has(file)) await unlink(`dist/${file}`);
}
await writeFile('dist/.nojekyll', '');
console.log(`Built ${days.length} days, ${days.reduce((sum, day) => sum + day.papers.length, 0)} papers, and ${concepts.length} knowledge pages in dist/`);
