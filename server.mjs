import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 3000);
const statsUrl = process.env.COINSMP_STATS_URL;
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon' };
const cache = { stats:{ body:null, at:0 }, events:{ body:null, at:0 } };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/stats' || url.pathname === '/api/events') {
    try {
      if (!statsUrl) throw new Error('Set COINSMP_STATS_URL on the server before starting the site');
      const endpoint = new URL(statsUrl);
      if (url.pathname === '/api/events') endpoint.pathname = endpoint.pathname.replace(/\/stats\/?$/, '/events');
      const entry = cache[url.pathname === '/api/events' ? 'events' : 'stats'];
      if (!entry.body || Date.now() - entry.at > 1500) {
        const upstream = await fetch(endpoint, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(7000) });
        if (!upstream.ok) throw new Error(`Upstream returned HTTP ${upstream.status}`);
        entry.body = await upstream.text(); JSON.parse(entry.body); entry.at = Date.now();
      }
      res.writeHead(200, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'access-control-allow-origin':'*' });
      res.end(entry.body);
    } catch (error) {
      res.writeHead(502, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' });
      res.end(JSON.stringify({ error:'Could not load The Coin SMP live stats' }));
    }
    return;
  }
  const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const publicFiles = new Set(['/index.html','/styles.css','/team-overrides.css','/app.js','/assets/coin-smp-logo.png']);
  if (!publicFiles.has(pathname)) { res.writeHead(404); res.end('Not found'); return; }
  const file = resolve(root, `.${pathname}`);
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403); res.end('Forbidden'); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type':types[extname(file)] || 'application/octet-stream', 'cache-control':extname(file)==='.html'?'no-cache':'public, max-age=3600' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type':'text/plain; charset=utf-8' }); res.end('Not found');
  }
});
server.listen(port, host, () => console.log(`The Coin SMP site is listening on http://${host}:${port}`));
