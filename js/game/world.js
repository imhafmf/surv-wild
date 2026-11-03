// World: dunia procedural berbasis chunk. Ada 2 lapisan: dunia luar ('o') dan goa ('c')
var World = (function () {
  var CHUNK = 32;          // tile per sisi chunk
  var TS = 16;             // ukuran tile (px)
  var SEED = 20261031;     // ganti seed = dunia lain
  var S = SEED;            // seed aktif (berubah di dalam goa)
  var layer = 'o', caveId = '';
  var WORLD_R = 1000;      // batas dunia: 2000 x 2000 tile, dikelilingi laut

  var T = { WATER: 0, SAND: 1, GRASS: 2, FOREST: 3, ROCK: 4, WALL: 5, FLOOR: 6, PATH: 7, PLAZA: 8 };
  var O = { NONE: 0, TREE: 1, PEBBLE: 2, BOULDER: 3, GOLD: 4, CAVE: 5, EXIT: 6, IRON: 7, FURNACE: 8, ROOF: 9, WALLH: 10, DOORH: 11, NPC: 12, BOARD: 13, CHEST: 14, WELL: 15, TABLE: 16,
           LAMP: 17, FENCE: 18, FLOWER: 19, VTREE: 20, ROOFB: 21, ROOFG: 22, SOIL: 23, PLANT: 24, FTREE: 25, SIGN: 26, CROCK: 27, PBOARD: 28, PCHEST: 29, BED: 30 };

  // hits = pukulan, respawn = detik, need = alat wajib, boost = alat yang mempercepat
  var DEF = {};
  DEF[O.TREE]    = { hits: 3, item: 'wood',    qty: 2, name: 'Kayu',        respawn: 180, solid: true,  need: 'axe',     boost: 'axe',     needName: 'Kapak' };
  DEF[O.PEBBLE]  = { hits: 1, item: 'pebble',  qty: 1, name: 'Kerikil',     respawn: 90,  solid: false, need: null,      boost: null,      needName: '' };
  DEF[O.BOULDER] = { hits: 5, item: 'stone',   qty: 2, name: 'Batu',        respawn: 300, solid: true,  need: 'pickaxe', boost: 'pickaxe', needName: 'Beliung' };
  DEF[O.GOLD]    = { hits: 2, item: 'gold',    qty: 1, name: 'Emas sungai', respawn: 400, solid: false, need: 'pan',     boost: null,      needName: 'Dulang emas' };
  DEF[O.IRON]    = { hits: 6, item: 'ironore', qty: 1, name: 'Bijih besi',  respawn: 600, solid: true,  need: 'pickaxe', boost: 'pickaxe', needName: 'Beliung' };
  DEF[O.CAVE]    = { portal: 'enter', name: 'Goa',    solid: true };
  DEF[O.EXIT]    = { portal: 'exit',  name: 'Keluar', solid: true };
  DEF[O.FURNACE] = { furnace: true,   name: 'Tungku', solid: true };
  DEF[O.ROOF]    = { deco: true, name: 'Atap',  solid: true };
  DEF[O.WALLH]   = { deco: true, name: 'Dinding', solid: true };
  DEF[O.DOORH]   = { deco: true, name: 'Pintu', solid: true };
  DEF[O.NPC]     = { interact: 'shop',  name: 'Penjual',      solid: true };
  DEF[O.BOARD]   = { interact: 'board', name: 'Papan Order',  solid: true };
  DEF[O.CHEST]   = { interact: 'chest', name: 'Peti Order',   solid: true };
  DEF[O.TABLE]   = { interact: 'table', name: 'Meja kerja',  solid: true };
  DEF[O.WELL]    = { interact: 'well',  name: 'Sumur',        solid: true };
  DEF[O.LAMP]    = { deco: true, name: 'Lampu',   solid: true };
  DEF[O.FENCE]   = { deco: true, name: 'Pagar',   solid: true };
  DEF[O.FLOWER]  = { deco: true, name: 'Bunga',   solid: false };
  DEF[O.VTREE]   = { deco: true, name: 'Pohon hias', solid: true };
  DEF[O.ROOFB]   = { deco: true, name: 'Atap',    solid: true };
  DEF[O.ROOFG]   = { deco: true, name: 'Atap',    solid: true };

  DEF[O.SOIL]    = { farm: true, name: 'Tanah', solid: false };
  DEF[O.PLANT]   = { farm: true, name: 'Tanaman', solid: false };
  DEF[O.FTREE]   = { farm: true, name: 'Pohon buah', solid: true };
  DEF[O.SIGN]    = { farm: true, name: 'Papan', solid: true };
  DEF[O.CROCK]   = { deco: true, name: 'Dinding batu', solid: true };
  DEF[O.BED]     = { interact: 'bed', name: 'Kasur', solid: false };
  DEF[O.PBOARD]  = { interact: 'pboard', name: 'Papan Order', solid: true };
  DEF[O.PCHEST]  = { interact: 'pchest', name: 'Peti Order',  solid: true };
  var farm = null;         // modul Farm (tanah, tanaman) dipasang setelah dimuat

  var chunks = {};         // cache chunk aktif
  var harvested = {};      // key -> waktu respawn (ms)
  var hits = {};           // key -> jumlah pukulan
  var structures = {};     // bangunan pemain di dunia luar: "x,y" -> 1

  function hash(x, y, s) {
    var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function smooth(t) { return t * t * (3 - 2 * t); }

  function vnoise(x, y, scale, s) {
    var fx = x / scale, fy = y / scale;
    var ix = Math.floor(fx), iy = Math.floor(fy);
    var tx = smooth(fx - ix), ty = smooth(fy - iy);
    var a = hash(ix, iy, S + s), b = hash(ix + 1, iy, S + s);
    var c = hash(ix, iy + 1, S + s), d = hash(ix + 1, iy + 1, S + s);
    var top = a + (b - a) * tx;
    var bot = c + (d - c) * tx;
    return top + (bot - top) * ty;
  }

  function fbm(x, y, scale, s) {
    return vnoise(x, y, scale, s) * 0.6 +
           vnoise(x, y, scale / 2, s + 10) * 0.3 +
           vnoise(x, y, scale / 4, s + 20) * 0.1;
  }

  // Desa tempat lahir (tetap, di sekitar titik 0,0): 55 x 29 tile
  var VILLAGE = {
    x0: -27, x1: 27, y0: -13, y1: 15,
    spawn: { x: 0, y: 3 },
    chests: [[-5, -2], [-4, -2], [-3, -2]],     // peti order #1 #2 #3 (papan order di sebelah kanannya)
    board: [-2, -2], shop: [6, -6], well: [3, 3], table: [-3, 3],
    pond: { cx: 14, cy: 11.5, rx: 5.5, ry: 2.8 }
  };
  // r = warna atap: 0 merah, 1 biru, 2 hijau. Baris utara menghadap jalan y=-6, selatan menghadap y=7
  var BUILD = [
    { x: -25, y: -9, w: 4, door: 1, r: 1 }, { x: -20, y: -9, w: 4, door: 2, r: 2 },
    { x: -14, y: -9, w: 4, door: 1, r: 0 }, { x: -9,  y: -9, w: 4, door: 1, r: 1 },
    { x: 4,   y: -9, w: 6, door: 2, r: 0 },                                   // toko
    { x: 11,  y: -9, w: 4, door: 1, r: 2 }, { x: 16,  y: -9, w: 4, door: 2, r: 1 }, { x: 21, y: -9, w: 4, door: 1, r: 0 },
    { x: -25, y: 4,  w: 4, door: 2, r: 0 }, { x: -20, y: 4,  w: 4, door: 1, r: 2 },
    { x: -14, y: 4,  w: 4, door: 1, r: 1 }, { x: -9,  y: 4,  w: 4, door: 1, r: 0 },
    { x: 6,   y: 4,  w: 4, door: 1, r: 2 }, { x: 11,  y: 4,  w: 4, door: 2, r: 1 },
    { x: 16,  y: 4,  w: 4, door: 1, r: 0 }, { x: 21,  y: 4,  w: 4, door: 2, r: 2 }
  ];
  var ROOFS = [O.ROOF, O.ROOFB, O.ROOFG];
  var LAMP_X = [-24, -18, -12, 10, 16, 22];

  function inVillage(x, y) { return x >= VILLAGE.x0 && x <= VILLAGE.x1 && y >= VILLAGE.y0 && y <= VILLAGE.y1; }

  // jarak (Chebyshev) ke persegi desa; 0 = di dalam
  function vdist(x, y) {
    var dx = Math.max(VILLAGE.x0 - x, 0, x - VILLAGE.x1), dy = Math.max(VILLAGE.y0 - y, 0, y - VILLAGE.y1);
    return Math.max(dx, dy);
  }

  function roadRow(y) { return y === 0 || y === 1 || y === -6 || y === -5 || y === 7 || y === 8; }
  function roadAt(x, y) { return x === 0 || x === 1 || roadRow(y); }
  function plazaAt(x, y) { return x >= -6 && x <= 7 && y >= -4 && y <= 3; }
  function pondD(x, y) {
    var p = VILLAGE.pond, dx = (x - p.cx) / p.rx, dy = (y - p.cy) / p.ry;
    return dx * dx + dy * dy;
  }
  function nearBuild(x, y, m) {
    for (var i = 0; i < BUILD.length; i++) {
      var b = BUILD[i];
      if (x >= b.x - m && x < b.x + b.w + m && y >= b.y - m && y < b.y + 3 + m) return true;
    }
    return false;
  }
  function isLamp(x, y) {
    if (x === -1 || x === 2) return y === -11 || y === -8 || y === 10 || y === 13;
    if (y === -4 || y === -1 || y === 2 || y === 9) return LAMP_X.indexOf(x) >= 0;
    return false;
  }
  function nearRoad(x, y) {
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) if (roadAt(x + dx, y + dy) || plazaAt(x + dx, y + dy)) return true;
    return false;
  }

  function villageAt(x, y) {
    if (!inVillage(x, y)) return null;
    var tile = plazaAt(x, y) ? T.PLAZA : (roadAt(x, y) ? T.PATH : T.GRASS);
    var obj = O.NONE;
    var pd = pondD(x, y);
    if (pd < 1) tile = T.WATER; else if (pd < 1.45 && tile === T.GRASS) tile = T.SAND;

    for (var i = 0; i < BUILD.length; i++) {
      var b = BUILD[i];
      if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + 3) {
        obj = (y - b.y) < 2 ? ROOFS[b.r || 0] : (x === b.x + b.door ? O.DOORH : O.WALLH);
      }
    }

    // pagar keliling desa, terbuka di ujung jalan (gerbang)
    var sideEdge = (x === VILLAGE.x0 || x === VILLAGE.x1), topEdge = (y === VILLAGE.y0 || y === VILLAGE.y1);
    if (obj === O.NONE && (sideEdge || topEdge)) {
      var gate = (sideEdge && roadRow(y)) || (topEdge && (x === 0 || x === 1));
      if (!gate) obj = O.FENCE;
    }

    if (x === VILLAGE.shop[0] && y === VILLAGE.shop[1]) obj = O.NPC;
    else if (x === VILLAGE.board[0] && y === VILLAGE.board[1]) obj = O.BOARD;
    else if (x === VILLAGE.well[0] && y === VILLAGE.well[1]) obj = O.WELL;
    else if (x === VILLAGE.table[0] && y === VILLAGE.table[1]) obj = O.TABLE;
    else {
      for (var c = 0; c < VILLAGE.chests.length; c++) {
        if (VILLAGE.chests[c][0] === x && VILLAGE.chests[c][1] === y) obj = O.CHEST;
      }
    }

    // hiasan hanya di rumput kosong
    if (obj === O.NONE && tile === T.GRASS) {
      if (isLamp(x, y)) obj = O.LAMP;
      else {
        var h = hash(x, y, 21);
        if (h < 0.03 && !nearRoad(x, y) && !nearBuild(x, y, 1)) obj = O.VTREE;
        else if (h > 0.9) obj = O.FLOWER;
      }
    }
    return { tile: tile, obj: obj };
  }

  // Pintu goa: titik batu yang jarang. Dinding batu dibuat di kiri, kanan, dan atas pintu; tile depan (bawah) dibiarkan kosong
  function isDoor(x, y) {
    if (hash(x, y, 13) >= 0.002) return false;
    if (Math.max(Math.abs(x), Math.abs(y)) > WORLD_R - 10 || vdist(x, y) <= 10) return false;
    return fbm(x, y, 80, 1) > 0.64;
  }
  var DOOR_WALL = [[-1, 0], [1, 0], [-1, -1], [0, -1], [1, -1]];

  // Dunia luar
  function computeOver(x, y) {
    var v = villageAt(x, y);
    if (v) return v;
    var dist = Math.max(Math.abs(x), Math.abs(y));
    if (dist > WORLD_R) return { tile: T.WATER, obj: O.NONE };      // laut di luar batas dunia
    var e = fbm(x, y, 80, 1);                 // ketinggian
    var m = fbm(x, y, 60, 4);                 // kelembapan
    var r = Math.abs(fbm(x, y, 50, 3) - 0.5); // jarak ke jalur sungai
    var tile, obj = O.NONE;
    var h = hash(x, y, 9);

    if (e > 0.64) tile = T.ROCK;              // pegunungan
    else if (e < 0.285) tile = T.WATER;       // danau
    else if (e < 0.305) tile = T.SAND;        // pantai danau
    else if (r < 0.008) tile = T.WATER;       // sungai
    else if (r < 0.018) tile = T.SAND;        // tepi sungai (emas aluvial)
    else if (m > 0.50) tile = T.FOREST;
    else tile = T.GRASS;

    // 10 tile di sekitar desa selalu bisa dilalui (tidak ada danau/gunung yang mengurung)
    if (vdist(x, y) <= 10 && (tile === T.WATER || tile === T.ROCK)) tile = T.GRASS;
    // pantai di tepi dunia
    if (dist > WORLD_R - 10 && tile !== T.WATER) tile = T.SAND;

    if (tile === T.FOREST) {
      if (h < 0.22) obj = O.TREE;
      else if (h < 0.24) obj = O.PEBBLE;
    } else if (tile === T.GRASS) {
      if (h < 0.015) obj = O.TREE;
      else if (h < 0.06) obj = O.PEBBLE;
    } else if (tile === T.ROCK) {
      if (isDoor(x, y)) obj = O.CAVE;      // pintu goa
      else if (h < 0.09) obj = O.BOULDER;
      else if (h < 0.14) obj = O.PEBBLE;
    } else if (tile === T.SAND) {
      // emas aluvial: di tepi sungai yang dekat kaki gunung (hulu)
      if (r < 0.018 && e > 0.52 && h < 0.10) obj = O.GOLD;
      else if (h < 0.05) obj = O.PEBBLE;
    }

    // dinding batu di sekitar pintu goa supaya terlihat menjorok ke dalam gunung
    if (tile !== T.WATER && obj !== O.CAVE) {
      for (var dw = 0; dw < 5; dw++) if (isDoor(x - DOOR_WALL[dw][0], y - DOOR_WALL[dw][1])) { obj = O.CROCK; break; }
      if (obj !== O.CROCK && isDoor(x, y - 1)) obj = O.NONE;      // depan pintu harus kosong
    }

    // pohon buah liar: jarang sekali (pisang, kelapa, mangga, dll)
    if ((tile === T.FOREST || tile === T.GRASS) && obj !== O.CROCK && vdist(x, y) > 3 && hash(x, y, 41) < 0.0007) obj = O.FTREE;

    if (x * x + y * y < 16) obj = O.NONE;     // area aman titik awal
    return { tile: tile, obj: obj };
  }

  // Goa: ruang terbuka dari noise + lorong (garis noise) supaya selalu tersambung
  function computeCave(x, y) {
    var d2 = x * x + y * y;
    var n = fbm(x, y, 14, 30);
    var ridge = Math.abs(fbm(x, y, 22, 40) - 0.5);
    var near = Math.max(0, 1 - Math.sqrt(d2) / 22) * 0.3;     // dekat pintu cenderung terbuka
    var cross = (Math.abs(x) < 2 || Math.abs(y) < 2) && d2 < 1600; // lorong silang dari pintu
    var floor = n + near > 0.43 || ridge < 0.05 || cross || d2 < 16;
    var tile = floor ? T.FLOOR : T.WALL;
    var obj = O.NONE, h = hash(x, y, 11);
    if (floor && d2 >= 16) {
      if (h < 0.035) obj = O.IRON;
      else if (h < 0.07) obj = O.PEBBLE;
      else if (h < 0.085) obj = O.BOULDER;
    }
    if (x === 0 && y === 0) obj = O.EXIT;
    return { tile: tile, obj: obj };
  }

  function compute(x, y) { return layer === 'o' ? computeOver(x, y) : computeCave(x, y); }

  function getChunk(cx, cy) {
    var key = cx + ',' + cy;
    var ch = chunks[key];
    if (ch) return ch;
    ch = { cx: cx, cy: cy, tiles: new Uint8Array(CHUNK * CHUNK), objs: new Uint8Array(CHUNK * CHUNK), canvas: null };
    for (var ty = 0; ty < CHUNK; ty++) {
      for (var tx = 0; tx < CHUNK; tx++) {
        var r = compute(cx * CHUNK + tx, cy * CHUNK + ty);
        ch.tiles[ty * CHUNK + tx] = r.tile;
        ch.objs[ty * CHUNK + tx] = r.obj;
      }
    }
    chunks[key] = ch;
    return ch;
  }

  function locate(x, y) {
    var cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    return { ch: getChunk(cx, cy), i: (y - cy * CHUNK) * CHUNK + (x - cx * CHUNK) };
  }

  function tileAt(x, y) {
    var l = locate(x, y);
    return l.ch.tiles[l.i];
  }

  function hk(x, y) { return (layer === 'o' ? 'o' : caveId) + ':' + x + ',' + y; }

  function objectAt(x, y, now) {
    if (layer === 'o') {
      var sk = structures[x + ',' + y];
      if (sk) return sk === 'table' ? O.TABLE : (sk === 'bed' ? O.BED : O.FURNACE);
      if (farm) { var fo = farm.objAt(x, y, now || Date.now()); if (fo) return fo; }
    }
    var l = locate(x, y);
    var o = l.ch.objs[l.i];
    if (o === O.NONE) return O.NONE;
    var k = hk(x, y);
    var t = harvested[k];
    if (t !== undefined) {
      if ((now || Date.now()) < t) return O.NONE;
      delete harvested[k];
    }
    return o;
  }

  function isSolid(x, y) {
    var t = tileAt(x, y);
    if (t === T.WATER || t === T.WALL) return true;
    var o = objectAt(x, y);
    return o !== O.NONE && DEF[o].solid;
  }

  // Alat: keluarga (fam) dan kekuatannya. Alat harus DIPEGANG (hotbar) untuk dipakai.
  var TOOLS = {
    axe: { fam: 'axe', pow: 2 }, iaxe: { fam: 'axe', pow: 3 },
    pickaxe: { fam: 'pickaxe', pow: 2 }, ipickaxe: { fam: 'pickaxe', pow: 3 },
    pan: { fam: 'pan', pow: 1 }
  };
  function toolPow(held, fam) {
    var t = held ? TOOLS[held] : null;
    return (t && t.fam === fam) ? t.pow : 0;
  }

  // Pukul/gunakan objek di tile dengan item yang dipegang (held = id atau null).
  // null / {blocked} / {portal} / {furnace} / {interact} / {deco} / {done, def}
  function hit(x, y, held) {
    var o = objectAt(x, y);
    if (o === O.NONE) return null;
    var def = DEF[o];
    if (def.deco) return { deco: true, def: def };
    if (def.farm) return { farm: true, o: o, x: x, y: y, def: def };
    if (def.interact) return { interact: def.interact, def: def, x: x, y: y };
    if (def.portal) return { portal: def.portal, def: def };
    if (def.furnace) return { furnace: true, def: def };
    if (def.need && toolPow(held, def.need) === 0) return { blocked: true, def: def };
    var key = hk(x, y);
    var dmg = def.boost ? Math.max(1, toolPow(held, def.boost)) : 1;
    hits[key] = (hits[key] || 0) + dmg;
    if (hits[key] >= def.hits) {
      delete hits[key];
      harvested[key] = Date.now() + def.respawn * 1000;
      return { done: true, def: def };
    }
    return { done: false, def: def, left: def.hits - hits[key] };
  }

  // Pasang tungku (hanya di dunia luar, di tile kosong)
  function place(x, y, kind) {
    if (layer !== 'o') return false;
    var t = tileAt(x, y);
    if (t === T.WATER || t === T.ROCK) return false;
    if (objectAt(x, y) !== O.NONE) return false;
    structures[x + ',' + y] = kind || 'furnace';
    return true;
  }

  // Ambil kembali bangunan pemain (meja) dari tile di sekitar. Mengembalikan true bila ada.
  function removeNear(px, py, kind, radius) {
    var best = null, bd = 1e9;
    for (var k in structures) {
      if (structures[k] !== kind) continue;
      var a = k.split(',');
      var d = Math.max(Math.abs(+a[0] - px), Math.abs(+a[1] - py));
      if (d <= radius && d < bd) { bd = d; best = k; }
    }
    if (!best) return false;
    delete structures[best];
    return true;
  }

  // Bangunan pemain terdekat (meja/tungku/kasur) dalam radius tile: {key, kind} atau null
  function nearestStruct(px, py, radius) {
    var best = null, bd = 1e9;
    for (var k in structures) {
      var a = k.split(',');
      var d = Math.max(Math.abs(+a[0] - px), Math.abs(+a[1] - py));
      if (d <= radius && d < bd) { bd = d; best = { key: k, kind: structures[k] }; }
    }
    return best;
  }
  function removeStruct(key) { delete structures[key]; }

  // Ada meja kerja (desa atau pasangan sendiri) dalam radius tile dari pemain?
  function nearTable(px, py, radius) {
    for (var dy = -radius; dy <= radius; dy++)
      for (var dx = -radius; dx <= radius; dx++)
        if (objectAt(px + dx, py + dy) === O.TABLE) return true;
    return false;
  }

  function enterCave(x, y) {
    layer = 'c';
    caveId = 'c' + x + ',' + y;
    S = (SEED + (Math.imul(x, 73856093) ^ Math.imul(y, 19349663))) | 0;
    chunks = {};
  }

  function exitCave() {
    layer = 'o';
    S = SEED;
    chunks = {};
  }

  function prune(pcx, pcy, keep) {
    for (var k in chunks) {
      var c = chunks[k];
      if (Math.abs(c.cx - pcx) > keep || Math.abs(c.cy - pcy) > keep) delete chunks[k];
    }
  }

  function findSpawn() { return { x: VILLAGE.spawn.x, y: VILLAGE.spawn.y }; }

  return {
    CHUNK: CHUNK, TS: TS, T: T, O: O, DEF: DEF, WORLD_R: WORLD_R, BUILD: BUILD, roadAt: roadAt, plazaAt: plazaAt, vdist: vdist,
    hash: hash, getChunk: getChunk, tileAt: tileAt, objectAt: objectAt,
    isSolid: isSolid, hit: hit, place: place, prune: prune, findSpawn: findSpawn,
    enterCave: enterCave, exitCave: exitCave,
    VILLAGE: VILLAGE, inVillage: inVillage,
    inCave: function () { return layer === 'c'; },
    caveKey: function () { return caveId; },
    toolPow: toolPow, TOOLS: TOOLS,
    getStructures: function () { return structures; },
    setStructures: function (s) {
      structures = {};
      if (s && typeof s === 'object') for (var k in s) structures[k] = (s[k] === 'table' || s[k] === 'bed') ? s[k] : 'furnace';   // data lama: 1 = tungku
    },
    removeNear: removeNear, nearestStruct: nearestStruct, removeStruct: removeStruct, nearTable: nearTable,
    setFarm: function (f) { farm = f; }
  };
})();
