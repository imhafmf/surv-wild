// Farm: lahan (petak 8x8), tanah gali, tanaman (tumbuh hanya saat basah), dan pohon buah liar.
// Semua data lokal; bentuknya (kunci "x,y", waktu epoch ms) siap dipindah ke server nanti.
var Farm = (function () {
  var TS = World.TS, T = World.T, O = World.O, S = Plants.PLOT.size;
  var plots = {};      // "i,j" -> 1  (petak milik pemain)
  var soil = {};       // "x,y" -> waktu basah sampai (ms); 0 = kering
  var plants = {};     // "x,y" -> {k, g (detik tumbuh), u (update terakhir ms), m (pernah matang)}
  var signs = {};      // "x,y" -> teks papan (milik pemain, di lahannya)
  var pboards = {};    // "x,y" -> {orders:[o|null x3]}  papan order milik pemain (3 order, 3 peti otomatis)
  var pchests = {};    // "x,y" -> "bx,by,i"
  var wildT = {};      // "x,y" -> waktu buah liar siap lagi (ms), tidak disimpan

  function key(x, y) { return x + ',' + y; }

  function advance(pl, k, now) {
    var w = soil[k];
    if (w > pl.u) {
      var to = now < w ? now : w;
      if (to > pl.u) pl.g += (to - pl.u) / 1000;
    }
    pl.u = now;
    var P = Plants.BY[pl.k];
    if (pl.g >= P.T - 0.05) { pl.g = P.T; pl.m = true; }      // toleransi pembulatan desimal
  }

  // dipanggil World.objectAt (lapisan luar)
  function objAt(x, y, now) {
    var k = x + ',' + y, pl = plants[k];
    if (signs[k] !== undefined) return O.SIGN;
    if (pboards[k]) return O.PBOARD;
    if (pchests[k]) return O.PCHEST;
    if (pl) {
      advance(pl, k, now);
      return (pl.m && Plants.BY[pl.k].tree) ? O.FTREE : O.PLANT;
    }
    return soil[k] !== undefined ? O.SOIL : 0;
  }

  function isWet(x, y, now) { var w = soil[key(x, y)]; return w !== undefined && w > now; }

  function wildKind(x, y) { return Plants.WILD[(World.hash(x, y, 42) * Plants.WILD.length) | 0]; }

  // info untuk gambar: {k, stage 0..2, ready}
  function info(x, y, now) {
    var k = key(x, y), pl = plants[k];
    if (pl) {
      advance(pl, k, now);
      var P = Plants.BY[pl.k], ready = pl.g >= P.T;
      var stage = (P.tree && pl.m) ? 2 : (ready ? 2 : (pl.g / P.T < 0.4 ? 0 : 1));
      return { k: pl.k, stage: stage, ready: ready, wet: isWet(x, y, now) };
    }
    var kind = wildKind(x, y);
    return { k: kind, stage: 2, ready: (wildT[k] || 0) <= now, wet: false };
  }

  // ---- lahan ----
  function plotOf(x, y) { return { i: Math.floor(x / S), j: Math.floor(y / S) }; }
  function owned(x, y) { return !!plots[Math.floor(x / S) + ',' + Math.floor(y / S)]; }

  // petak valid dibeli? {ok, why}
  function plotCheck(i, j) {
    if (plots[i + ',' + j]) return { ok: false, why: 'Petak ini sudah milikmu' };
    var x0 = i * S, y0 = j * S, x1 = x0 + S - 1, y1 = y0 + S - 1, V = World.VILLAGE, M = 3, R = World.WORLD_R - 12;
    if (Math.max(Math.abs(x0), Math.abs(x1), Math.abs(y0), Math.abs(y1)) > R) return { ok: false, why: 'Terlalu dekat tepi dunia' };
    if (!(x1 < V.x0 - M || x0 > V.x1 + M || y1 < V.y0 - M || y0 > V.y1 + M)) return { ok: false, why: 'Desa tidak dijual, cari di luar pagar' };
    var land = 0;
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var t = World.tileAt(x, y);
      if (t === T.GRASS || t === T.FOREST || t === T.SAND) land++;
    }
    if (land < 40) return { ok: false, why: 'Terlalu banyak air/batu di petak ini' };
    return { ok: true, why: '' };
  }

  function claim(x, y) {
    var pc = plotOf(x, y), c = plotCheck(pc.i, pc.j);
    if (!c.ok) return c;
    plots[pc.i + ',' + pc.j] = 1;
    return { ok: true, why: 'Lahan ' + S + 'x' + S + ' menjadi milikmu!' };
  }

  function plotList() {
    var out = [];
    for (var k in plots) { var a = k.split(','); out.push([+a[0], +a[1]]); }
    return out;
  }

  // ---- aksi ----
  function till(x, y) {
    if (!owned(x, y)) return { ok: false, msg: 'Bukan lahanmu. Beli sertifikat di toko' };
    var t = World.tileAt(x, y);
    if (t !== T.GRASS && t !== T.FOREST && t !== T.SAND) return { ok: false, msg: 'Tidak bisa digali di sini' };
    if (World.objectAt(x, y) !== O.NONE) return { ok: false, msg: 'Ada penghalang di tanah ini' };
    soil[key(x, y)] = 0;
    return { ok: true, msg: 'Tanah digali' };
  }

  function plant(x, y, seedId, inv) {
    var k = key(x, y), pid = seedId.slice(1);
    if (soil[k] === undefined) return { ok: false, msg: 'Gali dulu dengan cangkul' };
    if (plants[k]) return { ok: false, msg: 'Sudah ada tanaman' };
    if (!Plants.BY[pid] || (inv[seedId] || 0) < 1) return { ok: false, msg: 'Tidak ada benih' };
    inv[seedId]--;
    plants[k] = { k: pid, g: 0, u: Date.now(), m: false };
    return { ok: true, msg: Plants.BY[pid].name + ' ditanam. Siram!' };
  }

  // P = Player.state (P.can = isi gembor 0..8)
  function water(x, y, P) {
    var k = key(x, y);
    if (soil[k] === undefined) return { ok: false, msg: 'Siram tanaman atau tanah galian' };
    if ((P.can || 0) < 1) return { ok: false, msg: 'Gembor kosong, isi di air' };
    P.can--;
    var now = Date.now();
    if (plants[k]) advance(plants[k], k, now);
    soil[k] = now + Plants.PLOT.wet * 1000;
    return { ok: true, msg: 'Disiram (sisa ' + P.can + ')' };
  }

  function seedChance(inv, k, p) {
    if (Math.random() < p && Bag.canAdd(inv, 's' + k, 1)) { Bag.add(inv, 's' + k, 1); return ' + benih!'; }
    return '';
  }

  function harvest(x, y, inv) {
    var k = key(x, y), now = Date.now(), pl = plants[k], P, got;
    if (pl) {
      advance(pl, k, now);
      P = Plants.BY[pl.k];
      if (pl.g < P.T) {
        var pc = Math.floor(pl.g / P.T * 100);
        return { ok: false, msg: P.name + ' ' + pc + '%' + (isWet(x, y, now) ? '' : ' (perlu disiram)') };
      }
      if (!Bag.canAdd(inv, P.id, P.qty)) return { ok: false, msg: 'Tas penuh!' };
      got = Bag.add(inv, P.id, P.qty);
      if (P.tree) { pl.g = P.T - P.re; pl.u = now; } else delete plants[k];
      return { ok: true, msg: '+' + got + ' ' + P.name + seedChance(inv, P.id, 0.15) };
    }
    if (soil[k] !== undefined) return { ok: false, msg: 'Tanah siap tanam. Pegang benih lalu AKSI' };
    // pohon buah liar
    P = Plants.BY[wildKind(x, y)];
    if ((wildT[k] || 0) > now) return { ok: false, msg: 'Buah ' + P.name + ' belum matang' };
    if (!Bag.canAdd(inv, P.id, P.qty)) return { ok: false, msg: 'Tas penuh!' };
    got = Bag.add(inv, P.id, P.qty);
    wildT[k] = now + P.re * 1000;
    return { ok: true, msg: '+' + got + ' ' + P.name + seedChance(inv, P.id, 0.2) };
  }

  // ---- papan tulis ----
  function placeSign(x, y) {
    if (!owned(x, y)) return { ok: false, msg: 'Papan hanya bisa dipasang di lahanmu' };
    var t = World.tileAt(x, y);
    if (t === T.WATER || t === T.ROCK) return { ok: false, msg: 'Tidak bisa dipasang di sini' };
    if (World.objectAt(x, y) !== O.NONE) return { ok: false, msg: 'Ada penghalang di sini' };
    signs[key(x, y)] = '';
    return { ok: true, msg: 'Papan dipasang' };
  }
  function signText(x, y) { var v = signs[key(x, y)]; return v === undefined ? null : v; }
  function setSign(x, y, text) { var k = key(x, y); if (signs[k] !== undefined) signs[k] = String(text || '').slice(0, 40); }
  function removeSign(x, y) { var k = key(x, y); if (signs[k] === undefined) return false; delete signs[k]; return true; }
  function signList() {
    var out = [];
    for (var k in signs) { var a = k.split(','); out.push([+a[0], +a[1], signs[k]]); }
    return out;
  }

  // ---- papan order milik pemain: 1 papan = 3 order + 3 peti (otomatis di bawahnya) ----
  var ORDER_LIFE = 24 * 3600 * 1000;
  function chestTiles(bx, by) { return [[bx - 1, by + 1], [bx, by + 1], [bx + 1, by + 1]]; }

  function placeBoard(x, y) {
    var tiles = [[x, y]].concat(chestTiles(x, y));
    for (var i = 0; i < tiles.length; i++) {
      var tx = tiles[i][0], ty = tiles[i][1], t = World.tileAt(tx, ty);
      if (!owned(tx, ty)) return { ok: false, msg: 'Papan + 3 peti harus muat di lahanmu' };
      if (t === T.WATER || t === T.ROCK || World.objectAt(tx, ty) !== O.NONE) return { ok: false, msg: 'Ada penghalang: butuh 3 petak kosong di bawah papan' };
    }
    var bk = key(x, y), ct = chestTiles(x, y);
    pboards[bk] = { orders: [null, null, null] };
    for (i = 0; i < 3; i++) pchests[key(ct[i][0], ct[i][1])] = bk + ',' + i;
    return { ok: true, msg: 'Papan order dipasang dengan 3 peti' };
  }
  function boardData(bk) { return pboards[bk] || null; }
  function chestBoard(x, y) { var v = pchests[key(x, y)]; if (!v) return null; var a = v.split(','); return { key: a[0] + ',' + a[1], i: +a[2] }; }

  // order kedaluwarsa: sisa uang kembali (barang yang sudah masuk tetap bisa diambil)
  function settle(o, P) {
    if (o.closed) return;
    o.closed = true; P.money += o.escrow; o.escrow = 0; o.qty = o.filled;
  }
  function tick(P, now) {
    for (var bk in pboards) for (var i = 0; i < 3; i++) {
      var o = pboards[bk].orders[i];
      if (o && !o.closed && now > o.exp) settle(o, P);
      if (o && o.closed && o.taken >= o.filled) pboards[bk].orders[i] = null;
    }
  }
  function postOrder(bk, i, item, qty, unit, P) {
    var b = pboards[bk];
    if (!b || !(i >= 0 && i < 3)) return { ok: false, msg: 'Papan tidak ada' };
    if (b.orders[i]) return { ok: false, msg: 'Slot order ini sudah terisi' };
    var base = Economy.base(item);
    qty = Math.floor(qty); unit = Math.floor(unit);
    if (!base) return { ok: false, msg: 'Barang ini tidak bisa diorder' };
    if (!(qty >= 1 && qty <= 200)) return { ok: false, msg: 'Jumlah 1 sampai 200' };
    if (!(unit >= base && unit <= base * 4)) return { ok: false, msg: 'Harga ' + base + ' sampai ' + base * 4 + ' per buah' };
    var cost = qty * unit;
    if (P.money < cost) return { ok: false, msg: 'Uang kurang (butuh ' + cost + ')' };
    P.money -= cost;
    b.orders[i] = { item: item, qty: qty, unit: unit, filled: 0, taken: 0, escrow: cost, exp: Date.now() + ORDER_LIFE, closed: false };
    return { ok: true, msg: 'Order dipasang, ' + cost + ' koin ditahan' };
  }
  function cancelOrder(bk, i, P) {
    var o = pboards[bk] && pboards[bk].orders[i];
    if (!o) return { ok: false, msg: 'Tidak ada order' };
    settle(o, P);
    if (o.taken >= o.filled) pboards[bk].orders[i] = null;
    return { ok: true, msg: 'Order dibatalkan, uang kembali' };
  }
  function collect(bk, i, inv) {
    var o = pboards[bk] && pboards[bk].orders[i];
    if (!o) return { ok: false, msg: 'Tidak ada order' };
    var n = Math.min(o.filled - o.taken, 1e9), got = 0;
    for (var k = 0; k < n; k++) { if (Bag.add(inv, o.item, 1) < 1) break; got++; }
    o.taken += got;
    if (o.closed && o.taken >= o.filled) pboards[bk].orders[i] = null;
    return { ok: got > 0, msg: got ? '+' + got + ' ' + Bag.find(o.item).name : (n ? 'Tas penuh!' : 'Belum ada barang') };
  }
  // Pemain LAIN mengisi peti: mereka dibayar dari uang yang ditahan. Dipakai server (tahap 2); offline tidak ada pemain lain.
  function fillOrder(bk, i, n, filler) {
    var o = pboards[bk] && pboards[bk].orders[i];
    if (!o || o.closed || Date.now() > o.exp) return { ok: false, n: 0, pay: 0 };
    n = Math.max(0, Math.min(Math.floor(n), o.qty - o.filled));
    var pay = n * o.unit;
    o.filled += n; o.escrow -= pay;
    return { ok: true, n: n, pay: pay };
  }
  function removeBoard(bk, inv) {
    var b = pboards[bk];
    if (!b) return { ok: false, msg: 'Papan tidak ada' };
    for (var i = 0; i < 3; i++) if (b.orders[i]) return { ok: false, msg: 'Batalkan dan ambil semua order dulu' };
    if (!Bag.canAdd(inv, 'oboard', 1)) return { ok: false, msg: 'Tas penuh!' };
    var a = bk.split(','), ct = chestTiles(+a[0], +a[1]);
    for (i = 0; i < 3; i++) delete pchests[key(ct[i][0], ct[i][1])];
    delete pboards[bk];
    Bag.add(inv, 'oboard', 1);
    return { ok: true, msg: 'Papan diambil' };
  }

  function reset() { plots = {}; soil = {}; plants = {}; signs = {}; pboards = {}; pchests = {}; wildT = {}; }
  function serialize() { return { plots: plots, soil: soil, plants: plants, signs: signs, pboards: pboards, pchests: pchests }; }
  function restore(o) {
    reset();
    if (!o || typeof o !== 'object') return;
    if (o.plots && typeof o.plots === 'object') plots = o.plots;
    if (o.soil && typeof o.soil === 'object') soil = o.soil;
    if (o.pboards && o.pchests && typeof o.pboards === 'object' && typeof o.pchests === 'object') {
      for (var bk in o.pboards) {
        var ob = o.pboards[bk];
        if (!ob || !Array.isArray(ob.orders) || ob.orders.length !== 3) continue;
        var orders = ob.orders.map(function (q) {
          return (q && Bag.find(q.item) && typeof q.qty === 'number' && typeof q.unit === 'number')
            ? { item: q.item, qty: q.qty, unit: q.unit, filled: +q.filled || 0, taken: +q.taken || 0, escrow: +q.escrow || 0, exp: +q.exp || 0, closed: !!q.closed } : null;
        });
        pboards[bk] = { orders: orders };
      }
      for (var ck in o.pchests) if (typeof o.pchests[ck] === 'string' && pboards[o.pchests[ck].split(',').slice(0, 2).join(',')]) pchests[ck] = o.pchests[ck];
    }
    if (o.signs && typeof o.signs === 'object') for (var sk in o.signs) if (typeof o.signs[sk] === 'string') signs[sk] = o.signs[sk].slice(0, 40);
    if (o.plants && typeof o.plants === 'object') {
      for (var k in o.plants) {
        var q = o.plants[k];
        if (q && Plants.BY[q.k] && typeof q.g === 'number') plants[k] = { k: q.k, g: q.g, u: q.u || Date.now(), m: !!q.m };
      }
    }
  }

  World.setFarm({ objAt: objAt });

  return { objAt: objAt, info: info, isWet: isWet, owned: owned, plotOf: plotOf, plotCheck: plotCheck, claim: claim, plotList: plotList,
           till: till, plant: plant, placeBoard: placeBoard, boardData: boardData, chestBoard: chestBoard, postOrder: postOrder, cancelOrder: cancelOrder, collect: collect, fillOrder: fillOrder, removeBoard: removeBoard, tickBoards: tick, placeSign: placeSign, signText: signText, setSign: setSign, removeSign: removeSign, signList: signList, water: water, harvest: harvest, reset: reset, serialize: serialize, restore: restore, SIZE: S };
})();
