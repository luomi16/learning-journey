const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
try { const saved = localStorage.getItem('journey-theme'); if (saved) document.documentElement.dataset.theme = saved; } catch {}
$('#theme').onclick = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('journey-theme', next); } catch {}
};
document.querySelectorAll('[data-task]').forEach(task => {
    const key = `journey-task-${task.dataset.task}`;
    try { task.checked = localStorage.getItem(key) === 'true'; } catch {}
    task.addEventListener('change', () => { try { localStorage.setItem(key, String(task.checked)); } catch {} });
});
if ($('#timeline')) {
    const views = {
        timeline: { title: 'The learning log', placeholder: 'Search logs…', unit: 'day' },
        papers: { title: 'Read papers', placeholder: 'Search papers or authors…', unit: 'paper' },
        notes: { title: 'Notes', placeholder: 'Search notes…', unit: 'note' },
        knowledge: { title: 'Knowledges', placeholder: 'Search knowledge…', unit: 'page' }
    };
    const selectedView = () => Object.hasOwn(views, location.hash.slice(1)) ? location.hash.slice(1) : 'timeline';
    let view = selectedView(), entries = [], library = { papers: [], notes: [], knowledge: [] }, loaded = false, failed = false;
    const text = html => html.replace(/<[^>]*>/g, ' ');
    const matches = (query, ...values) => values.join(' ').toLowerCase().includes(query);
    const missing = '<span class="missing">Not recorded</span>';
    const dateLabel = value => /^\d{4}-\d{2}-\d{2}$/.test(value) ? `<time datetime="${esc(value)}">${esc(value)}</time>` : esc(value);
    function dateMarker(value) {
        if (!value) return '<div class="date undated-date"><span>Undated</span></div>';
        const date = new Date(`${value}T12:00:00`);
        return `<div class="date"><time datetime="${esc(value)}">${date.toLocaleDateString('en-US', {month: 'short'}).toUpperCase()}<strong>${date.getDate()}</strong><small>${date.getFullYear()}</small></time></div>`;
    }
    function timeline(entries) {
        return entries.map(entry => {
            const category = entry.categories.length === 1 ? entry.categories[0] : 'Learning';
            const papers = entry.papers.map(paper => `<div class="paper-block"><div class="section"><h4>Paper</h4><p><a href="${esc(paper.url)}" target="_blank" rel="noopener noreferrer">${esc(paper.title)}</a></p></div><div class="section"><h4>Takeaways</h4>${paper.takeaways}</div></div>`).join('');
            return `<article class="entry ${esc(category.toLowerCase())}">${dateMarker(entry.date)}<div class="line"><span></span></div><div class="card"><h3>${esc(entry.title)}</h3>${papers}<div class="section day-outputs"><h4>Outputs</h4>${entry.outputs}</div><div class="card-foot"><span>Read. Reflect. Connect.</span><span class="ribbon" aria-hidden="true">୨୧</span></div></div></article>`;
        }).join('');
    }
    function groupReadings(items) {
        const dates = new Map();
        for (const paper of items) {
            for (const date of new Set(paper.readDates)) {
                if (!dates.has(date)) dates.set(date, []);
                dates.get(date).push(paper);
            }
        }
        return [...dates].sort(([a], [b]) => b.localeCompare(a)).map(([date, papers]) => ({ date, papers }));
    }
    function papers(days) {
        return days.map(day => {
            const readings = day.papers.map(paper => `<article class="reading-paper"><h3><a href="${esc(paper.url)}" target="_blank" rel="noopener noreferrer">${esc(paper.title)}</a></h3><dl class="paper-facts"><div><dt>Authors</dt><dd>${paper.authors ? esc(paper.authors) : missing}</dd></div><div><dt>Published</dt><dd>${paper.published ? dateLabel(paper.published) : missing}</dd></div><div><dt>Links</dt><dd class="paper-links">${paper.links.map((link, i) => `<a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(i === 0 ? 'Paper' : link.label)} ↗</a>`).join('')}</dd></div></dl></article>`).join('');
            return `<article class="entry papers-entry">${dateMarker(day.date)}<div class="line"><span></span></div><div class="card paper-day-card">${readings}</div></article>`;
        }).join('');
    }
    function documents(items) {
        const groups = new Map();
        for (const item of items) {
            const date = item.date || '';
            if (!groups.has(date)) groups.set(date, []);
            groups.get(date).push(item);
        }
        return [...groups].sort(([a], [b]) => b.localeCompare(a)).map(([date, documents]) => {
            const rows = documents.sort((a, b) => a.title.localeCompare(b.title)).map(item => `<article class="document-row"><div><h3><a href="${esc(item.url)}">${esc(item.title)}</a></h3></div><a class="open-document" href="${esc(item.url)}" aria-label="Open ${esc(item.title)}">Open →</a></article>`).join('');
            return `<article class="entry documents-entry">${dateMarker(date)}<div class="line"><span></span></div><div class="card document-day-card">${rows}</div></article>`;
        }).join('');
    }
    function render() {
        const settings = views[view];
        document.querySelectorAll('[data-view]').forEach(button => {
            button.classList.toggle('active', button.dataset.view === view);
            button.setAttribute('aria-pressed', String(button.dataset.view === view));
        });
        $('#view-title').textContent = settings.title;
        $('#year').textContent = view === 'timeline' ? entries[0]?.date.slice(0, 4) || '' : '';
        $('#search').placeholder = settings.placeholder;
        $('#search').setAttribute('aria-label', `Search ${view}`);
        if (!loaded) {
            $('#result-count').textContent = '';
            $('#timeline').innerHTML = failed ? '<p class="empty">Could not load the journal. Please refresh to try again.</p>' : '<p>Loading the journal…</p>';
            return;
        }
        const query = $('#search').value.toLowerCase().trim();
        let shown;
        if (view === 'timeline') {
            shown = entries.filter(entry => matches(query, entry.title, entry.tag, entry.date, entry.papers.map(paper => `${paper.title} ${text(paper.takeaways)}`).join(' ')));
        } else if (view === 'papers') {
            shown = groupReadings(library.papers).map(day => ({ ...day, papers: day.papers.filter(paper => matches(query, paper.title, paper.authors, paper.published, day.date)) })).filter(day => day.papers.length);
        } else {
            shown = library[view].filter(item => matches(query, item.title, item.date, item.tag, item.searchText));
        }
        if (view === 'papers') {
            const count = new Set(shown.flatMap(day => day.papers.map(paper => paper.url))).size;
            $('#result-count').textContent = `${count} ${count === 1 ? 'paper' : 'papers'} · ${shown.length} ${shown.length === 1 ? 'day' : 'days'} · newest first`;
        } else {
            $('#result-count').textContent = `${shown.length} ${settings.unit}${shown.length === 1 ? '' : 's'} · newest first`;
        }
        $('#timeline').innerHTML = shown.length ? (view === 'timeline' ? timeline(shown) : view === 'papers' ? papers(shown) : documents(shown)) : `<div class="empty"><p>${query ? 'No matching results.' : `No ${settings.unit}s yet.`}</p>${query ? '<button id="reset">Clear search</button>' : ''}</div>`;
        if ($('#reset')) $('#reset').onclick = () => { $('#search').value = ''; render(); };
    }
    function changeView() {
        view = selectedView();
        $('#search').value = '';
        render();
    }
    document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => {
        const hash = `#${button.dataset.view}`;
        if (location.hash !== hash) location.hash = hash;
    });
    window.addEventListener('hashchange', changeView);
    $('#search').addEventListener('input', render);
    document.addEventListener('keydown', event => {
        if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); $('#search').focus(); }
        if (event.key === 'Escape') $('#search').blur();
    });
    render();
    Promise.all(['entries.json', 'library.json'].map(path => fetch(`./${path}`).then(response => {
        if (!response.ok) throw new Error('Load failed');
        return response.json();
    }))).then(([days, catalog]) => { entries = days; library = catalog; loaded = true; render(); }).catch(() => { failed = true; loaded = false; render(); });
}
