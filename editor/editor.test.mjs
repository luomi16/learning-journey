import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('editor.js', import.meta.url), 'utf8');
const original = '---\ntitle: Concept\ndate: 2026-11-18\n---\nOriginal';
async function client() {
    const elements = new Map(), storage = new Map(), intervals = [], events = {};
    const element = id => {
        if (!elements.has(id)) elements.set(id, { value: '', hidden: false, disabled: false, textContent: '', innerHTML: '', listeners: {}, addEventListener(event, handler) { this.listeners[event] = handler; }, replaceChildren() {} });
        return elements.get(id);
    };
    const localStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
    const context = vm.createContext({
        document: { querySelector: element, createElement: () => ({}), addEventListener: (name, handler) => { events[name] = handler; } },
        window: { addEventListener: (name, handler) => { events[name] = handler; } },
        location: { search: '?path=knowledge%2Fconcept.md' }, URLSearchParams,
        localStorage, sessionStorage: localStorage, setInterval: (handler, delay) => { intervals.push({ handler, delay }); return intervals.length; }, clearInterval() {}, setTimeout() {}, clearTimeout() {},
        fetch: async path => {
            let result;
            if (path === '/api/session') result = { csrf: 'test', repository: 'owner/journal', branch: 'main', site: 'https://example.com' };
            else if (path === '/api/files') result = ['knowledge/concept.md'];
            else if (path.startsWith('/api/file?')) result = { path: 'knowledge/concept.md', sha: 'a'.repeat(40), content: original };
            else if (path === '/api/preview') result = { html: '<p>Preview</p>' };
            else if (path === '/api/commit') return { ok: false, status: 409, json: async () => ({ error: '仓库文件已改变' }) };
            else throw new Error(path);
            return { ok: true, status: 200, json: async () => result };
        }
    });
    vm.runInContext(source, context);
    await new Promise(resolve => setImmediate(resolve));
    return { element, storage, intervals, events };
}
test('drafts save changed text every minute and restore after reload without overwriting automatically', async () => {
    const c = await client();
    assert.equal(c.element('#source').value, original);
    assert.equal(c.element('#meta-title').value, 'Concept');
    const autoSave = c.intervals.find(item => item.delay === 60000).handler;
    autoSave(); assert.equal(c.storage.size, 1); // selected path only
    c.element('#source').value = original + '\nChanged';
    autoSave();
    const draftKey = 'journal-draft:owner/journal:main:knowledge/concept.md';
    assert.equal(JSON.parse(c.storage.get(draftKey)).content, original + '\nChanged');
    await c.element('#reload').onclick();
    assert.equal(c.element('#source').value, original);
    assert.equal(c.element('#restore').hidden, false);
    c.element('#restore').onclick();
    assert.equal(c.element('#source').value, original + '\nChanged');
});
test('conflict keeps local draft and edits available; metadata fields update front matter', async () => {
    const c = await client();
    c.element('#meta-title').value = 'Revised';
    c.element('#meta-title').listeners.input();
    assert.match(c.element('#source').value, /title: Revised/);
    c.element('#review').onclick();
    assert.equal(c.element('#before').textContent, original);
    assert.match(c.element('#after').textContent, /title: Revised/);
    await c.element('#commit').onclick();
    assert.equal(c.element('#status').textContent, '仓库文件已改变');
    assert.equal(c.element('#source').disabled, false);
    assert([...c.storage.keys()].some(key => key.startsWith('journal-draft:')));
});
