// Realtime (tahap 2): pemain saling terlihat, chat (lokal / global / bisik), perintah, teman, blokir.
// Server TIDAK mempercayai klien: posisi dicek kecepatannya, pesan dibatasi laju & panjang, semua teks dibersihkan.
'use strict';
let WebSocketServer;                                  // paket "ws" bila ada, kalau tidak pakai versi bawaan (tanpa npm)
try { if (process.env.WS_BUILTIN === '1') throw new Error('paksa bawaan'); WebSocketServer = require('ws').WebSocketServer; }
catch (e) { WebSocketServer = require('./wsmini').WebSocketServer; }

const TS = 16;
const WORLD_PX = 1000 * TS + 64;            // batas dunia (px)
const SPEED = 62;                           // px/detik (sama dengan klien)
const SEE_PX = 28 * TS;                     // jarak pemain terlihat
const LOCAL_PX = 15 * TS;                   // jarak chat lokal
const SNAP_MS = 250;
const MAX_FRIENDS = 50, MAX_PENDING = 20, MAX_BLOCK = 50;
const NAME_RE = /^[a-z0-9_]{3,16}$/;

function clean(s, max) {
  return String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
const num = v => typeof v === 'number' && isFinite(v);

function attach(server, ctx) {
  const { store, authToken, log } = ctx;
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 2048 });
  const clients = new Map();                // nama -> klien

  // ---------- sosial (teman, blokir) ----------
  function social(u) {
    let s = store.get('social', u);
    if (!s) s = { f: [], req: [], out: [], blk: [] };
    return s;
  }
  function saveSocial(u, s) { store.set('social', u, s); }
  const rm = (a, v) => { const i = a.indexOf(v); if (i >= 0) a.splice(i, 1); };

  function send(c, obj) { if (c && c.ws.readyState === 1) c.ws.send(JSON.stringify(obj)); }
  function sys(c, m) { send(c, { t: 'sys', m }); }
  function pushFriends(c) {
    const s = social(c.user);
    send(c, { t: 'friends', f: s.f.map(n => [n, clients.has(n) ? 1 : 0]), req: s.req, blk: s.blk });
  }
  function notifyFriends(user, text) {
    for (const n of social(user).f) { const c = clients.get(n); if (c) { sys(c, text); pushFriends(c); } }
  }

  // ---------- chat ----------
  function blocks(recipient, sender) { return social(recipient).blk.indexOf(sender) >= 0; }

  function allow(c, global) {
    const now = Date.now();
    c.chatT = (c.chatT || []).filter(t => now - t < 10000);
    if (c.chatT.length >= 5) { sys(c, 'Pelan-pelan, terlalu cepat mengirim pesan.'); return false; }
    if (global) {
      if (now - (c.lastGlobal || 0) < 8000) { sys(c, 'Chat global hanya boleh tiap 8 detik.'); return false; }
      c.lastGlobal = now;
    }
    c.chatT.push(now);
    return true;
  }

  function near(a, b) {
    if (a.cave !== b.cave) return false;
    if (a.cave && a.cid !== b.cid) return false;
    return Math.abs(a.x - b.x) <= LOCAL_PX && Math.abs(a.y - b.y) <= LOCAL_PX;
  }

  function sendLocal(c, ch, text) {
    if (!allow(c, false)) return;
    const msg = { t: 'chat', ch, from: c.user, m: text };
    for (const o of clients.values()) if ((o === c || (near(c, o) && !blocks(o.user, c.user)))) send(o, msg);
  }
  function sendGlobal(c, text) {
    if (!allow(c, true)) return;
    const msg = { t: 'chat', ch: 'g', from: c.user, m: text };
    for (const o of clients.values()) if (o === c || !blocks(o.user, c.user)) send(o, msg);
  }
  function whisper(c, to, text) {
    to = String(to || '').toLowerCase();
    const o = clients.get(to);
    if (!o || to === c.user) return sys(c, to === c.user ? 'Tidak bisa berbisik ke diri sendiri.' : to + ' tidak online.');
    if (!text) return sys(c, 'Format: /w nama pesan');
    if (!allow(c, false)) return;
    const msg = { t: 'chat', ch: 'w', from: c.user, to, m: text };
    send(c, msg);
    if (!blocks(o.user, c.user)) { send(o, msg); o.lastFrom = c.user; }
    c.lastTo = to;
  }

  const HELP = [
    'Perintah: /w nama pesan (bisik) · /r pesan (balas) · /g pesan (global) · /me aksi',
    '/teman (daftar) · /teman tambah|terima|tolak|hapus nama · /blok nama · /buka nama · /online',
    'Tanpa perintah = chat lokal (orang dalam 15 petak).'
  ];

  function friendCmd(c, args) {
    const s = social(c.user), sub = (args[0] || '').toLowerCase(), name = (args[1] || '').toLowerCase();
    if (!sub) {
      const on = s.f.filter(n => clients.has(n)), off = s.f.filter(n => !clients.has(n));
      sys(c, 'Teman online: ' + (on.join(', ') || '-') + ' · offline: ' + (off.join(', ') || '-'));
      if (s.req.length) sys(c, 'Permintaan masuk: ' + s.req.join(', ') + ' (/teman terima nama)');
      return pushFriends(c);
    }
    if (!NAME_RE.test(name)) return sys(c, 'Format: /teman ' + sub + ' nama');
    if (name === c.user) return sys(c, 'Itu kamu sendiri.');
    const o = clients.get(name);
    if (sub === 'tambah') {
      if (!store.has('users', name)) return sys(c, 'Pemain "' + name + '" tidak ada.');
      if (s.f.indexOf(name) >= 0) return sys(c, name + ' sudah temanmu.');
      if (blocks(name, c.user)) return sys(c, 'Permintaan terkirim.');       // jangan bocorkan blokir
      if (s.req.indexOf(name) >= 0) return friendCmd(c, ['terima', name]);   // dia sudah minta duluan
      const t = social(name);
      if (s.f.length >= MAX_FRIENDS) return sys(c, 'Daftar temanmu penuh (' + MAX_FRIENDS + ').');
      if (t.req.indexOf(c.user) >= 0) return sys(c, 'Permintaan sudah terkirim.');
      if (t.req.length >= MAX_PENDING) return sys(c, 'Permintaan terkirim.');
      t.req.push(c.user); saveSocial(name, t);
      if (o) { sys(o, c.user + ' ingin berteman. Ketik /teman terima ' + c.user); pushFriends(o); }
      return sys(c, 'Permintaan teman dikirim ke ' + name + '.');
    }
    if (sub === 'terima') {
      if (s.req.indexOf(name) < 0) return sys(c, 'Tidak ada permintaan dari ' + name + '.');
      if (s.f.length >= MAX_FRIENDS) return sys(c, 'Daftar temanmu penuh.');
      rm(s.req, name); if (s.f.indexOf(name) < 0) s.f.push(name); saveSocial(c.user, s);
      const t = social(name); rm(t.req, c.user); if (t.f.indexOf(c.user) < 0 && t.f.length < MAX_FRIENDS) t.f.push(c.user); saveSocial(name, t);
      sys(c, 'Kamu dan ' + name + ' sekarang berteman.'); pushFriends(c);
      if (o) { sys(o, c.user + ' menerima pertemananmu.'); pushFriends(o); }
      return;
    }
    if (sub === 'tolak') { rm(s.req, name); saveSocial(c.user, s); sys(c, 'Permintaan dari ' + name + ' ditolak.'); return pushFriends(c); }
    if (sub === 'hapus') {
      rm(s.f, name); saveSocial(c.user, s);
      const t = social(name); rm(t.f, c.user); saveSocial(name, t);
      sys(c, name + ' dihapus dari teman.'); pushFriends(c); if (o) pushFriends(o);
      return;
    }
    sys(c, 'Perintah /teman: tambah, terima, tolak, hapus');
  }

  function command(c, text) {
    const parts = text.slice(1).split(' ');
    const cmd = (parts.shift() || '').toLowerCase(), rest = parts.join(' ').trim();
    switch (cmd) {
      case 'help': case 'bantuan': case '?': return HELP.forEach(l => sys(c, l));
      case 'w': case 'msg': case 'bisik': { const i = rest.indexOf(' '); return whisper(c, i < 0 ? rest : rest.slice(0, i), i < 0 ? '' : rest.slice(i + 1).trim()); }
      case 'r': if (!c.lastFrom) return sys(c, 'Tidak ada yang bisa dibalas.'); return whisper(c, c.lastFrom, rest);
      case 'g': if (!rest) return sys(c, 'Format: /g pesan'); return sendGlobal(c, rest);
      case 'me': if (!rest) return; return sendLocal(c, 'e', rest);
      case 'teman': case 'friend': return friendCmd(c, parts.filter(Boolean));
      case 'blok': case 'block': {
        const s = social(c.user), n = rest.toLowerCase();
        if (!n) return sys(c, 'Diblokir: ' + (s.blk.join(', ') || '-'));
        if (!NAME_RE.test(n) || n === c.user) return sys(c, 'Nama tidak valid.');
        if (s.blk.length >= MAX_BLOCK) return sys(c, 'Daftar blokir penuh.');
        if (s.blk.indexOf(n) < 0) s.blk.push(n);
        rm(s.f, n); rm(s.req, n); saveSocial(c.user, s);
        return sys(c, n + ' diblokir. Pesannya tidak akan kamu terima.');
      }
      case 'buka': case 'unblock': {
        const s = social(c.user), n = rest.toLowerCase();
        rm(s.blk, n); saveSocial(c.user, s); return sys(c, n + ' tidak diblokir lagi.');
      }
      case 'online': return sys(c, clients.size + ' pemain online.');
      default: return sys(c, 'Perintah tidak dikenal. Ketik /help');
    }
  }

  function onChat(c, raw) {
    const text = clean(raw, 100);
    if (!text) return;
    if (text[0] === '/') return command(c, text);
    sendLocal(c, 'l', text);
  }

  // ---------- posisi ----------
  function onPos(c, m, now) {
    if (!num(m.x) || !num(m.y) || Math.abs(m.x) > WORLD_PX || Math.abs(m.y) > WORLD_PX) return;
    if (now - c.posAt < 70) return;                              // maks ~14 pesan/detik
    const cave = !!m.c, cid = cave ? clean(m.cid, 24) : '';
    const dt = Math.min(5, (now - c.posAt) / 1000);
    const dist = Math.hypot(m.x - c.x, m.y - c.y);
    const transit = cave !== c.cave || cid !== c.cid;            // masuk/keluar goa
    const okTp = m.tp && now - c.tpAt > 5000;                    // kembali ke desa saat pingsan, dll
    if (!transit && !okTp && !c.fresh && dist > SPEED * 1.8 * dt + 20) {
      send(c, { t: 'fix', x: c.x, y: c.y });                      // terlalu cepat: tarik kembali
      c.posAt = now;
      return;
    }
    if (okTp) c.tpAt = now;
    c.fresh = false;
    c.x = m.x; c.y = m.y; c.cave = cave; c.cid = cid; c.posAt = now;
    c.dx = m.dx > 0 ? 1 : m.dx < 0 ? -1 : 0; c.dy = m.dy > 0 ? 1 : m.dy < 0 ? -1 : 0; c.w = m.w ? 1 : 0;
  }

  // PvP: hanya malam (21:00-05:00 jam dunia), di dunia luar, dan tidak di dalam desa. Server yang memutuskan.
  const DAY_LEN = 300, VIL = { x0: -27, x1: 27, y0: -13, y1: 15 };
  function worldHour(now) { return ((((now / 1000) % DAY_LEN) / DAY_LEN) * 24 + 12) % 24; }
  function isNight(now) { const h = worldHour(now); return h >= 21 || h < 5; }
  function inVil(x, y) { const tx = Math.floor(x / 16), ty = Math.floor(y / 16); return tx >= VIL.x0 && tx <= VIL.x1 && ty >= VIL.y0 && ty <= VIL.y1; }
  function onHit(c, m, now) {
    if (now - (c.hitAt || 0) < 400) return;
    c.hitAt = now;
    const o = clients.get(String(m.n || '').toLowerCase());
    const no = (t) => { if (now - (c.noAt || 0) > 2500) { c.noAt = now; sys(c, t); } };
    if (!o || o === c) return;
    if (!isNight(now)) return no('PvP hanya aktif malam hari (21:00-05:00).');
    if (c.cave || o.cave) return no('Tidak ada PvP di dalam goa.');
    if (inVil(c.x, c.y) || inVil(o.x, o.y)) return no('Desa adalah zona aman.');
    if (Math.hypot(o.x - c.x, o.y - c.y) > 28) return;
    const d = m.w === 'i' ? 14 : (m.w === 'a' ? 10 : 5);
    send(o, { t: 'hurt', from: c.user, d });
    send(c, { t: 'hitok', n: o.user, d });
  }

  function skinOf(s) {
    const a = Array.isArray(s) ? s : [];
    const lim = [5, 7, 4, 7, 5];
    return lim.map((l, i) => (Number.isInteger(a[i]) && a[i] >= 0 && a[i] < l) ? a[i] : 0);
  }

  // ---------- koneksi ----------
  wss.on('connection', (ws, req) => {
    let c = null;
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    const timeout = setTimeout(() => { if (!c) ws.close(4001, 'hello'); }, 10000);
    let msgs = 0, win = Date.now();

    ws.on('message', (data) => {
      const now = Date.now();
      if (now - win > 1000) { win = now; msgs = 0; }
      if (++msgs > 30) { return ws.close(4008, 'terlalu cepat'); }
      let m;
      try { m = JSON.parse(String(data)); } catch (e) { return; }
      if (!m || typeof m !== 'object') return;

      if (!c) {
        if (m.t !== 'hello') return;
        const user = authToken(String(m.token || ''));
        if (!user) { ws.send(JSON.stringify({ t: 'sys', m: 'Sesi habis, masuk lagi.' })); return ws.close(4003, 'auth'); }
        clearTimeout(timeout);
        const old = clients.get(user);
        c = { ws, user, x: num(m.x) ? m.x : 0, y: num(m.y) ? m.y : 0, dx: 0, dy: 1, w: 0, cave: false, cid: '', skin: skinOf(m.skin), posAt: now, tpAt: 0, fresh: true };
        if (Math.abs(c.x) > WORLD_PX || Math.abs(c.y) > WORLD_PX) { c.x = 0; c.y = 0; }
        clients.set(user, c);
        if (old) { try { sys(old, 'Akun dipakai di tempat lain.'); old.ws.close(4000, 'replaced'); } catch (e) {} }
        send(c, { t: 'welcome', you: user, n: clients.size, now: Date.now() });
        pushFriends(c);
        notifyFriends(user, user + ' online.');
        return;
      }
      if (m.t === 'pos') return onPos(c, m, now);
      if (m.t === 'chat') return onChat(c, m.m);
      if (m.t === 'hit') return onHit(c, m, now);
      if (m.t === 'skin') { c.skin = skinOf(m.s); return; }
      if (m.t === 'friends') return pushFriends(c);
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      if (c && clients.get(c.user) === c) { clients.delete(c.user); notifyFriends(c.user, c.user + ' offline.'); }
    });
    ws.on('error', () => {});
  });

  // snapshot pemain terdekat
  const snapTimer = setInterval(() => {
    if (clients.size < 1) return;
    const list = Array.from(clients.values());
    for (const a of list) {
      const vis = [];
      for (const b of list) {
        if (a === b || b.cave !== a.cave || (a.cave && a.cid !== b.cid)) continue;
        const d = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
        if (d > SEE_PX || blocks(a.user, b.user) || blocks(b.user, a.user)) continue;
        vis.push([d, [b.user, Math.round(b.x), Math.round(b.y), b.dx, b.dy, b.w].concat(b.skin)]);
      }
      vis.sort((p, q) => p[0] - q[0]);
      send(a, { t: 'snap', n: clients.size, p: vis.slice(0, 20).map(v => v[1]) });
    }
  }, SNAP_MS);

  const pingTimer = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false; try { ws.ping(); } catch (e) {}
    }
  }, 30000);

  function close() { clearInterval(snapTimer); clearInterval(pingTimer); for (const ws of wss.clients) { try { ws.terminate(); } catch (e) {} } wss.close(); }
  return { wss, clients, close };
}

module.exports = { attach };
