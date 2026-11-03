// Economy: harga NPC. NPC selalu mau membeli (harga dasar), tapi harga turun kalau kamu menjual terlalu banyak.
// Order pemain/papan membayar lebih mahal daripada harga dasar ini.
var Economy = (function () {
  var BUY  = { wood: 3, stone: 5, pebble: 1, gold: 40, ironore: 10, iron: 22, meat: 7, bread: 5 };
  (function () { for (var i = 0; i < Plants.LIST.length; i++) BUY[Plants.LIST[i].id] = Plants.LIST[i].price; })(); // NPC membeli dari pemain
  var SELL = { bread: 12, bottle: 6, sjagung: 3, deed: Plants.PLOT.cost };                                                                        // NPC menjual ke pemain
  var sold = {};   // jumlah yang baru dijual per item (pulih 1 per 15 detik)

  function base(id) { return BUY[id] || 0; }

  function buyPrice(id) {
    var b = BUY[id];
    if (!b) return 0;
    var f = 1 - Math.min(0.5, (sold[id] || 0) * 0.025);   // turun sampai 50%
    return Math.max(1, Math.round(b * f));
  }

  function sellPrice(id) { return SELL[id] || 0; }

  // Pemain menjual qty item ke NPC. Mengembalikan {n, earn}
  function sell(inv, id, qty) {
    var n = Math.min(qty, inv[id] || 0), earn = 0;
    for (var i = 0; i < n; i++) {
      earn += buyPrice(id);
      sold[id] = (sold[id] || 0) + 1;
    }
    inv[id] -= n;
    return { n: n, earn: earn };
  }

  function update(dt) {
    for (var k in sold) {
      sold[k] = Math.max(0, sold[k] - dt / 15);
    }
  }

  return { SELL: SELL, base: base, buyPrice: buyPrice, sellPrice: sellPrice, sell: sell, update: update };
})();
