import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const buildScript = fileURLToPath(new URL('./build.mjs', import.meta.url));
async function fixture(t) {
    const directory = await mkdtemp(join(tmpdir(), 'journal-build-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    for (const name of ['content', 'notes', 'knowledge']) await mkdir(join(directory, name));
    for (const name of ['index.html', 'style.css', 'app.js']) await copyFile(new URL(`../${name}`, import.meta.url), join(directory, name));
    await writeFile(join(directory, 'content/day.md'), '---\ntitle: Example day\ndate: 2026-11-20\ncategory: Research\n---\n#### Paper\n[Example paper](https://example.com/paper)\n\n#### Takeaways\n- Connect a [concept](knowledge/concept).\n\n#### Outputs\n[A note](notes/detail)');
    await writeFile(join(directory, 'notes/detail.md'), '---\ntitle: Detailed note\n---\n## Idea\n[Concept](knowledge/concept)');
    await writeFile(join(directory, 'knowledge/concept.md'), '---\ntitle: Concept\n---\n## Definition\nAn explanation.');
    return directory;
}
function build(directory) {
    execFileSync(process.execPath, [buildScript], { cwd: directory, stdio: 'pipe' });
}
async function assets(directory) {
    const files = await readdir(join(directory, 'dist'));
    return Object.fromEntries(['style', 'app', 'entries', 'library'].map(name => [name, files.find(file => new RegExp(`^${name}\\.[a-f0-9]{12}\\.`).test(file))]));
}

test('root and nested pages share content-addressed CSS, JS and data', async t => {
    const directory = await fixture(t);
    build(directory);
    const versions = await assets(directory);
    for (const [name, filename] of Object.entries(versions)) {
        assert(filename, `Missing versioned ${name}`);
        const content = await readFile(join(directory, 'dist', filename));
        assert(filename.includes(createHash('sha256').update(content).digest('hex').slice(0, 12)));
    }
    for (const filename of ['index.html', 'notes/detail.html', 'knowledge/concept.html']) {
        const html = await readFile(join(directory, 'dist', filename), 'utf8');
        const prefix = filename.includes('/') ? '../' : './';
        assert(html.includes(`href="${prefix}${versions.style}"`));
        assert(html.includes(`src="${prefix}${versions.app}"`));
        assert(!html.includes('href="./style.css"') && !html.includes('src="../app.js"'));
        assert.equal(resolve(directory, 'dist', filename, '..', prefix, versions.style), resolve(directory, 'dist', versions.style));
    }
    const app = await readFile(join(directory, 'dist', versions.app), 'utf8');
    assert(app.includes(`'${versions.entries}'`) && app.includes(`'${versions.library}'`));
    assert(!app.includes("'entries.json'") && !app.includes("'library.json'"));
    build(directory);
    assert.deepEqual(await assets(directory), versions, 'Identical content must keep identical URLs');
});

test('data-only and CSS-only changes invalidate the right URLs and remove obsolete assets', async t => {
    const directory = await fixture(t);
    build(directory);
    const before = await assets(directory);
    await writeFile(join(directory, 'dist', 'unrelated.txt'), 'Keep this file.');
    await writeFile(join(directory, 'knowledge/concept.md'), '---\ntitle: Concept\n---\n## Definition\nA revised explanation.');
    build(directory);
    const afterData = await assets(directory);
    assert.notEqual(afterData.library, before.library);
    assert.notEqual(afterData.app, before.app, 'JS must reference the updated JSON filename');
    assert.equal(afterData.style, before.style);
    assert.equal(afterData.entries, before.entries);
    let files = await readdir(join(directory, 'dist'));
    assert(!files.includes(before.library) && !files.includes(before.app));
    assert(files.includes('unrelated.txt'));
    await writeFile(join(directory, 'style.css'), 'body { color: #333; background: pink; }');
    build(directory);
    const afterStyle = await assets(directory);
    assert.notEqual(afterStyle.style, afterData.style);
    assert.equal(afterStyle.app, afterData.app);
    files = await readdir(join(directory, 'dist'));
    assert(!files.includes(afterData.style));
    for (const page of ['index.html', 'notes/detail.html', 'knowledge/concept.html']) {
        assert((await readFile(join(directory, 'dist', page), 'utf8')).includes(afterStyle.style));
    }
});
