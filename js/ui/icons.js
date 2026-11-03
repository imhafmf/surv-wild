// Icons: ikon pixel 16x16 per item, digambar sekali lewat kode (tanpa file gambar), dipakai tas, hotbar, crafting, toko.
var Icons = (function () {
  var cache = {};
  var D = {};   // id -> function (R, disc, line)

  function wood(R) { R('#5a3a1e', 2, 10, 12, 4); R('#8b5a2b', 2, 7, 12, 4); R('#6a4220', 2, 9, 12, 1); R('#d2a86a', 2, 7, 3, 4); R('#8b5a2b', 3, 8, 1, 2); R('#a0703c', 5, 5, 9, 3); R('#d2a86a', 11, 5, 3, 3); }
  D.wood = wood;
  D.stone = function (R) { R('#5f5d58', 2, 8, 12, 6); R('#8c8982', 3, 5, 10, 7); R('#b0ada6', 5, 6, 4, 2); R('#6e6b65', 10, 10, 3, 3); };
  D.pebble = function (R) { R('#7c7a74', 2, 9, 5, 4); R('#b5b2ab', 3, 9, 3, 2); R('#8c8982', 8, 7, 5, 5); R('#c9c6bf', 9, 7, 3, 2); R('#9a9790', 6, 11, 3, 3); };
  D.gold = function (R) { R('#a87f0a', 3, 9, 6, 5); R('#e6b422', 3, 8, 6, 5); R('#fff3a0', 4, 8, 2, 2); R('#e6b422', 8, 5, 5, 5); R('#fff3a0', 9, 5, 2, 2); R('#a87f0a', 9, 9, 4, 1); };
  D.ironore = function (R) { R('#3d3a36', 2, 7, 12, 7); R('#5a5650', 3, 4, 10, 7); R('#c0703c', 4, 6, 2, 2); R('#c0703c', 9, 8, 3, 2); R('#c0703c', 6, 10, 2, 2); };
  D.iron = function (R) { R('#7a8088', 2, 9, 12, 5); R('#c8ccd0', 3, 6, 11, 5); R('#eef0f2', 4, 6, 8, 1); R('#9aa0a8', 2, 10, 12, 1); };
  D.table = function (R) { R('#5a3a1e', 3, 9, 2, 6); R('#5a3a1e', 11, 9, 2, 6); R('#a0703c', 1, 6, 14, 4); R('#c8955a', 1, 6, 14, 1); R('#9a9790', 4, 2, 4, 4); R('#5a3a1e', 8, 3, 5, 1); };
  D.furnace = function (R) { R('#6a625a', 2, 3, 12, 12); R('#8a8178', 3, 2, 10, 3); R('#1a1410', 4, 8, 8, 6); R('#ff9a2a', 6, 10, 4, 3); R('#ffcc44', 7, 10, 2, 2); };
  D.bed = function (R) { R('#5a3a1e', 1, 11, 2, 4); R('#5a3a1e', 13, 11, 2, 4); R('#8b5a2b', 1, 9, 14, 3); R('#f4efe0', 2, 6, 12, 4); R('#c0504d', 6, 6, 8, 5); R('#e07070', 6, 6, 8, 1); R('#ffffff', 2, 5, 4, 3); R('#d8d0c0', 2, 7, 4, 1); };
  D.meat = function (R) { R('#7a2a2a', 3, 6, 10, 8); R('#c0504d', 3, 5, 10, 7); R('#e08080', 5, 6, 3, 2); R('#f4efe0', 11, 3, 3, 3); R('#f4efe0', 10, 5, 2, 2); };
  D.bread = function (R) { R('#a06a30', 2, 7, 12, 7); R('#d9a45b', 3, 5, 10, 7); R('#f0c882', 4, 5, 8, 2); R('#a06a30', 5, 8, 1, 2); R('#a06a30', 8, 8, 1, 2); R('#a06a30', 11, 8, 1, 2); };
  D.bottle = function (R) { R('#7a5a2a', 6, 1, 4, 2); R('#cfe8f0', 6, 3, 4, 2); R('#4a90b8', 4, 6, 8, 8); R('#7ec8e8', 5, 6, 6, 7); R('#d8f4ff', 5, 7, 2, 4); };

  function handle(R, c) { for (var i = 0; i < 10; i++) R(c, 3 + i, 13 - i, 2, 2); }
  D.axe = function (R) { handle(R, '#6a4220'); R('#8a8e94', 8, 2, 6, 5); R('#c8ccd0', 9, 2, 4, 2); R('#6c7076', 8, 6, 6, 1); };
  D.iaxe = function (R) { handle(R, '#5a3a1e'); R('#aab4c0', 8, 2, 6, 5); R('#eef2f6', 9, 2, 4, 2); R('#7a8694', 8, 6, 6, 1); };
  D.pickaxe = function (R) { handle(R, '#6a4220'); R('#8a8e94', 4, 2, 10, 2); R('#8a8e94', 3, 3, 2, 3); R('#8a8e94', 13, 3, 2, 3); R('#c8ccd0', 5, 2, 6, 1); };
  D.ipickaxe = function (R) { handle(R, '#5a3a1e'); R('#aab4c0', 4, 2, 10, 2); R('#aab4c0', 3, 3, 2, 3); R('#aab4c0', 13, 3, 2, 3); R('#eef2f6', 5, 2, 6, 1); };
  D.pan = function (R) { R('#7a5a1a', 2, 6, 12, 5); R('#d8b050', 3, 5, 10, 5); R('#f0d890', 4, 6, 6, 1); R('#9a7a2a', 4, 10, 8, 2); R('#e6b422', 6, 7, 2, 2); R('#5a3a1e', 12, 3, 3, 2); };
  D.hoe = function (R) { handle(R, '#6a4220'); R('#8a8e94', 9, 2, 6, 2); R('#8a8e94', 9, 2, 2, 5); R('#c8ccd0', 10, 2, 4, 1); };
  D.can = function (R) { R('#3f6f98', 3, 7, 8, 7); R('#6fa0c8', 3, 6, 8, 6); R('#a8d0ec', 4, 6, 2, 4); R('#3f6f98', 11, 4, 1, 4); R('#6fa0c8', 12, 3, 3, 2); R('#6fa0c8', 7, 3, 4, 1); R('#3f6f98', 6, 3, 1, 3); R('#cfe8f0', 14, 5, 1, 2); };
  D.sign = function (R) { R('#5a3a1e', 7, 8, 2, 7); R('#c9a266', 2, 1, 12, 8); R('#8b6b3e', 2, 8, 12, 1); R('#5a3a1e', 4, 3, 8, 1); R('#5a3a1e', 4, 5, 6, 1); };
  D.oboard = function (R) { R('#5a3a1e', 3, 6, 2, 3); R('#5a3a1e', 11, 6, 2, 3); R('#8b6b3e', 1, 1, 14, 7); R('#efe6c8', 3, 2, 4, 3); R('#efe6c8', 9, 3, 4, 4); R('#6a4220', 2, 10, 4, 5); R('#6a4220', 6, 10, 4, 5); R('#6a4220', 10, 10, 4, 5); R('#e6b422', 3, 12, 2, 1); R('#e6b422', 7, 12, 2, 1); R('#e6b422', 11, 12, 2, 1); };
  D.deed = function (R) { R('#b89a58', 3, 2, 10, 12); R('#efe0b0', 3, 2, 10, 11); R('#8a6a30', 5, 4, 6, 1); R('#8a6a30', 5, 6, 6, 1); R('#8a6a30', 5, 8, 4, 1); R('#c03030', 9, 10, 3, 3); R('#e86060', 9, 10, 2, 2); };

  function disc(R, c, cx, cy, r) { for (var y = -r; y <= r; y++) for (var x = -r; x <= r; x++) if (x * x + y * y <= r * r + 1) R(c, cx + x, cy + y, 1, 1); }
  D.jagung = function (R) { R('#3f9a30', 3, 3, 4, 11); R('#5cbf4a', 4, 2, 2, 11); R('#e6c229', 6, 2, 6, 11); R('#fff0a0', 7, 3, 1, 9); R('#c9a010', 10, 3, 1, 9); R('#3f9a30', 11, 8, 3, 6); };
  D.nanas = function (R) { R('#2f8a30', 5, 0, 2, 5); R('#3fb040', 7, 0, 2, 5); R('#2f8a30', 9, 1, 2, 4); R('#c9800a', 3, 5, 10, 10); R('#e8a21a', 4, 5, 8, 9); R('#a86a10', 6, 7, 1, 1); R('#a86a10', 9, 7, 1, 1); R('#a86a10', 7, 10, 1, 1); R('#a86a10', 10, 11, 1, 1); R('#a86a10', 5, 11, 1, 1); };
  D.pisang = function (R) { R('#8a7a10', 3, 5, 3, 7); R('#f4d03f', 4, 4, 3, 9); R('#f4d03f', 6, 10, 6, 3); R('#f4d03f', 11, 6, 3, 6); R('#fff08a', 5, 5, 1, 5); R('#6a4a1a', 4, 3, 2, 2); R('#6a4a1a', 12, 5, 2, 2); R('#c9a010', 7, 12, 5, 1); };
  D.kelapa = function (R) { disc(R, '#5a3a1e', 8, 8, 6); disc(R, '#8a6a3a', 8, 8, 5); R('#c9a66b', 5, 5, 3, 2); R('#3a2410', 6, 9, 1, 1); R('#3a2410', 9, 9, 1, 1); R('#3a2410', 7, 11, 2, 1); };
  D.mangga = function (R) { R('#d8601a', 4, 4, 9, 10); R('#f08a24', 3, 5, 9, 9); R('#f4c43a', 5, 5, 4, 4); R('#c8501a', 10, 10, 3, 3); R('#3a8a30', 8, 1, 4, 3); R('#5a3a1e', 7, 2, 1, 3); };
  D.jeruk = function (R) { disc(R, '#d87a00', 8, 9, 6); disc(R, '#ff9f1c', 8, 9, 5); R('#ffd080', 5, 6, 2, 2); R('#3a8a30', 8, 1, 5, 3); R('#5a3a1e', 8, 3, 1, 2); };
  D.salak = function (R) { R('#5a3018', 4, 4, 8, 10); R('#7a4a2a', 3, 5, 9, 8); R('#a07050', 5, 6, 2, 1); R('#a07050', 9, 8, 2, 1); R('#a07050', 6, 10, 2, 1); R('#3a1c0c', 5, 8, 1, 1); R('#3a1c0c', 10, 6, 1, 1); R('#e8d8b0', 6, 3, 4, 2); };
  D.kopi = function (R) { disc(R, '#8a1e1e', 5, 10, 3); disc(R, '#c03a3a', 5, 10, 2); disc(R, '#8a1e1e', 11, 9, 3); disc(R, '#c03a3a', 11, 9, 2); R('#3a8a30', 6, 2, 4, 3); R('#5a3a1e', 5, 5, 1, 4); R('#5a3a1e', 11, 5, 1, 3); R('#3a2410', 11, 8, 1, 2); };
  D.kakao = function (R) { R('#5a3010', 3, 4, 10, 9); R('#8a4a1e', 2, 5, 11, 7); R('#a86a30', 4, 5, 1, 7); R('#a86a30', 7, 5, 1, 7); R('#a86a30', 10, 5, 1, 7); R('#5a3010', 12, 6, 2, 4); };

  function seed(id) {
    return function (R) {
      var P = Plants.BY[id.slice(1)];
      R('#8a6a38', 3, 5, 10, 9); R('#c8a870', 3, 4, 10, 9); R('#e0c890', 4, 5, 2, 6); R('#8a6a38', 5, 3, 6, 2);
      R(P.col, 6, 7, 4, 4); R('#ffffff', 6, 7, 1, 1);
    };
  }
  for (var i = 0; i < Plants.LIST.length; i++) D['s' + Plants.LIST[i].id] = seed('s' + Plants.LIST[i].id);

  function make(id) {
    var c = document.createElement('canvas'); c.width = c.height = 16;
    var g = c.getContext('2d');
    var R = function (col, x, y, w, h) { g.fillStyle = col; g.fillRect(x, y, w, h); };
    var f = D[id];
    if (f) {
      if (f.length > 1) f(R, disc); else f(R);
      // bayangan tipis di bawah supaya ikon "menempel"
    } else { R('#888', 4, 4, 8, 8); }
    try { return c.toDataURL(); } catch (e) { return ''; }
  }

  function url(id) { return cache[id] || (cache[id] = make(id)); }
  function img(id, cls) { return '<img class="' + (cls || 'ic') + '" src="' + url(id) + '" alt="">'; }
  return { url: url, img: img };
})();
