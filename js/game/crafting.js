// Crafting: resep, stasiun (tangan / meja kerja), cek bahan, dan pembuatan
var Crafting = (function () {
  var NAMES = { wood: 'Kayu', stone: 'Batu', pebble: 'Kerikil', gold: 'Emas', iron: 'Besi' };

  // at: 'hand' = bisa di mana saja, 'table' = harus dekat meja kerja
  // type: 'tool' = alat sekali buat | 'item' = masuk tas (bisa banyak) | 'place' = langsung dipasang di tanah
  var RECIPES = [
    { id: 'table',    name: 'Meja kerja',   at: 'table', type: 'item', note: 'Masuk tas. Pegang lalu AKSI untuk memasang di mana saja, jadi bisa dibawa', cost: { wood: 6, pebble: 2 } },
    { id: 'axe',      name: 'Kapak batu',   at: 'table', type: 'tool', note: 'Tebang pohon & serang lebih kuat', cost: { wood: 2, pebble: 3 } },
    { id: 'pickaxe',  name: 'Beliung batu', at: 'table', type: 'tool', note: 'Wajib untuk batu besar dan bijih besi', cost: { wood: 3, pebble: 4 } },
    { id: 'pan',      name: 'Dulang emas',  at: 'table', type: 'tool', note: 'Wajib untuk emas sungai', cost: { wood: 4 } },
    { id: 'hoe',      name: 'Cangkul',      at: 'table', type: 'tool', note: 'Menggali tanah di lahanmu untuk menanam', cost: { wood: 4, pebble: 3 } },
    { id: 'can',      name: 'Gembor',       at: 'table', type: 'tool', note: 'Menyiram tanaman. Isi dari air atau sumur', cost: { wood: 3, stone: 3 } },
    { id: 'sign',     name: 'Papan tulis',  at: 'table', type: 'item', note: 'Dipasang di lahanmu, bisa ditulisi (maks 40 huruf)', cost: { wood: 3 } },
    { id: 'oboard',   name: 'Papan order',  at: 'table', type: 'item', note: 'Dipasang di lahanmu bersama 3 peti. Kamu bayar, pemain lain mengirim barang', cost: { wood: 10, pebble: 6 } },
    { id: 'furnace',  name: 'Tungku batu',  at: 'table', type: 'item', note: 'Masuk tas. Pegang lalu AKSI untuk memasang. Tungku: bijih besi + kayu = besi', cost: { stone: 8, wood: 4 } },
    { id: 'bed',      name: 'Kasur',        at: 'table', type: 'item', note: 'Pasang di dunia luar. AKSI pada kasur = titik kembali saat pingsan', cost: { wood: 8, meat: 2 } },
    { id: 'iaxe',     name: 'Kapak besi',   at: 'table', type: 'tool', note: 'Paling kuat untuk pohon dan hewan', cost: { wood: 2, iron: 3 } },
    { id: 'ipickaxe', name: 'Beliung besi', at: 'table', type: 'tool', note: 'Menambang batu dan bijih paling cepat', cost: { wood: 3, iron: 3 } }
  ];

  function has(r, inv) { return r.type === 'tool' && inv[r.id] > 0; }

  // ctx.table = true bila ada meja kerja di dekat pemain
  function canCraft(r, inv, ctx) {
    if (has(r, inv)) return false;
    if (r.at === 'table' && !(ctx && ctx.table)) return false;
    for (var k in r.cost) if ((inv[k] || 0) < r.cost[k]) return false;
    // pastikan hasilnya masih muat di tas
    var sim = {};
    for (var j in inv) sim[j] = inv[j];
    for (k in r.cost) sim[k] -= r.cost[k];
    if (r.type === 'tool') sim[r.id] = 1;
    else if (r.type === 'item') sim[r.id] = (sim[r.id] || 0) + 1;
    return Bag.used(sim) <= Bag.CAP;
  }

  function craft(r, inv, ctx) {
    if (!canCraft(r, inv, ctx)) return false;
    for (var k in r.cost) inv[k] -= r.cost[k];
    if (r.type === 'tool') inv[r.id] = 1;
    else if (r.type === 'item') inv[r.id] = (inv[r.id] || 0) + 1;
    return true;
  }

  function costText(r, inv) {
    var out = [];
    for (var k in r.cost) out.push(NAMES[k] + ' ' + (inv[k] || 0) + '/' + r.cost[k]);
    return out.join(', ');
  }

  return { RECIPES: RECIPES, canCraft: canCraft, craft: craft, has: has, costText: costText };
})();
