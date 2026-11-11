import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const clients = new Set();
let refreshTimer;
watch(root, { recursive: true }, (_, filename) => {
  if (!filename || filename.startsWith('.git')) return;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => { for (const client of clients) client.write('data: reload\n\n'); }, 150);
});
const mime = { '.html':'text/html; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.css':'text/css', '.js':'text/javascript' };
const liveReload = '<script>new EventSource("/__reload").onmessage=()=>location.reload();</script>';
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/__reload') {
      res.writeHead(200, { 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache', 'Connection':'keep-alive' });
      res.write(': connected\n\n'); clients.add(res); req.on('close', () => clients.delete(res)); return;
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    if (relative.split('/').some(part => part.startsWith('.'))) { res.writeHead(403); res.end(); return; }
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    if (!(await stat(target)).isFile()) { res.writeHead(404); res.end(); return; }
    const ext = path.extname(target);
    let body = await readFile(target);
    if (ext === '.html') body = Buffer.from(body.toString().replace('</body>', liveReload + '</body>'));
    res.writeHead(200, { 'Content-Type':mime[ext] || 'application/octet-stream', 'Cache-Control':'no-store' }); res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
