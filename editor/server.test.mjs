import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createEditor, validPath } from './server.mjs';
const sha = 'a'.repeat(40), commit = 'b'.repeat(40);
const document = '---\ntitle: Concept\ndate: 2026-11-18\n---\n## Idea\nOriginal.\n';
async function fixture(t) {
    let changed = false, writes = 0;
    const fake = async (url, options) => {
        const path = new URL(url).pathname;
        const reply = data => new Response(JSON.stringify(data), { status: 200 });
        if (path.endsWith('/access_token')) return reply({ access_token: 'test-token' });
        if (path === '/user') return reply({ login: 'owner' });
        if (path === '/repos/owner/journal') return reply({ permissions: { push: true } });
        if (path.endsWith('/contents/knowledge')) return reply([{ type: 'file', path: 'knowledge/concept.md' }]);
        if (/\/contents\/(notes|content)$/.test(path)) return reply([]);
        if (path.endsWith('/contents/knowledge/concept.md')) {
            if (options.method === 'PUT') { writes++; return reply({ content: { sha: commit }, commit: { sha: commit, html_url: 'https://github.com/owner/journal/commit/' + commit } }); }
            return reply({ type: 'file', encoding: 'base64', sha: changed ? commit : sha, content: Buffer.from(document).toString('base64') });
        }
        throw new Error('Unexpected request ' + path);
    };
    const server = createEditor({ origin: 'http://localhost', owner: 'owner', repo: 'journal', allowedUser: 'owner', clientId: 'test', clientSecret: 'test', branch: 'main', site: 'https://example.com' }, fake);
    const base = 'http://localhost';
    const request = async (url, options = {}) => new Promise((resolve, reject) => {
        const req = Readable.from(options.body ? [Buffer.from(options.body)] : []);
        req.url = new URL(url).pathname + new URL(url).search;
        req.method = options.method || 'GET';
        req.headers = Object.fromEntries(Object.entries(options.headers || {}).map(([key, value]) => [key.toLowerCase(), value]));
        const headers = new Headers();
        let status = 200;
        const res = {
            setHeader(name, value) { headers.delete(name); for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item); },
            writeHead(code, values = {}) { status = code; for (const [key, value] of Object.entries(values)) this.setHeader(key, value); },
            end(body) { resolve(new Response(body, { status, headers })); }
        };
        try { server.emit('request', req, res); } catch (error) { reject(error); }
    });
    const login = await request(base + '/auth/login', { redirect: 'manual' });
    const state = new URL(login.headers.get('location')).searchParams.get('state');
    const rejected = await request(base + '/auth/callback?code=test&state=bad', { redirect: 'manual' });
    assert.equal(rejected.status, 403);
    const callback = await request(base + `/auth/callback?code=test&state=${state}`, { headers: { Cookie: `oauth_state=${state}` }, redirect: 'manual' });
    assert.equal(callback.status, 302);
    const cookie = callback.headers.getSetCookie().find(value => value.startsWith('journal_session=')).split(';')[0];
    const session = await (await request(base + '/api/session', { headers: { Cookie: cookie } })).json();
    return { base, cookie, session, request, change: () => { changed = true; }, writes: () => writes, post: input => request(base + '/api/commit', { method: 'POST', headers: { Cookie: cookie, Origin: 'http://localhost', 'X-CSRF-Token': session.csrf }, body: JSON.stringify(input) }) };
}
test('editor limits paths to existing content file locations', () => {
    assert(validPath('knowledge/RL.md'));
    for (const path of ['../secret', 'knowledge/../app.md', '.github/workflows/a.md', 'notes/a/b.md']) assert(!validPath(path));
});
test('OAuth login, authentication and CSRF checks', async t => {
    const f = await fixture(t);
    assert.equal((await f.request(f.base + '/api/files')).status, 401);
    assert.equal((await f.request(f.base + '/api/commit', { method: 'POST', headers: { Cookie: f.cookie }, body: '{}' })).status, 403);
    assert.equal((await f.request(f.base + '/api/file?path=../secret', { headers: { Cookie: f.cookie } })).status, 400);
    assert.deepEqual(await (await f.request(f.base + '/api/files', { headers: { Cookie: f.cookie } })).json(), ['knowledge/concept.md']);
});
test('invalid metadata is rejected without writing to GitHub', async t => {
    const f = await fixture(t);
    const response = await f.post({ path: 'knowledge/concept.md', sha, content: 'Missing metadata' });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /missing front matter/);
    assert.equal(f.writes(), 0);
});
test('conflicting file versions cannot overwrite IDE changes', async t => {
    const f = await fixture(t); f.change();
    assert.equal((await f.post({ path: 'knowledge/concept.md', sha, content: document + 'Changed' })).status, 409);
    assert.equal(f.writes(), 0);
});
test('valid content is built before committing, preview escapes HTML and highlights Python', async t => {
    const f = await fixture(t);
    const response = await f.post({ path: 'knowledge/concept.md', sha, content: document + 'Changed' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).commit, commit);
    assert.equal(f.writes(), 1);
    const preview = await f.request(f.base + '/api/preview', { method: 'POST', headers: { Cookie: f.cookie, Origin: 'http://localhost', 'X-CSRF-Token': f.session.csrf }, body: JSON.stringify({ content: '<script>alert(1)</script>\n\n```python\ndef example():\n    return 1\n```' }) });
    const { html } = await preview.json();
    assert(!html.includes('<script>'));
    assert(html.includes('hljs-keyword'));
});
