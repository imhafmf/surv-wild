// Minimap: peta kecil di kanan atas. Yang digambar hanya area yang SUDAH pernah dilewati (diingat),
// per sel 4x4 tile, dan hanya digambar ulang 2x per detik. Tidak ada yang dimuat ulang terus-menerus.
var Minimap = (function () {
  var CELL = 4;          // tile per sel
  var N = 40;            // sel yang tampak per sisi (160 x 160 tile)
  var PX = 2;            // piksel per sel
  var SEE = 3;           // radius penglihatan (sel) = 12 tile
  var GW = 500, HALF = 250;                  // seluruh dunia = 500 x 500 sel (2000 tile / 4)
  var grid = new Uint8Array(GW * GW);        // kode warna per sel (0 = belum dijelajahi). Hanya 250 KB di memori
  var count = 0, dirty = false;
  var pins = [];         // pin pribadi: {x, y (tile), n (nama)}, maks 10
  var PIN_MAX = 10;
  var big = null, bc = null, bg = null, bopen = false, bz = 2, bvx = 0, bvy = 0, bdirty = false, bpx = 0, bpy = 0;
  var ZOOMS = [1, 2, 4, 8];
  var canvas = null, g = null, shown = true, acc = 0, lcx = 1e9, lcy = 1e9;

  var COL = [];
  COL[1 + World.T.WATER]  = '#2f6fb0';
  COL[1 + World.T.SAND]   = '#d9c98a';
  COL[1 + World.T.GRASS]  = '#52a03f';
  COL[1 + World.T.FOREST] = '#2f6a26';
  COL[1 + World.T.ROCK]   = '#807d77';
  COL[1 + World.T.PATH]   = '#b89a6a';
  COL[1 + World.T.PLAZA]  = '#c9c4ba';
  COL[20] = '#b0452f';

  function init() {
    canvas = document.getElementById('minimap');
    g = canvas.getContext('2d');
    canvas.width = canvas.height = N * PX;
    bigInit();
  }

  function gi(cx, cy) { return (cx < -HALF || cx >= HALF || cy < -HALF || cy >= HALF) ? -1 : (cy + HALF) * GW + (cx + HALF); }
  function cellCode(cx, cy) { var i = gi(cx, cy); return i < 0 ? 0 : grid[i]; }

  function codeAt(cx, cy) {
    var tx = cx * CELL + 2, ty = cy * CELL + 2;
    var o = World.objectAt(tx, ty), O = World.O;
    if (o === O.ROOF || o === O.ROOFB || o === O.ROOFG || o === O.WALLH || o === O.DOORH) return 20;
    return World.tileAt(tx, ty) + 1;
  }

  function reveal(pcx, pcy) {
    for (var dy = -SEE; dy <= SEE; dy++) {
      for (var dx = -SEE; dx <= SEE; dx++) {
        var cx = pcx + dx, cy = pcy + dy, gx = gi(cx, cy);
        if (gx >= 0 && grid[gx] === 0) {
          grid[gx] = codeAt(cx, cy);
          count++;
          dirty = true;
        }
      }
    }
  }

  function draw(tx, ty) {
    var pcx = Math.floor(tx / CELL), pcy = Math.floor(ty / CELL), h = N / 2;
    g.fillStyle = '#10151c';
    g.fillRect(0, 0, N * PX, N * PX);
    for (var j = 0; j < N; j++) {
      for (var i = 0; i < N; i++) {
        var v = cellCode(pcx - h + i, pcy - h + j);
        if (!v) continue;
        g.fillStyle = COL[v] || '#000';
        g.fillRect(i * PX, j * PX, PX, PX);
      }
    }
    for (var q = 0; q < pins.length; q++) {
      var qx = (pins[q].x / CELL - (pcx - h)) * PX, qy = (pins[q].y / CELL - (pcy - h)) * PX;
      if (qx >= 0 && qy >= 0 && qx < N * PX - 2 && qy < N * PX - 2) { g.fillStyle = '#000'; g.fillRect(qx - 2, qy - 2, 5, 5); g.fillStyle = '#ffd34a'; g.fillRect(qx - 1, qy - 1, 3, 3); }
    }
    // posisi pemain (titik di tengah, bergeser halus di dalam sel)
    var fx = ((tx / CELL) - pcx) * PX, fy = ((ty / CELL) - pcy) * PX;
    var px = h * PX + fx - 2, py = h * PX + fy - 2;
    g.fillStyle = '#000'; g.fillRect(px - 1, py - 1, 6, 6);
    g.fillStyle = '#ff3b30'; g.fillRect(px, py, 4, 4);
  }


  // ---- peta layar penuh ----
  function bigInit() {
    big = document.getElementById('bigmap');
    bc = document.getElementById('bmc');
    bg = bc.getContext('2d');
    canvas.addEventListener('click', function () { if (!World.inCave()) open(); });
    document.getElementById('mx').addEventListener('click', close);
    document.getElementById('mzi').addEventListener('click', function () { zoom(1); });
    document.getElementById('mzo').addEventListener('click', function () { zoom(-1); });
    document.getElementById('mhome').addEventListener('click', function () { centerOn(Player.state.x / 16, Player.state.y / 16); });
    document.getElementById('pinadd').addEventListener('click', function () {
      var inp = document.getElementById('pinname');
      if (pins.length >= PIN_MAX) { Player.say('Pin penuh (maks ' + PIN_MAX + ')'); return; }
      pins.push({ x: Math.floor(Player.state.x / 16), y: Math.floor(Player.state.y / 16), n: (inp.value || 'Pin ' + (pins.length + 1)).slice(0, 16) });
      inp.value = ''; dirty = true; renderPins(); drawBig();
    });
    document.getElementById('pinlist').addEventListener('click', function (e) {
      var t = e.target, i = t.getAttribute && t.getAttribute('data-del'), j = t.getAttribute && t.getAttribute('data-go');
      if (i !== null && i !== undefined) { pins.splice(+i, 1); dirty = true; renderPins(); drawBig(); }
      else if (j !== null && j !== undefined && pins[+j]) centerOn(pins[+j].x, pins[+j].y);
    });
    // geser peta dengan jari
    var dragId = null, lx = 0, ly = 0, raf = 0;
    function pt(e) { return e.touches && e.touches.length ? e.touches[0] : e; }
    function down(e) { var p = pt(e); dragId = 1; lx = p.clientX; ly = p.clientY; }
    function move(e) {
      if (dragId === null) return;
      e.preventDefault();
      var p = pt(e);
      bvx -= (p.clientX - lx) / bz; bvy -= (p.clientY - ly) / bz;
      lx = p.clientX; ly = p.clientY;
      if (!raf) raf = requestAnimationFrame(function () { raf = 0; drawBig(); });
    }
    function up() { dragId = null; }
    bc.addEventListener('touchstart', down, { passive: true });
    bc.addEventListener('touchmove', move, { passive: false });
    bc.addEventListener('touchend', up);
    bc.addEventListener('mousedown', down);
    window.addEventListener('mousemove', function (e) { if (dragId !== null && bopen) move(e); });
    window.addEventListener('mouseup', up);
  }

  function open() {
    var s = Math.floor(Math.min(window.innerWidth * 0.9 - 16, window.innerHeight * 0.5, 400));
    bc.width = bc.height = Math.max(160, s);
    bc.style.width = bc.style.height = bc.width + 'px';
    bopen = true;
    big.style.display = 'block';
    centerOn(Player.state.x / 16, Player.state.y / 16);
    renderPins();
  }
  function close() { bopen = false; big.style.display = 'none'; }
  function zoom(d) {
    var i = ZOOMS.indexOf(bz) + d;
    if (i < 0 || i >= ZOOMS.length) return;
    bz = ZOOMS[i]; drawBig();
  }
  function centerOn(tx, ty) { bvx = tx / CELL; bvy = ty / CELL; drawBig(); }

  function renderPins() {
    var h = '<small>Pin: ' + pins.length + '/' + PIN_MAX + '. Ditancapkan di posisimu sekarang. Hanya kamu yang bisa melihatnya.</small>';
    var px = Player.state.x / 16, py = Player.state.y / 16;
    for (var i = 0; i < pins.length; i++) {
      var d = Math.round(Math.max(Math.abs(pins[i].x - px), Math.abs(pins[i].y - py)));
      h += '<div class="pn"><span>' + pins[i].n.replace(/[<&]/g, '') + ' <small>' + d + ' tile</small></span><span>' +
           '<button data-go="' + i + '">Lihat</button><button class="red" data-del="' + i + '">Hapus</button></span></div>';
    }
    document.getElementById('pinlist').innerHTML = h;
  }

  function drawBig() {
    if (!bopen) return;
    var W = bc.width, Hh = bc.height, z = bz, i, j;
    var x0 = bvx - W / 2 / z, y0 = bvy - Hh / 2 / z;        // sel di pojok kiri-atas
    bg.fillStyle = '#10151c'; bg.fillRect(0, 0, W, Hh);
    var R = World.WORLD_R / CELL;                             // batas dunia (sel)
    bg.fillStyle = '#16202c'; bg.fillRect((-R - x0) * z, (-R - y0) * z, 2 * R * z, 2 * R * z);
    var ci0 = Math.floor(x0), cj0 = Math.floor(y0), ci1 = Math.ceil(x0 + W / z), cj1 = Math.ceil(y0 + Hh / z);
    for (j = cj0; j <= cj1; j++) {
      for (i = ci0; i <= ci1; i++) {
        var v = cellCode(i, j);
        if (!v) continue;
        bg.fillStyle = COL[v] || '#000';
        bg.fillRect(Math.floor((i - x0) * z), Math.floor((j - y0) * z), z, z);
      }
    }
    bg.strokeStyle = '#6a7a90'; bg.lineWidth = 1;
    bg.strokeRect((-R - x0) * z + 0.5, (-R - y0) * z + 0.5, 2 * R * z, 2 * R * z);
    // desa (selalu dikenal) dan lahan milikmu
    var V = World.VILLAGE;
    bg.strokeStyle = '#ff9a4a'; bg.strokeRect((V.x0 / CELL - x0) * z, (V.y0 / CELL - y0) * z, (V.x1 - V.x0 + 1) / CELL * z, (V.y1 - V.y0 + 1) / CELL * z);
    bg.font = 'bold 10px monospace'; bg.textAlign = 'center';
    bg.fillStyle = '#ffb877'; bg.fillText('Desa', ((V.x0 + V.x1) / 2 / CELL - x0) * z, (V.y0 / CELL - y0) * z - 3);
    var pl = Farm.plotList(), S = Farm.SIZE;
    bg.strokeStyle = '#ffe066';
    for (i = 0; i < pl.length; i++) bg.strokeRect((pl[i][0] * S / CELL - x0) * z, (pl[i][1] * S / CELL - y0) * z, S / CELL * z, S / CELL * z);
    var sg = Farm.signList();
    bg.fillStyle = '#fff';
    for (i = 0; i < sg.length; i++) bg.fillRect((sg[i][0] / CELL - x0) * z - 1, (sg[i][1] / CELL - y0) * z - 1, 3, 3);
    for (i = 0; i < pins.length; i++) {
      var qx = (pins[i].x / CELL - x0) * z, qy = (pins[i].y / CELL - y0) * z;
      bg.fillStyle = '#000'; bg.fillRect(qx - 3, qy - 3, 7, 7); bg.fillStyle = '#ffd34a'; bg.fillRect(qx - 2, qy - 2, 5, 5);
      if (z >= 2) { bg.fillStyle = '#fff'; bg.fillText(pins[i].n, qx, qy - 6); }
    }
    var ex = (Player.state.x / 16 / CELL - x0) * z, ey = (Player.state.y / 16 / CELL - y0) * z;
    bg.fillStyle = '#000'; bg.fillRect(ex - 3, ey - 3, 7, 7); bg.fillStyle = '#ff3b30'; bg.fillRect(ex - 2, ey - 2, 5, 5);
    bg.fillStyle = '#9ab'; bg.font = '9px monospace'; bg.textAlign = 'left';
    bg.fillText('zoom ' + z + 'x  geser untuk menggeser', 4, Hh - 4);
  }

  function getPins() { return pins; }
  function restorePins(a) {
    pins = [];
    if (!Array.isArray(a)) return;
    for (var i = 0; i < a.length && pins.length < PIN_MAX; i++) {
      var q = a[i];
      if (q && typeof q.x === 'number' && typeof q.y === 'number') pins.push({ x: q.x, y: q.y, n: String(q.n || 'Pin').slice(0, 16) });
    }
  }

  function update(dt, p) {
    if (!canvas) return;
    var cave = World.inCave();
    if (cave && bopen) close();
    if (cave === shown) { shown = !cave; canvas.style.display = shown ? 'block' : 'none'; acc = 9; }
    if (cave) return;
    var tx = Math.floor(p.x / 16), ty = Math.floor(p.y / 16);
    var cx = Math.floor(tx / CELL), cy = Math.floor(ty / CELL);
    if (cx !== lcx || cy !== lcy) { lcx = cx; lcy = cy; reveal(cx, cy); }
    acc += dt;
    if (acc >= 0.5) { acc = 0; draw(tx, ty); }
  }

  function reset() { grid.fill(0); count = 0; dirty = false; lcx = lcy = 1e9; acc = 9; pins = []; }

  // Format simpan: teks RLE, tiap sel = huruf (a + kode) lalu jumlah berulang, mis. "a1523b3c2". Seluruh dunia hanya puluhan KB.
  function serialize() {
    var out = [], i = 0, n = grid.length;
    while (i < n) {
      var v = grid[i], j = i + 1;
      while (j < n && grid[j] === v) j++;
      out.push(String.fromCharCode(97 + v) + (j - i));
      i = j;
    }
    return out.join('');
  }

  function restore(data) {
    reset();
    if (typeof data === 'string') {
      var re = /([a-z])(\d+)/g, m, pos = 0;
      while ((m = re.exec(data)) !== null && pos < grid.length) {
        var v = m[1].charCodeAt(0) - 97, run = +m[2];
        if (v > 0) for (var k = 0; k < run && pos + k < grid.length; k++) { grid[pos + k] = v; count++; }
        pos += run;
      }
    } else if (data && data.length) {                       // format lama: [cx, cy, kode, ...]
      for (var i = 0; i + 2 < data.length; i += 3) {
        var gx = (typeof data[i] === 'number' && typeof data[i + 1] === 'number') ? gi(data[i], data[i + 1]) : -1;
        if (gx >= 0 && typeof data[i + 2] === 'number' && data[i + 2] > 0 && data[i + 2] < 26 && grid[gx] === 0) { grid[gx] = data[i + 2]; count++; }
      }
    }
    dirty = false;
  }

  return { init: init, update: update, getPins: getPins, restorePins: restorePins, close: close, isOpen: function () { return bopen; }, reset: reset, serialize: serialize, restore: restore,
           isDirty: function () { return dirty; }, clean: function () { dirty = false; },
           size: function () { return count; } };
})();
