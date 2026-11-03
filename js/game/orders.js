// Orders: papan order di desa. Setiap order punya 1 peti. Setor barang ke peti -> langsung dibayar.
// Format order SAMA dengan order pemain sungguhan nanti (server tinggal mengisi poster = nama pemain).
var Orders = (function () {
  var N = 3, LIFE = 15 * 60 * 1000;
  var slots = [null, null, null];
  var respawnAt = [0, 0, 0];
  var seq = 0;

  var POSTERS = ['Pak Budi', 'Bu Sari', 'Pak Joko', 'Mbak Ayu', 'Pak Dedi', 'Bu Rina'];
  var POOL = [
    { id: 'wood', min: 10, max: 20 }, { id: 'pebble', min: 10, max: 20 }, { id: 'stone', min: 5, max: 10 },
    { id: 'meat', min: 3, max: 6 }, { id: 'ironore', min: 3, max: 6 }, { id: 'iron', min: 2, max: 4 },
    { id: 'gold', min: 1, max: 3 }
  ];

  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  function make(now) {
    var d = POOL[Math.floor(Math.random() * POOL.length)];
    var qty = rnd(d.min, d.max);
    var base = Economy.base(d.id);
    var unit = Math.max(base + 1, Math.round(base * (1.5 + Math.random() * 0.4)));   // lebih mahal dari NPC
    return {
      id: 'o' + (++seq),
      poster: POSTERS[Math.floor(Math.random() * POSTERS.length)],
      item: d.id, qty: qty, filled: 0, paid: 0,
      unit: unit, price: unit * qty,        // price = uang yang ditahan (escrow)
      expireAt: now + LIFE
    };
  }

  function init() {
    var now = Date.now();
    for (var i = 0; i < N; i++) slots[i] = make(now);
  }

  function update(now) {
    for (var i = 0; i < N; i++) {
      var o = slots[i];
      if (o && now >= o.expireAt) { slots[i] = null; respawnAt[i] = now + 8000; }   // kedaluwarsa
      if (!slots[i] && now >= respawnAt[i]) slots[i] = make(now);
    }
  }

  function chestIndex(x, y) {
    var c = World.VILLAGE.chests;
    for (var i = 0; i < c.length; i++) if (c[i][0] === x && c[i][1] === y) return i;
    return -1;
  }

  // Setor barang dari tas ke peti nomor i. Bayar sebanding jumlah yang disetor.
  function deposit(i, inv) {
    var o = slots[i];
    if (!o) return { none: true };
    var it = Bag.find(o.item);
    var n = Math.min(inv[o.item] || 0, o.qty - o.filled);
    if (n <= 0) return { missing: true, name: it ? it.name : o.item };
    inv[o.item] -= n;
    var filled = o.filled + n;
    var done = filled >= o.qty;
    var pay = done ? o.price - o.paid : Math.floor(o.price * filled / o.qty) - o.paid;
    o.filled = filled;
    o.paid += pay;
    if (done) { slots[i] = null; respawnAt[i] = Date.now() + 8000; }
    return { n: n, pay: pay, done: done, name: it ? it.name : o.item };
  }

  return { slots: slots, init: init, update: update, chestIndex: chestIndex, deposit: deposit };
})();
