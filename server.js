// Minimal static server for Railway. Optional password: set BASIC_USER and BASIC_PASS.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, 'public');
const user = process.env.BASIC_USER, pass = process.env.BASIC_PASS;
const types = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.js': 'text/javascript', '.ico': 'image/x-icon' };
http.createServer((req, res) => {
  if (user && pass) {
    const h = req.headers.authorization || '';
    const ok = h.startsWith('Basic ') && Buffer.from(h.slice(6), 'base64').toString() === `${user}:${pass}`;
    if (!ok) { res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Infinity Plus One preview"' }); return res.end('Password required'); }
  }
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (!path.extname(p)) p = (p.endsWith('/') ? p : p + '/') + 'index.html';
  if (!fs.existsSync(path.join(root, path.normalize(p)))) p = '/index.html';
  const file = path.join(root, path.normalize(p));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { fs.readFile(path.join(root, 'index.html'), (e2, d2) => { res.writeHead(200, { 'Content-Type': types['.html'] }); res.end(d2); }); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(process.env.PORT || 3000, () => console.log('listening on', process.env.PORT || 3000));
