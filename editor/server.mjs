import http from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createMarkdown } from '../scripts/markdown.mjs';
const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
export const validPath = path => /^(content|notes|knowledge)\/[A-Za-z0-9_-]+\.md$/.test(path);
const id = () => randomBytes(32).toString('hex');
const fail = (status, message) => Object.assign(new Error(message), { status });
const markdown = createMarkdown();
export function createEditor(config, fetcher = fetch) {
    const origin = new URL(config.origin).origin;
    const sessions = new Map(), pending = new Map();
    const base = `/repos/${config.owner}/${config.repo}`;
    async function github(token, path, options = {}) {
        const response = await fetcher(`https://api.github.com${path}`, { ...options, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...options.headers }, signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw fail(response.status === 409 || response.status === 422 ? 409 : 502, `GitHub 请求失败 (${response.status})，请检查权限或文件版本。`);
        return response.json();
    }
    async function files(token) {
        const lists = await Promise.all(['content', 'notes', 'knowledge'].map(dir => github(token, `${base}/contents/${dir}?ref=${encodeURIComponent(config.branch)}`)));
        return lists.flat().filter(item => item.type === 'file' && validPath(item.path)).map(item => item.path).sort();
    }
    async function file(token, path) {
        const data = await github(token, `${base}/contents/${path}?ref=${encodeURIComponent(config.branch)}`);
        if (data.type !== 'file' || data.encoding !== 'base64') throw fail(400, '只支持普通 Markdown 文件。');
        return { path, sha: data.sha, content: Buffer.from(data.content, 'base64').toString('utf8') };
    }
    async function validate(token, path, content) {
        const paths = await files(token);
        if (!paths.includes(path)) throw fail(400, '只能编辑已有文件。');
        const documents = await Promise.all(paths.map(p => p === path ? { path, content } : file(token, p)));
        const directory = await mkdtemp(join(tmpdir(), 'journal-edit-'));
        try {
            for (const dir of ['content', 'notes', 'knowledge']) await mkdir(join(directory, dir));
            for (const doc of documents) await writeFile(join(directory, doc.path), doc.content);
            for (const name of ['index.html', 'style.css', 'app.js']) await writeFile(join(directory, name), await readFile(join(root, name)));
            await run(process.execPath, [join(root, 'scripts/build.mjs')], { cwd: directory, timeout: 30000 });
        } catch (error) { throw fail(400, `内容校验未通过：${error.stderr || error.message}`); }
        finally { await rm(directory, { recursive: true, force: true }); }
    }
    return http.createServer(async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
        const json = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
        const redirect = location => { res.writeHead(302, { Location: location }); res.end(); };
        const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(v => v.trim().split('=')));
        const cookie = (name, value, age) => `${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${origin.startsWith('https:') ? '; Secure' : ''}`;
        try {
            const url = new URL(req.url, origin);
            const now = Date.now();
            for (const [key, value] of sessions) if (value.expires < now) sessions.delete(key);
            for (const [key, value] of pending) if (value.expires < now) pending.delete(key);
            if (req.method === 'GET' && url.pathname === '/auth/login') {
                const state = id(), verifier = id();
                pending.set(state, { verifier, expires: now + 600000 });
                res.setHeader('Set-Cookie', cookie('oauth_state', state, 600));
                const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: `${origin}/auth/callback`, scope: 'public_repo', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
                return redirect(`https://github.com/login/oauth/authorize?${params}`);
            }
            if (req.method === 'GET' && url.pathname === '/auth/callback') {
                const state = url.searchParams.get('state'), transaction = pending.get(state);
                if (!transaction || state !== cookies.oauth_state || !url.searchParams.get('code')) throw fail(403, '登录验证失败，请重新登录。');
                pending.delete(state);
                const exchange = await fetcher('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, code: url.searchParams.get('code'), redirect_uri: `${origin}/auth/callback`, code_verifier: transaction.verifier }), signal: AbortSignal.timeout(20000) });
                const auth = await exchange.json();
                if (!auth.access_token) throw fail(403, 'GitHub 授权失败。');
                const user = await github(auth.access_token, '/user');
                const repo = await github(auth.access_token, base);
                if (user.login.toLowerCase() !== config.allowedUser.toLowerCase() || !repo.permissions?.push) throw fail(403, '此账号没有编辑权限。');
                const sessionId = id();
                sessions.set(sessionId, { token: auth.access_token, csrf: id(), login: user.login, expires: now + 8 * 3600000 });
                res.setHeader('Set-Cookie', [cookie('journal_session', sessionId, 28800), cookie('oauth_state', '', 0)]);
                return redirect('/');
            }
            const staticFiles = { '/': ['index.html', 'text/html'], '/editor.js': ['editor.js', 'text/javascript'], '/editor.css': ['editor.css', 'text/css'], '/style.css': ['../style.css', 'text/css'] };
            if (req.method === 'GET' && staticFiles[url.pathname]) {
                const [name, type] = staticFiles[url.pathname];
                res.writeHead(200, { 'Content-Type': type });
                return res.end(await readFile(new URL(name, import.meta.url)));
            }
            const session = sessions.get(cookies.journal_session);
            if (!session) throw fail(401, '请先登录 GitHub。');
            if (req.method === 'POST') {
                if (req.headers.origin !== origin || req.headers['x-csrf-token'] !== session.csrf) throw fail(403, '请求验证失败。');
            }
            if (req.method === 'GET' && url.pathname === '/api/session') return json({ login: session.login, csrf: session.csrf, site: config.site, repository: `${config.owner}/${config.repo}`, branch: config.branch });
            if (req.method === 'GET' && url.pathname === '/api/files') return json(await files(session.token));
            if (req.method === 'GET' && url.pathname === '/api/file') {
                const path = url.searchParams.get('path');
                if (!validPath(path)) throw fail(400, '文件路径无效。');
                return json(await file(session.token, path));
            }
            if (req.method === 'GET' && url.pathname === '/api/status') {
                const sha = url.searchParams.get('sha');
                if (!/^[a-f0-9]{40}$/.test(sha || '')) throw fail(400, '提交版本无效。');
                const runs = await github(session.token, `${base}/actions/workflows/deploy.yml/runs?head_sha=${sha}&per_page=1`);
                const latest = runs.workflow_runs[0];
                return json(latest ? { status: latest.status, conclusion: latest.conclusion, url: latest.html_url } : { status: 'queued' });
            }
            if (req.method === 'POST' && url.pathname === '/api/logout') {
                sessions.delete(cookies.journal_session); res.setHeader('Set-Cookie', cookie('journal_session', '', 0)); return json({ ok: true });
            }
            if (req.method === 'POST' && ['/api/preview', '/api/commit'].includes(url.pathname)) {
                let body = '';
                for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 256000) throw fail(413, '文件过大。'); }
                let input; try { input = JSON.parse(body); } catch { throw fail(400, '请求格式无效。'); }
                if (typeof input.content !== 'string') throw fail(400, '缺少内容。');
                if (url.pathname === '/api/preview') return json({ html: markdown.render(input.content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')) });
                if (!validPath(input.path) || !/^[a-f0-9]{40}$/.test(input.sha || '')) throw fail(400, '文件或版本无效。');
                if (session.busy) throw fail(409, '上一次提交仍在处理中。');
                session.busy = true;
                try {
                    const current = await file(session.token, input.path);
                    if (current.sha !== input.sha) throw fail(409, '仓库文件已改变。请复制你的草稿，重新加载最新文件，再合并修改。');
                    if (current.content === input.content) throw fail(400, '内容没有变化。');
                    await validate(session.token, input.path, input.content);
                    const result = await github(session.token, `${base}/contents/${input.path}`, { method: 'PUT', body: JSON.stringify({ message: `Edit ${input.path} via journal editor`, content: Buffer.from(input.content).toString('base64'), sha: input.sha, branch: config.branch }) });
                    return json({ sha: result.content.sha, commit: result.commit.sha, url: result.commit.html_url });
                } finally { session.busy = false; }
            }
            throw fail(404, '页面不存在。');
        } catch (error) { json({ error: error.status ? error.message : '服务暂时不可用，请稍后重试。' }, error.status || 500); }
    });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const env = process.env;
    for (const key of ['EDITOR_ORIGIN', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_ALLOWED_USER', 'SITE_URL']) if (!env[key]) throw new Error(`Missing ${key}`);
    const server = createEditor({ origin: env.EDITOR_ORIGIN, clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET, allowedUser: env.GITHUB_ALLOWED_USER, owner: env.GITHUB_OWNER || 'luomi16', repo: env.GITHUB_REPO || 'learning-journey', branch: env.GITHUB_BRANCH || 'main', site: env.SITE_URL });
    server.listen(Number(env.PORT || 4174), '0.0.0.0', () => console.log('Journal editor started'));
}
