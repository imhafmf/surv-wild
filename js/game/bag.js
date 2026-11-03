// Bag: tas 9x3 = 27 slot. Resource menumpuk maks 50 per slot, alat 1 per slot.
// Data tetap disimpan sebagai jumlah per item di Player.state.inv; tas hanya menghitung slot.
// eat/drink = item yang bisa dipakai lewat AKSI (hotbar bulat). tool = alat (1 slot, tidak menumpuk).
// hold = bisa dipegang & dipasang (meja, tungku). Hanya tool/hold/eat/drink yang otomatis masuk hotbar.
var Bag = (function () {
  var COLS = 9, ROWS = 3, CAP = COLS * ROWS, STACK = 50;

  var ITEMS = [
    { id: 'wood',     name: 'Kayu',         short: 'Kayu',   color: '#8b5a2b', note: 'Bahan dasar alat dan bangunan' },
    { id: 'stone',    name: 'Batu',         short: 'Batu',   color: '#8c8982', note: 'Dari batu besar di gunung. Untuk tungku' },
    { id: 'pebble',   name: 'Kerikil',      short: 'Krikil', color: '#b5b2ab', note: 'Bahan membuat alat batu' },
    { id: 'gold',     name: 'Emas',         short: 'Emas',   color: '#e6b422', note: 'Emas aluvial dari sungai' },
    { id: 'ironore',  name: 'Bijih besi',   short: 'Bijih',  color: '#c0703c', note: 'Lebur di tungku jadi besi' },
    { id: 'table',    name: 'Meja kerja',   short: 'Meja',   color: '#a0703c', stack: 4, hold: true, note: 'Pegang lalu AKSI untuk memasang. Meja pasanganmu bisa diambil lagi dari panel meja' },
    { id: 'bed',      name: 'Kasur',        short: 'Kasur',  color: '#c0504d', stack: 2, hold: true, note: 'Pegang lalu AKSI untuk memasang. Dekati kasur, AKSI: jadikan titik kembali saat pingsan' },
    { id: 'furnace',  name: 'Tungku batu',  short: 'Tungku', color: '#6a625a', stack: 4, hold: true, note: 'Pegang lalu AKSI untuk memasang. Dekati tungku, AKSI: bijih besi + kayu = besi' },
    { id: 'meat',     name: 'Daging',       short: 'Daging', color: '#c0504d', eat: 30,   note: 'Pegang lalu AKSI untuk makan (+30 lapar)' },
    { id: 'bread',    name: 'Roti',         short: 'Roti',   color: '#d9a45b', eat: 40,   note: 'Pegang lalu AKSI untuk makan (+40 lapar)' },
    { id: 'bottle',   name: 'Air botol',    short: 'Botol',  color: '#7ec8e8', drink: 40, note: 'Pegang lalu AKSI untuk minum (+40 haus)' },
    { id: 'iron',     name: 'Besi',         short: 'Besi',   color: '#c8ccd0', note: 'Bahan alat besi' },
    { id: 'axe',      name: 'Kapak batu',   short: 'Kapak',  color: '#9a7a52', tool: true, note: 'Pegang untuk menebang pohon dan menyerang hewan' },
    { id: 'pickaxe',  name: 'Beliung batu', short: 'Beliung', color: '#7a7670', tool: true, note: 'Pegang untuk menambang batu besar dan bijih besi' },
    { id: 'pan',      name: 'Dulang emas',  short: 'Dulang', color: '#d8b050', tool: true, note: 'Pegang untuk mengambil emas sungai' },
    { id: 'iaxe',     name: 'Kapak besi',   short: 'Kpk.Fe', color: '#aab4c0', tool: true, note: 'Paling kuat untuk pohon dan hewan' },
    { id: 'ipickaxe', name: 'Beliung besi', short: 'Blg.Fe', color: '#8fa0b0', tool: true, note: 'Menambang paling cepat' },
    { id: 'hoe',      name: 'Cangkul',      short: 'Cangkul', color: '#a08060', tool: true, note: 'Pegang lalu AKSI di tanah lahanmu untuk menggali petak tanam' },
    { id: 'can',      name: 'Gembor',       short: 'Gembor', color: '#6fa0c8', tool: true, note: 'Isi di air/sumur (AKSI ke air), lalu AKSI ke tanaman untuk menyiram' },
    { id: 'sign',     name: 'Papan tulis',  short: 'Papan',  color: '#b88a50', stack: 10, hold: true, note: 'Pegang lalu AKSI di lahanmu untuk memasang. AKSI di papan untuk menulis' },
    { id: 'oboard',   name: 'Papan order',  short: 'P.Order', color: '#9a6a36', stack: 4, hold: true, note: 'Pegang lalu AKSI di lahanmu: terpasang bersama 3 peti. 1 papan = maks 3 order' },
    { id: 'deed',     name: 'Sertifikat lahan', short: 'Lahan', color: '#e8d8a0', stack: 4, hold: true, note: 'Pegang lalu AKSI di luar desa untuk memiliki petak ' + Plants.PLOT.size + 'x' + Plants.PLOT.size }
  ];
  // buah/hasil panen + benihnya dibuat dari data Plants
  (function () {
    for (var i = 0; i < Plants.LIST.length; i++) {
      var pl = Plants.LIST[i], it = { id: pl.id, name: pl.name, short: pl.name.length > 6 ? pl.name.slice(0, 6) : pl.name, color: pl.col,
                                      note: 'Hasil panen. Jual ke penjual desa' };
      if (pl.eat) { it.eat = pl.eat; it.note = 'Pegang lalu AKSI untuk makan (+' + pl.eat + ' lapar)'; }
      if (pl.drink) { it.drink = pl.drink; it.note = 'Pegang lalu AKSI untuk minum (+' + pl.drink + ' haus)'; }
      ITEMS.push(it);
    }
    for (i = 0; i < Plants.LIST.length; i++) {
      pl = Plants.LIST[i];
      ITEMS.push({ id: 's' + pl.id, name: 'Benih ' + pl.name.replace('Biji ', '').replace('Buah ', '').toLowerCase(), short: 'Bn.' + pl.id.slice(0, 4), color: pl.col, seed: pl.id,
                   note: 'Pegang lalu AKSI di tanah yang sudah digali (di lahanmu). Siram agar tumbuh' });
    }
  })();

  function slotsOf(item, c) {
    if (c <= 0) return 0;
    return item.tool ? 1 : Math.ceil(c / (item.stack || STACK));
  }

  function used(inv) {
    var n = 0;
    for (var i = 0; i < ITEMS.length; i++) n += slotsOf(ITEMS[i], inv[ITEMS[i].id] || 0);
    return n;
  }

  // Bisakah qty item ditambah tanpa melewati 27 slot?
  function canAdd(inv, id, qty) {
    var c = inv[id] || 0;
    inv[id] = c + qty;
    var ok = used(inv) <= CAP;
    inv[id] = c;
    return ok;
  }

  // Tambah item sebanyak muat. Mengembalikan jumlah yang berhasil masuk.
  function add(inv, id, qty) {
    var added = 0;
    for (var i = 0; i < qty; i++) {
      inv[id] = (inv[id] || 0) + 1;
      if (used(inv) > CAP) { inv[id]--; break; }
      added++;
    }
    return added;
  }

  // Daftar slot terisi, urut sesuai ITEMS
  function slots(inv) {
    var out = [];
    for (var i = 0; i < ITEMS.length; i++) {
      var it = ITEMS[i], c = inv[it.id] || 0;
      if (c <= 0) continue;
      if (it.tool) { out.push({ item: it, count: 1 }); continue; }
      while (c > 0) {
        var n = Math.min(c, it.stack || STACK);
        out.push({ item: it, count: n });
        c -= n;
      }
    }
    return out;
  }

  function find(id) {
    for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === id) return ITEMS[i];
    return null;
  }

  // Makanan/minuman masuk slot bulat, sisanya slot kotak
  function isConsumable(id) { var it = find(id); return !!(it && (it.eat || it.drink)); }

  function autoHotbar(id) { var it = find(id); return !!(it && (it.tool || it.hold || it.eat || it.drink)); }

  return { find: find, isConsumable: isConsumable, autoHotbar: autoHotbar, COLS: COLS, ROWS: ROWS, CAP: CAP, STACK: STACK, ITEMS: ITEMS,
           used: used, canAdd: canAdd, add: add, slots: slots };
})();
