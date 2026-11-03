// Skin: tampilan karakter (disimpan di data simpan). Warna kulit, rambut, model rambut, baju, celana.
var Skin = (function () {
  var OPTS = [
    { k: 'sk', label: 'Warna kulit',  cols: ['#f0c8a0', '#e0a878', '#c58a5c', '#9a6440', '#6e4428'] },
    { k: 'hr', label: 'Warna rambut', cols: ['#2a1a10', '#4a2f1a', '#8a5a2a', '#d8b050', '#b03a30', '#8a8a92', '#3a5a9a'] },
    { k: 'hs', label: 'Model rambut', cols: ['Pendek', 'Panjang', 'Topi', 'Jambul'], text: true },
    { k: 'sh', label: 'Baju',         cols: ['#3a4a8a', '#a83a3a', '#3a8a4a', '#d8a030', '#7a4a9a', '#e8e8e8', '#2a2a30'] },
    { k: 'pn', label: 'Celana',       cols: ['#2a2a40', '#4a3a2a', '#3a5a3a', '#5a5a64', '#7a2a2a'] }
  ];
  var v = { sk: 0, hr: 1, hs: 0, sh: 0, pn: 0 };

  function get() {
    return { skin: OPTS[0].cols[v.sk], hair: OPTS[1].cols[v.hr], style: v.hs, shirt: OPTS[3].cols[v.sh], pants: OPTS[4].cols[v.pn] };
  }
  function toArray() { return [v.sk, v.hr, v.hs, v.sh, v.pn]; }
  // warna dari larik [kulit, rambut, model, baju, celana] (pemain lain, dari server)
  function fromArray(a) {
    var r = [0, 1, 2, 3, 4].map(function (i, n) { var x = a && a[n]; return (Number.isInteger(x) && x >= 0 && x < OPTS[i].cols.length) ? x : 0; });
    return { skin: OPTS[0].cols[r[0]], hair: OPTS[1].cols[r[1]], style: r[2], shirt: OPTS[3].cols[r[3]], pants: OPTS[4].cols[r[4]] };
  }
  function cycle(k) {
    for (var i = 0; i < OPTS.length; i++) if (OPTS[i].k === k) v[k] = (v[k] + 1) % OPTS[i].cols.length;
  }
  function serialize() { return { sk: v.sk, hr: v.hr, hs: v.hs, sh: v.sh, pn: v.pn }; }
  function restore(o) {
    if (!o || typeof o !== 'object') return;
    for (var i = 0; i < OPTS.length; i++) {
      var k = OPTS[i].k;
      if (typeof o[k] === 'number' && o[k] >= 0 && o[k] < OPTS[i].cols.length) v[k] = o[k] | 0;
    }
  }
  function render(box) {
    var h = '<h2>Karakter</h2><canvas id="skprev" width="24" height="24"></canvas>';
    for (var i = 0; i < OPTS.length; i++) {
      var o = OPTS[i], c = o.cols[v[o.k]];
      h += '<button class="opt" data-sk="' + o.k + '"><span>' + o.label + '</span><b>' +
           (o.text ? c : '<i class="sw" style="background:' + c + '"></i>') + '</b></button>';
    }
    h += '<button id="kBack">Selesai</button>';
    box.innerHTML = h;
    preview();
  }
  function preview() {
    var c = document.getElementById('skprev');
    if (!c || !Renderer.drawPlayerTo) return;
    var g = c.getContext('2d');
    g.clearRect(0, 0, 24, 24);
    Renderer.drawPlayerTo(g, 12, 22, { dx: 0, dy: 1, walkT: 0, hurt: 0 }, get());
  }
  return { get: get, toArray: toArray, fromArray: fromArray, cycle: cycle, serialize: serialize, restore: restore, render: render, preview: preview, OPTS: OPTS };
})();
