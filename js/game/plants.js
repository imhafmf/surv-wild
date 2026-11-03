// Plants: data tanaman (jagung + buah Nusantara) dan aturan lahan. Dipakai Bag, Economy, Farm, Renderer.
// T = detik pertumbuhan sampai berbuah (hanya bertambah saat tanaman BASAH), re = detik tumbuh ulang buah (0 = sekali panen)
var Plants = (function () {
  var LIST = [
    { id: 'jagung', name: 'Jagung',     T: 180, re: 0,   qty: 2, tree: false, eat: 15,  price: 6,  seedBuy: 3, col: '#e6c229' },
    { id: 'nanas',  name: 'Nanas',      T: 300, re: 0,   qty: 2, tree: false, eat: 20,  price: 10, col: '#e8a21a' },
    { id: 'pisang', name: 'Pisang',     T: 480, re: 240, qty: 3, tree: true,  eat: 20,  price: 6,  col: '#f4d03f', palm: true },
    { id: 'kelapa', name: 'Kelapa',     T: 720, re: 360, qty: 2, tree: true,  drink: 30, price: 14, col: '#c9a66b', palm: true },
    { id: 'mangga', name: 'Mangga',     T: 600, re: 300, qty: 2, tree: true,  eat: 25,  price: 12, col: '#f08a24', leaf: '#2f7a2a' },
    { id: 'jeruk',  name: 'Jeruk',      T: 540, re: 270, qty: 3, tree: true,  eat: 15,  price: 8,  col: '#ff9f1c', leaf: '#3a8a30' },
    { id: 'salak',  name: 'Salak',      T: 420, re: 210, qty: 3, tree: true,  eat: 15,  price: 7,  col: '#7a4a2a', leaf: '#2d6a25' },
    { id: 'kopi',   name: 'Biji kopi',  T: 600, re: 300, qty: 3, tree: true,  price: 15, col: '#b03a3a', leaf: '#245a1e' },
    { id: 'kakao',  name: 'Buah kakao', T: 600, re: 300, qty: 2, tree: true,  price: 16, col: '#8a4a1e', leaf: '#2a6120' }
  ];
  var WILD = ['pisang', 'kelapa', 'mangga', 'jeruk', 'salak', 'kopi', 'kakao'];   // pohon buah liar
  var BY = {};
  for (var i = 0; i < LIST.length; i++) BY[LIST[i].id] = LIST[i];

  // Lahan: petak persegi SIZE x SIZE tile, harga per tile
  var PLOT = { size: 8, perTile: 5, wet: 120 };      // wet = detik tanaman tetap basah setelah disiram
  PLOT.cost = PLOT.size * PLOT.size * PLOT.perTile;

  return { LIST: LIST, BY: BY, WILD: WILD, PLOT: PLOT };
})();
