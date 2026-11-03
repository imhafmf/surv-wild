// MP: koneksi realtime ke server (WebSocket /ws). Pemain lain, chat, daftar teman.
// Server yang memutuskan; klien hanya mengirim posisi (dicek kecepatannya di server) dan teks chat.
var MP = (function () {
  var ws = null, wanted = false, ready = false, retryT = 0, backoff = 2;
  var others = {};                 // nama -> {x, y, tx, ty, dx, dy, w, skin[5]}
  var count = 0, clockOff = 0;     // selisih jam server - jam HP (jam dunia dibagi semua pemain)
  var lines = [];                  // {t, ch, from, to, m}
  var friends = { f: [], req: [], blk: [] };
  var sent = { x: -1e9, y: -1e9, dx: 9, dy: 9, w: -1, c: -1, at: 0 };
  var onLine = null;

  function wsUrl() { var b = Net.base(); return b ? b.replace(/^http/i, 'ws') + '/ws' : ''; }
  var bubbles = {};                // nama -> {m, until}: tulisan di atas kepala setelah chat
  function add(o) { o.t = Date.now(); if ((o.ch === 'l' || o.ch === 'g') && o.from) bubbles[o.from] = { m: String(o.m).slice(0, 80), until: o.t + 6000 }; lines.push(o); if (lines.length > 60) lines.shift(); if (onLine) onLine(o); }
  function sys(m) { add({ ch: 's', m: m }); }

  // server lama (tanpa jam di welcome): ambil jam dari header Date balasan /healthz
  function syncClock() {
    var t0 = Date.now();
    try {
      fetch(Net.base() + '/healthz', { cache: 'no-store' }).then(function (r) {
        var d = Date.parse(r.headers.get('Date') || '');
        if (d === d) clockOff = (d + 500) - (t0 + Date.now()) / 2;
      }).catch(function () {});
    } catch (e) {}
  }

  function start() {
    if (wanted || !Net.online() || !wsUrl()) return;
    wanted = true; backoff = 2; connect();
  }
  function stop() {
    wanted = false; ready = false; clearTimeout(retryT);
    if (ws) { try { ws.onclose = null; ws.close(); } catch (e) {} }
    ws = null; others = {}; count = 0; sent.c = -1;
  }
  function schedule() {
    if (!wanted) return;
    clearTimeout(retryT);
    retryT = setTimeout(connect, backoff * 1000);
    backoff = Math.min(30, backoff * 2);
  }
  function connect() {
    if (!wanted) return;
    try { ws = new WebSocket(wsUrl()); } catch (e) { schedule(); return; }
    var mine = ws;
    ws.onopen = function () {
      var p = Player.state;
      mine.send(JSON.stringify({ t: 'hello', token: Net.token(), x: Math.round(p.x), y: Math.round(p.y), skin: Skin.toArray() }));
    };
    ws.onmessage = function (e) {
      var m; try { m = JSON.parse(e.data); } catch (x) { return; }
      handle(m);
    };
    ws.onclose = function (ev) {
      var wasReady = ready;
      ready = false; others = {}; count = 0; sent.c = -1;
      if (ws === mine) ws = null;
      if (ev.code === 4003) { sys('Sesi habis. Keluar akun lalu masuk lagi.'); wanted = false; return; }
      if (ev.code === 4000) { wanted = false; return; }
      if (wasReady) sys('Terputus dari server, mencoba lagi...');
      schedule();
    };
    ws.onerror = function () {};
  }

  function handle(m) {
    if (m.t === 'welcome') { if (typeof m.now === 'number') clockOff = m.now - Date.now(); else syncClock(); ready = true; backoff = 2; count = m.n | 0; sys('Terhubung. Ketik /help untuk perintah.'); }
    else if (m.t === 'snap') {
      count = m.n | 0;
      var seen = {};
      for (var i = 0; i < m.p.length; i++) {
        var a = m.p[i], o = others[a[0]];
        if (!o) o = others[a[0]] = { x: a[1], y: a[2] };
        o.tx = a[1]; o.ty = a[2]; o.dx = a[3]; o.dy = a[4]; o.w = a[5]; o.skin = a.slice(6, 11);
        seen[a[0]] = 1;
      }
      for (var k in others) if (!seen[k]) delete others[k];
    }
    else if (m.t === 'hurt') { if (typeof Player !== 'undefined' && Player.pvpHurt) Player.pvpHurt(String(m.from), Math.min(20, m.d | 0)); }
    else if (m.t === 'hitok') { if (typeof Player !== 'undefined' && Player.pvpOk) Player.pvpOk(String(m.n)); }
    else if (m.t === 'chat') add({ ch: m.ch, from: m.from, to: m.to, m: m.m });
    else if (m.t === 'sys') sys(String(m.m || ''));
    else if (m.t === 'friends') friends = { f: m.f || [], req: m.req || [], blk: m.blk || [] };
    else if (m.t === 'fix') Player.setPx(m.x, m.y);
  }

  function update(dt, p) {
    if (!ready) return;
    for (var k in others) {
      var o = others[k], f = Math.min(1, dt * 10);
      o.x += (o.tx - o.x) * f; o.y += (o.ty - o.y) * f;
    }
    var now = performance.now();
    if (now - sent.at < 200 || !ws || ws.readyState !== 1) return;
    var cave = World.inCave() ? 1 : 0, w = p.walkT > 0 ? 1 : 0;
    var x = Math.round(p.x), y = Math.round(p.y);
    var moved = x !== sent.x || y !== sent.y || p.dx !== sent.dx || p.dy !== sent.dy || w !== sent.w || cave !== sent.c;
    if (!moved && now - sent.at < 2000) return;
    var tp = cave === sent.c && sent.c !== -1 && Math.hypot(x - sent.x, y - sent.y) > 48 ? 1 : 0;
    ws.send(JSON.stringify({ t: 'pos', x: x, y: y, dx: p.dx, dy: p.dy, w: w, c: cave, cid: cave ? World.caveKey() : '', tp: tp }));
    sent.x = x; sent.y = y; sent.dx = p.dx; sent.dy = p.dy; sent.w = w; sent.c = cave; sent.at = now;
  }

  function say(text) {
    text = String(text || '').trim();
    if (!text) return;
    if (!ready || !ws || ws.readyState !== 1) { sys('Belum terhubung ke server.'); return; }
    ws.send(JSON.stringify({ t: 'chat', m: text.slice(0, 100) }));
  }

  return {
    sendHit: function (name, w) { if (ws && ready && ws.readyState === 1) ws.send(JSON.stringify({ t: 'hit', n: name, w: w })); },
    hitTarget: function (px, py, r) { var best = null, bd = r * r; for (var k in others) { var o = others[k], d = (o.x - px) * (o.x - px) + (o.y - py) * (o.y - py); if (d <= bd) { bd = d; best = k; } } return best; },
    bubble: function (n) { var b = bubbles[n]; if (!b) return null; if (b.until < Date.now()) { delete bubbles[n]; return null; } return b.m; },
    clock: function () { return Date.now() + clockOff; },
    start: start, stop: stop, update: update, say: say,
    connected: function () { return ready; },
    count: function () { return count; },
    list: function () { var a = []; for (var k in others) { var o = others[k]; a.push({ name: k, x: o.x, y: o.y, dx: o.dx, dy: o.dy, w: o.w, skin: o.skin }); } return a; },
    lines: function () { return lines; },
    friends: function () { return friends; },
    onLine: function (f) { onLine = f; }
  };
})();
