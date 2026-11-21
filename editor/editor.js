const $ = selector => document.querySelector(selector);
let session, current, savedDraft, previewTimer, previewVersion = 0, busy = false, publishTimer;
const status = message => { $('#status').textContent = message; };
async function api(path, body) {
    const response = await fetch(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf }, body: JSON.stringify(body) });
    const data = await response.json();
    if (response.status === 401) { $('#login').hidden = false; $('#logout').hidden = true; }
    if (!response.ok) throw new Error(data.error || '请求失败');
    return data;
}
function syncMetadata() {
    const header = $('#source').value.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    for (const field of ['title', 'date', 'tag']) {
        $(`#meta-${field}`).value = header?.[1].match(new RegExp(`^${field}:[ \t]*(.*)$`, 'm'))?.[1] || '';
        $(`#meta-${field}`).disabled = !header || busy;
    }
}
for (const field of ['title', 'date', 'tag']) $(`#meta-${field}`).addEventListener('input', () => {
    const source = $('#source').value;
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    if (!match) return;
    const value = $(`#meta-${field}`).value.replace(/[\r\n]/g, ' ');
    const pattern = new RegExp(`^${field}:.*$`, 'm');
    const header = pattern.test(match[1]) ? match[1].replace(pattern, () => `${field}: ${value}`) : `${match[1]}\n${field}: ${value}`;
    $('#source').value = `---\n${header}\n---\n${source.slice(match[0].length)}`;
    $('#review-panel').hidden = true; $('#draft-status').textContent = '有未保存修改';
    clearTimeout(previewTimer); previewTimer = setTimeout(preview, 350);
});
const key = () => `journal-draft:${session.repository}:${session.branch}:${current.path}`;
function saveDraft() {
    if (!current || busy) return;
    try {
        if ($('#source').value === current.content) { localStorage.removeItem(key()); return; }
        const draft = { content: $('#source').value, sha: current.sha, saved: new Date().toISOString() };
        localStorage.setItem(key(), JSON.stringify(draft));
        $('#draft-status').textContent = `草稿已保存于 ${new Date(draft.saved).toLocaleTimeString()}`;
    } catch { $('#draft-status').textContent = '草稿保存失败，请复制内容备份。'; }
}
async function preview() {
    const version = ++previewVersion;
    try { const result = await api('/api/preview', { content: $('#source').value }); if (version === previewVersion) $('#preview').innerHTML = result.html; }
    catch (error) { if (version === previewVersion) status(error.message); }
}
async function load(path) {
    if (busy) return;
    saveDraft();
    const previous = current;
    busy = true; $('#files').disabled = true; $('#source').disabled = true; $('#review').disabled = true;
    try {
        const next = await api(`/api/file?path=${encodeURIComponent(path)}`);
        current = next; $('#source').value = current.content; $('#files').value = path;
        $('#review-panel').hidden = true; $('#restore').hidden = true; savedDraft = null;
        try { savedDraft = JSON.parse(localStorage.getItem(key())); } catch {}
        $('#restore').hidden = !savedDraft || savedDraft.content === current.content;
        $('#draft-status').textContent = savedDraft && savedDraft.content !== current.content ? (savedDraft.sha === current.sha ? '发现本地草稿，可点击恢复。' : '发现旧版本草稿，恢复后请与最新仓库内容合并。') : '';
        status(`正在编辑 ${path}`); await preview();
    } catch (error) { if (previous) $('#files').value = previous.path; status(error.message); }
    finally { busy = false; $('#files').disabled = false; $('#source').disabled = false; $('#review').disabled = !current; syncMetadata(); }
}
$('#source').addEventListener('input', () => { syncMetadata(); $('#review-panel').hidden = true; $('#draft-status').textContent = '有未保存修改'; clearTimeout(previewTimer); previewTimer = setTimeout(preview, 350); });
$('#files').onchange = () => load($('#files').value);
$('#reload').onclick = () => { if (current) return load(current.path); };
$('#restore').onclick = () => { $('#source').value = savedDraft.content; $('#restore').hidden = true; syncMetadata(); preview(); };
$('#review').onclick = () => { saveDraft(); $('#before').textContent = current.content; $('#after').textContent = $('#source').value; $('#review-panel').hidden = false; };
$('#cancel').onclick = () => { $('#review-panel').hidden = true; };
$('#commit').onclick = async () => {
    saveDraft(); busy = true;
    for (const selector of ['#source', '#files', '#reload', '#restore', '#review', '#commit']) $(selector).disabled = true;
    syncMetadata();
    const content = $('#source').value;
    try {
        status('正在校验内容并提交…');
        const result = await api('/api/commit', { path: current.path, sha: current.sha, content });
        current = { ...current, sha: result.sha, content };
        try { localStorage.removeItem(key()); } catch {}
        $('#review-panel').hidden = true; $('#restore').hidden = true; $('#draft-status').textContent = '';
        status('已提交到 GitHub。');
        $('#run-link').href = result.url; $('#run-link').hidden = false;
        let attempts = 0;
        clearInterval(publishTimer);
        const poll = async () => {
            try {
                const resultStatus = await api(`/api/status?sha=${result.commit}`);
                if (resultStatus.url) $('#run-link').href = resultStatus.url;
                if (resultStatus.status === 'completed') {
                    clearInterval(publishTimer);
                    $('#publish-status').textContent = resultStatus.conclusion === 'success' ? '已发布，返回网站刷新即可查看。' : '发布未成功；提交已保存，请查看 GitHub 日志。';
                } else $('#publish-status').textContent = '发布中，正在等待 GitHub Actions…';
            } catch (error) { $('#publish-status').textContent = `提交已保存，暂时无法查询发布状态：${error.message}`; }
            if (++attempts >= 60) { clearInterval(publishTimer); $('#publish-status').textContent = '提交已保存，请通过 GitHub 详情查看最终发布状态。'; }
        };
        publishTimer = setInterval(poll, 10000); await poll();
    } catch (error) { status(error.message); }
    finally { busy = false; for (const selector of ['#source', '#files', '#reload', '#restore', '#review', '#commit']) $(selector).disabled = false; syncMetadata(); }
};
$('#logout').onclick = async () => { saveDraft(); try { await api('/api/logout', {}); location.reload(); } catch (error) { status(error.message); } };
setInterval(saveDraft, 60000);
window.addEventListener('pagehide', saveDraft);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveDraft(); });
window.addEventListener('beforeunload', event => { if (current && $('#source').value !== current.content) { saveDraft(); event.preventDefault(); event.returnValue = ''; } });
try { const requested = new URLSearchParams(location.search).get('path'); if (requested) sessionStorage.setItem('journal-edit-path', requested); } catch {}
(async () => {
    try {
        session = await api('/api/session');
        $('#login').hidden = true; $('#logout').hidden = false; $('#workspace').hidden = false;
        $('#back').href = session.site; $('#back').hidden = false;
        const files = await api('/api/files');
        $('#files').replaceChildren(...files.map(path => { const option = document.createElement('option'); option.value = path; option.textContent = path; return option; }));
        let requested = new URLSearchParams(location.search).get('path');
        try { requested ||= sessionStorage.getItem('journal-edit-path'); } catch {}
        const path = files.includes(requested) ? requested : files[0];
        if (path) await load(path); else status('没有可编辑的文件。');
    } catch (error) { status(error.message); }
})();
