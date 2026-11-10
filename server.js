// Minimal static server for Railway. Optional password: set BASIC_USER and BASIC_PASS.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, 'public');
const user = process.env.BASIC_USER, pass = process.env.BASIC_PASS;
const types = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.js': 'text/javascript', '.ico': 'image/x-icon', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.mp4': 'video/mp4' };
http.createServer((req, res) => {
  if (user && pass) {
    const h = req.headers.authorization || '';
    const ok = h.startsWith('Basic ') && Buffer.from(h.slice(6), 'base64').toString() === `${user}:${pass}`;
    if (!ok) { res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Infinity Plus One preview"' }); return res.end('Password required'); }
  }
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/v2' || p === '/v2/' || p === '/v2/index.html') { res.writeHead(301, { Location: '/' }); return res.end(); }
  if (!path.extname(p)) p = (p.endsWith('/') ? p : p + '/') + 'index.html';
  if (!fs.existsSync(path.join(root, path.normalize(p)))) p = '/index.html';
  const file = path.join(root, path.normalize(p));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (path.extname(file) === '.mp4') {
    // Safari plays video only when the server answers Range requests.
    return fs.stat(file, (err, st) => {
      if (err) { res.writeHead(404); return res.end(); }
      const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
      const head = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=86400' };
      if (!m) { res.writeHead(200, { ...head, 'Content-Length': st.size }); return fs.createReadStream(file).pipe(res); }
      let a = m[1] === '' ? st.size - Number(m[2]) : Number(m[1]);
      let b = m[1] !== '' && m[2] !== '' ? Number(m[2]) : st.size - 1;
      if (a < 0) a = 0; if (b >= st.size) b = st.size - 1;
      if (a > b) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { ...head, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1 });
      fs.createReadStream(file, { start: a, end: b }).pipe(res);
    });
  }
  fs.readFile(file, (err, data) => {
    if (err) { fs.readFile(path.join(root, 'index.html'), (e2, d2) => { res.writeHead(200, { 'Content-Type': types['.html'] }); res.end(d2); }); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(process.env.PORT || 3000, () => console.log('listening on', process.env.PORT || 3000));
