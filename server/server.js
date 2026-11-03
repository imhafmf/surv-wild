// Server Survival Wilderness (tahap 2): file game + akun + simpan data + multiplayer (WebSocket /ws).
// Node.js 18+. Paket: ws (wajib), pg (hanya bila DATABASE_URL diisi).
//   node server.js
// Env: PORT (3000), DATA_DIR (./data), DATABASE_URL (PostgreSQL, agar data tahan restart),
//      TRUST_PROXY=1 (di belakang proxy/Render), HOST (0.0.0.0), MAX_USERS (300)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Store = require('./store');
const Realtime = require('./realtime');

const PORT = +process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = fs.existsSync(path.join(__dirname, 'index.html')) ? __dirname : path.resolve(__dirname, '..');   // folder game (rata di deploy, atau satu tingkat di atas server/)
const DATA = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const MAX_USERS = +process.env.MAX_USERS || 300;
const store = Store.create({ dataDir: DATA, databaseUrl: process.env.DATABASE_URL || '', log: console.log });

const MAX_BODY = 300 * 1024;
const SESSION_DAYS = 30;
const USER_RE = /^[a-z0-9_]{3,16}$/;

// ---------- util ----------
function ipOf(req) {
  if (TRUST_PROXY) { const f = req.headers['x-forwarded-for']; if (f) return String(f).split(',')[0].trim(); }
  return req.socket.remoteAddress || '?';
}

// ---------- sesi ----------
let sessions = {};
function saveSessions() { store.set('meta', 'sessions', sessions); }
function newSession(user) {
  const now = Date.now();
  for (const t in sessions) if (sessions[t].exp < now) delete sessions[t];
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = { user, exp: now + SESSION_DAYS * 86400000 };
  saveSessions();
  return token;
}
function authToken(tok) {
  if (!/^[0-9a-f]{64}$/.test(tok)) return null;
  const s = sessions[tok];
  if (!s || s.exp < Date.now()) return null;
  return s.user;
}
function authUser(req) {
  const m = /^Bearer ([0-9a-f]{64})$/.exec(req.headers['authorization'] || '');
  return m ? authToken(m[1]) : null;
}

// ---------- batas laju ----------
const fails = {};     // "ip|user" -> {n, until}
const regs = {};      // ip -> [waktu]
function locked(key) { const f = fails[key]; return f && f.until > Date.now(); }
function addFail(key) {
  const f = fails[key] || (fails[key] = { n: 0, until: 0 });
  f.n++;
  if (f.n >= 8) { f.until = Date.now() + 5 * 60000; f.n = 0; }
}
function regAllowed(ip) {
  const now = Date.now(), a = (regs[ip] || []).filter(t => now - t < 3600000);
  regs[ip] = a;
  if (a.length >= 5) return false;
  a.push(now);
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const k in fails) if (fails[k].until < now && fails[k].n === 0) delete fails[k];
  for (const k in regs) if (!regs[k].length) delete regs[k];
}, 600000).unref();

// ---------- akun ----------
function hashPass(pass, salt) {                 // async: tidak memblokir pemain lain yang sedang bermain
  return new Promise((res, rej) => crypto.scrypt(pass, salt, 32, (e, k) => e ? rej(e) : res(k.toString('hex'))));
}
function validCreds(b) {
  return b && typeof b.user === 'string' && typeof b.pass === 'string';
}

// ---------- validasi data simpan ----------
const num = v => typeof v === 'number' && isFinite(v);
function cleanSave(s) {
  if (!s || typeof s !== 'object' || s.ver !== 2) return null;
  if (!num(s.x) || !num(s.y) || Math.abs(s.x) > 1e6 || Math.abs(s.y) > 1e6) return null;
  if (!s.inv || typeof s.inv !== 'object') return null;
  for (const k in s.inv) if (!/^[a-z0-9]{1,16}$/.test(k) || !num(s.inv[k]) || s.inv[k] < 0 || s.inv[k] > 100000) return null;
  if (s.money !== undefined && (!num(s.money) || s.money < 0 || s.money > 1e9)) return null;
  for (const k of ['hp', 'hunger', 'thirst']) if (s[k] !== undefined && (!num(s[k]) || s[k] < -1 || s[k] > 101)) return null;
  return s;
}

// ---------- HTTP ----------
function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}
function readBody(req, cb) {
  let size = 0; const chunks = [];
  req.on('data', c => { size += c.length; if (size > MAX_BODY) { req.destroy(); return; } chunks.push(c); });
  req.on('end', () => { try { cb(null, JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { cb(e); } });
  req.on('error', () => {});
}

function api(req, res, url) {
  const route = req.method + ' ' + url;
  const ip = ipOf(req);
  if (route === 'GET /api/ping') return send(res, 200, { ok: true, v: 2, db: store.mode(), online: rt ? rt.clients.size : 0 });

  if (route === 'POST /api/register' || route === 'POST /api/login') {
    return readBody(req, async (err, b) => {
      if (err || !validCreds(b)) return send(res, 400, { error: 'Data tidak valid' });
      const user = b.user.trim().toLowerCase(), pass = b.pass;
      if (!USER_RE.test(user)) return send(res, 400, { error: 'Nama 3-16 karakter: huruf kecil, angka, _' });
      if (pass.length < 6 || pass.length > 64) return send(res, 400, { error: 'Sandi 6-64 karakter' });
      if (route === 'POST /api/register') {
        if (!regAllowed(ip)) return send(res, 429, { error: 'Terlalu banyak pendaftaran, coba lagi nanti' });
        if (store.has('users', user)) return send(res, 409, { error: 'Nama sudah dipakai' });
        if (store.count('users') >= MAX_USERS) return send(res, 403, { error: 'Server penuh' });
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = await hashPass(pass, salt);
        if (store.has('users', user)) return send(res, 409, { error: 'Nama sudah dipakai' });
        store.set('users', user, { user, salt, hash, created: Date.now() });
        return send(res, 200, { user, token: newSession(user) });
      }
      const key = ip + '|' + user;
      if (locked(key)) return send(res, 429, { error: 'Terlalu banyak percobaan, tunggu 5 menit' });
      const u = store.get('users', user);
      let good = false;
      if (u) {
        const a = Buffer.from(await hashPass(pass, u.salt), 'hex'), c = Buffer.from(u.hash, 'hex');
        good = a.length === c.length && crypto.timingSafeEqual(a, c);
      } else await hashPass(pass, 'x');                            // samakan waktu bila akun tidak ada
      if (!good) { addFail(key); return send(res, 401, { error: 'Nama atau sandi salah' }); }
      return send(res, 200, { user, token: newSession(user) });
    });
  }

  const user = authUser(req);
  if (!user) return send(res, 401, { error: 'Belum masuk' });

  if (route === 'GET /api/me') return send(res, 200, { user });
  if (route === 'POST /api/logout') {
    const m = /^Bearer ([0-9a-f]{64})$/.exec(req.headers['authorization']);
    delete sessions[m[1]]; saveSessions();
    return send(res, 200, { ok: true });
  }
  if (route === 'GET /api/save') {
    return send(res, 200, { save: store.get('saves', user), map: (store.get('maps', user) || {}).map || null });
  }
  if (route === 'PUT /api/save') {
    return readBody(req, (err, b) => {
      const s = err ? null : cleanSave(b);
      if (!s) return send(res, 400, { error: 'Data simpan ditolak' });
      s.savedAt = Date.now();
      store.set('saves', user, s);
      send(res, 200, { ok: true, savedAt: s.savedAt });
    });
  }
  if (route === 'PUT /api/map') {
    return readBody(req, (err, b) => {
      if (err || !b || typeof b.map !== 'string' || b.map.length > 250000 || !/^([a-z]\d{1,6})*$/.test(b.map)) return send(res, 400, { error: 'Peta ditolak' });
      store.set('maps', user, { map: b.map });
      send(res, 200, { ok: true });
    });
  }
  send(res, 404, { error: 'Tidak ditemukan' });
}

// ---------- berkas statis (hanya index.html, css/, js/) ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8' };
function serveStatic(req, res, urlPath) {
  let p = decodeURIComponent(urlPath);
  if (p === '/') p = '/index.html';
  if (!(p === '/index.html' || /^\/(css|js)\/[A-Za-z0-9_\/.-]+$/.test(p)) || p.includes('..')) { res.writeHead(404); return res.end('Tidak ditemukan'); }
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(404); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Tidak ditemukan'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  try {
    const url = req.url.split('?')[0];
    if (url.startsWith('/api/')) {                       // CORS: game boleh dibuka dari berkas lokal (Acode); token Bearer, bukan cookie
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    }
    if (url.startsWith('/api/')) return api(req, res, url);
    if (url === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
    if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
    serveStatic(req, res, url);
  } catch (e) {
    try { send(res, 500, { error: 'Kesalahan server' }); } catch (e2) {}
  }
});
let rt = null;
async function start(port, host) {
  await store.init();
  sessions = store.get('meta', 'sessions') || {};
  rt = Realtime.attach(server, { store, authToken, log: console.log });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port === undefined ? PORT : port, host || HOST, resolve); });
  console.log('Survival Wilderness server di http://' + (host || HOST) + ':' + server.address().port + '  (penyimpanan: ' + store.mode() + ')');
  return server;
}
async function stop() { if (rt) rt.close(); await store.flush(); await new Promise(r => server.close(r)); }

if (require.main === module) {
  start().catch(e => { console.error('Gagal start:', e); process.exit(1); });
  const bye = async () => { try { await store.flush(); } catch (e) {} process.exit(0); };
  process.on('SIGTERM', bye); process.on('SIGINT', bye);
}
module.exports = { server, start, stop, store };
