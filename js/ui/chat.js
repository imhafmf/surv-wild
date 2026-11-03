// Chat: tombol CHAT, log singkat di layar, dan panel ketik. Pesan hanya ditampilkan sebagai teks (aman dari HTML).
var Chat = (function () {
  var btn, logEl, panel, clog, cin, open = false;
  var COL = { l: '#ffffff', g: '#ffd34a', w: '#ff9fe5', e: '#b0e0ff', s: '#9fe09f' };

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function fmt(o) {
    var c = COL[o.ch] || '#fff', t;
    if (o.ch === 's') t = esc(o.m);
    else if (o.ch === 'e') t = '* ' + esc(o.from) + ' ' + esc(o.m);
    else if (o.ch === 'w') t = '[bisik] ' + esc(o.from) + (o.to ? ' > ' + esc(o.to) : '') + ': ' + esc(o.m);
    else if (o.ch === 'g') t = '[global] ' + esc(o.from) + ': ' + esc(o.m);
    else t = esc(o.from) + ': ' + esc(o.m);
    return '<div style="color:' + c + '">' + t + '</div>';
  }

  function renderMini() {
    var now = Date.now(), L = MP.lines(), h = '';
    for (var i = Math.max(0, L.length - 5); i < L.length; i++) if (now - L[i].t < 12000) h += fmt(L[i]);
    logEl.innerHTML = h;
  }
  function renderFull() {
    var L = MP.lines(), h = '';
    for (var i = Math.max(0, L.length - 40); i < L.length; i++) h += fmt(L[i]);
    clog.innerHTML = h || '<div style="color:#999">Belum ada pesan. Ketik /help</div>';
    clog.scrollTop = clog.scrollHeight;
  }

  function init() {
    btn = document.getElementById('btnChat');
    logEl = document.getElementById('chatlog');
    panel = document.getElementById('chatp');
    clog = document.getElementById('clog');
    cin = document.getElementById('cin');
    btn.addEventListener('click', function () { toggle(); });
    document.getElementById('cclose').addEventListener('click', function () { toggle(false); });
    document.getElementById('csend').addEventListener('click', send);
    cin.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); send(); } });
    panel.addEventListener('click', function (e) {
      var q = e.target.getAttribute && e.target.getAttribute('data-q');
      if (q) MP.say(q);
    });
    MP.onLine(function () { if (open) renderFull(); renderMini(); });
    setInterval(function () { if (!open) renderMini(); refresh(); }, 1000);
    refresh();
  }
  function send() {
    var v = cin.value;
    cin.value = '';
    if (v.trim()) MP.say(v);
    cin.focus();
  }
  function toggle(on) {
    open = on === undefined ? !open : on;
    panel.style.display = open ? 'block' : 'none';
    if (open) { renderFull(); logEl.style.display = 'none'; setTimeout(function () { cin.focus(); }, 50); }
    else { logEl.style.display = 'block'; cin.blur(); }
  }
  function refresh() { btn.style.display = Net.online() ? 'block' : 'none'; }
  function close() { if (open) toggle(false); }

  return { init: init, close: close, refresh: refresh };
})();
