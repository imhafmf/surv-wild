// Renderer: canvas kecil (resolusi internal rendah) di-scale ke layar, chunk di-cache sebagai gambar
var Renderer = (function () {
  var TS = World.TS, CH = World.CHUNK, T = World.T, O = World.O;
  var canvas, ctx, W = 320, H = 180;
  var camX = 0, camY = 0;
  var caveGrad = null, caveGradKey = '';
  var fx = 1;           // kualitas efek: 0 rendah, 1 sedang, 2 tinggi
  var parts = [];       // partikel (serpihan saat memukul/panen)
  var lastT = 0, vigGrad = null, vigKey = '';
  var lamps = [];
  var signTexts = [];
  var tcv = null, tctx = null, tk = 1, tdpr = 1, labels = [], tDirty = false;   // lapisan teks tajam (resolusi layar)

  var PAL = [];
  PAL[T.WATER]  = ['#2f6fb0', '#2a66a4', '#6fa8dc'];
  PAL[T.SAND]   = ['#d9c98a', '#cfbf7e', '#b8a766'];
  PAL[T.GRASS]  = ['#52a03f', '#4a9639', '#7bc258'];
  PAL[T.FOREST] = ['#3d8230', '#367829', '#2a6120'];
  PAL[T.ROCK]   = ['#807d77', '#74716b', '#a09d96'];
  PAL[T.WALL]   = ['#2b2622', '#26221e', '#3a342e'];
  PAL[T.FLOOR]  = ['#5d544b', '#554c44', '#6c6258'];
  PAL[T.PATH]   = ['#b89a6a', '#ad8f60', '#c8ad80'];
  PAL[T.PLAZA]  = ['#a9a49b', '#9f9a91', '#bcb7ad'];

  function init() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    tcv = document.createElement('canvas');
    tcv.id = 'txt';
    tcv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:1';
    canvas.parentNode.insertBefore(tcv, canvas.nextSibling);
    tctx = tcv.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    var a = window.innerWidth / window.innerHeight, B = Settings.res();
    if (a >= 1) { W = B; H = Math.round(B / a); }
    else { H = B; W = Math.round(B * a); }
    canvas.width = W;
    canvas.height = H;
    if (tcv) { tdpr = Math.min(2, window.devicePixelRatio || 1); tcv.width = Math.round(window.innerWidth * tdpr); tcv.height = Math.round(window.innerHeight * tdpr); }
    ctx.imageSmoothingEnabled = false;
    caveGradKey = '';
  }

  function buildChunk(ch) {
    var c = document.createElement('canvas');
    c.width = c.height = CH * TS;
    var g = c.getContext('2d');
    for (var ty = 0; ty < CH; ty++) {
      for (var tx = 0; tx < CH; tx++) {
        var t = ch.tiles[ty * CH + tx];
        var wx = ch.cx * CH + tx, wy = ch.cy * CH + ty;
        var h = World.hash(wx, wy, 5);
        var h2 = World.hash(wx, wy, 6);
        var pal = PAL[t];
        g.fillStyle = h < 0.5 ? pal[0] : pal[1];
        g.fillRect(tx * TS, ty * TS, TS, TS);
        if (h2 < 0.4) {
          g.fillStyle = pal[2];
          g.fillRect(tx * TS + 1 + ((h * 997) % 12 | 0), ty * TS + 1 + ((h2 * 997) % 12 | 0), 2, 2);
        }
        // tepi tile: busa pantai, bayangan tebing, pinggiran rumput (naungan halus antar jenis tile)
        var tN = World.tileAt(wx, wy - 1), tS = World.tileAt(wx, wy + 1), tW = World.tileAt(wx - 1, wy), tE = World.tileAt(wx + 1, wy), px0 = tx * TS, py0 = ty * TS;
        if (t === T.WATER) {
          g.fillStyle = 'rgba(220,240,255,0.55)';
          if (tN !== t) g.fillRect(px0, py0, TS, 1); if (tS !== t) g.fillRect(px0, py0 + TS - 1, TS, 1);
          if (tW !== t) g.fillRect(px0, py0, 1, TS); if (tE !== t) g.fillRect(px0 + TS - 1, py0, 1, TS);
          g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(px0 + 3 + ((h * 97) % 8 | 0), py0 + 4 + ((h2 * 97) % 6 | 0), 4, 1);
        } else if (t === T.GRASS || t === T.FOREST) {
          g.fillStyle = 'rgba(30,80,20,0.35)';
          if (tN !== t && tN !== T.FOREST && tN !== T.GRASS) g.fillRect(px0, py0, TS, 1);
          if (tS !== t && tS !== T.FOREST && tS !== T.GRASS) g.fillRect(px0, py0 + TS - 1, TS, 1);
          if (tW !== t && tW !== T.FOREST && tW !== T.GRASS) g.fillRect(px0, py0, 1, TS);
          if (tE !== t && tE !== T.FOREST && tE !== T.GRASS) g.fillRect(px0 + TS - 1, py0, 1, TS);
        } else if (t === T.ROCK || t === T.WALL) {
          if (tN !== t) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(px0, py0, TS, 2); }
          if (tS !== t) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(px0, py0 + TS - 2, TS, 2); }
        } else if (t === T.SAND || t === T.PATH) {
          g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(px0 + 2 + ((h * 53) % 9 | 0), py0 + 9 + ((h2 * 53) % 5 | 0), 3, 1);
        }
        if (t === T.GRASS || t === T.FOREST) {            // rumput liar dan bunga kecil
          var h3 = World.hash(wx, wy, 7), px = tx * TS, py = ty * TS, ox = (h3 * 1000 % 7) | 0;
          if (h3 < (t === T.GRASS ? 0.38 : 0.2)) {
            g.fillStyle = t === T.GRASS ? '#3b7e2e' : '#2a6120';
            g.fillRect(px + 2 + ox, py + 8, 1, 3); g.fillRect(px + 4 + ox, py + 7, 1, 4); g.fillRect(px + 6 + ox, py + 9, 1, 2);
            g.fillStyle = '#8fd46a'; g.fillRect(px + 4 + ox, py + 7, 1, 1); g.fillRect(px + 2 + ox, py + 8, 1, 1);
          } else if (t === T.GRASS && h3 > 0.965) {
            g.fillStyle = ['#ffffff', '#ffd34a', '#ff6f91', '#b388ff'][(h3 * 4000 | 0) % 4];
            g.fillRect(px + 5 + ox % 4, py + 6, 2, 2); g.fillStyle = '#2f7a2a'; g.fillRect(px + 6 + ox % 4, py + 8, 1, 3);
          }
        }
      }
    }
    ch.canvas = c;
  }

  // --- objek (pixel art dari fillRect, tanpa file gambar) ---
  function drawTree(x, y, sw) {
    sw = sw || 0;
    if (fx >= 1) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x + 2, y + 13, 12, 3); ctx.fillRect(x + 4, y + 12, 8, 1); }
    ctx.fillStyle = '#4a2f16'; ctx.fillRect(x + 6, y + 8, 4, 8);
    ctx.fillStyle = '#6a4524'; ctx.fillRect(x + 6, y + 8, 2, 8);
    ctx.fillStyle = '#4a2f16'; ctx.fillRect(x + 5, y + 14, 1, 2); ctx.fillRect(x + 10, y + 14, 1, 2);
    ctx.fillStyle = '#10300c'; ctx.fillRect(x + sw, y - 4, 16, 13); ctx.fillRect(x + 2 + sw, y - 7, 12, 4);
    ctx.fillStyle = '#245a1e'; ctx.fillRect(x + 1 + sw, y - 3, 14, 11); ctx.fillRect(x + 3 + sw, y - 6, 10, 4);
    ctx.fillStyle = '#2f7a28'; ctx.fillRect(x + 2 + sw, y - 4, 12, 8); ctx.fillRect(x + 4 + sw, y - 7, 8, 4);
    ctx.fillStyle = '#4aa23c'; ctx.fillRect(x + 4 + sw, y - 6, 6, 3); ctx.fillRect(x + 3 + sw, y - 2, 4, 3); ctx.fillRect(x + 9 + sw, y, 4, 2);
    ctx.fillStyle = '#7bc258'; ctx.fillRect(x + 5 + sw, y - 6, 3, 1); ctx.fillRect(x + 4 + sw, y - 2, 2, 1);
    ctx.fillStyle = '#1a4a16'; ctx.fillRect(x + 2 + sw, y + 5, 12, 3);
  }
  function drawBoulder(x, y) {
    if (fx >= 1) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x + 1, y + 13, 14, 3); }
    ctx.fillStyle = '#2a2926'; ctx.fillRect(x, y + 5, 16, 11); ctx.fillRect(x + 1, y + 2, 12, 4);
    ctx.fillStyle = '#4e4c47'; ctx.fillRect(x + 1, y + 6, 14, 9);
    ctx.fillStyle = '#6e6b65'; ctx.fillRect(x + 2, y + 4, 12, 9);
    ctx.fillStyle = '#8c8982'; ctx.fillRect(x + 3, y + 3, 9, 7);
    ctx.fillStyle = '#b0ada6'; ctx.fillRect(x + 4, y + 4, 4, 2); ctx.fillRect(x + 3, y + 6, 2, 2);
    ctx.fillStyle = '#4e4c47'; ctx.fillRect(x + 8, y + 7, 1, 4); ctx.fillRect(x + 9, y + 10, 3, 1);
  }
  function drawPebble(x, y) {
    ctx.fillStyle = '#9a9790'; ctx.fillRect(x + 4, y + 9, 3, 2); ctx.fillRect(x + 9, y + 6, 2, 2);
    ctx.fillStyle = '#c9c6bf'; ctx.fillRect(x + 4, y + 9, 1, 1); ctx.fillRect(x + 9, y + 6, 1, 1);
  }
  function drawGold(x, y, t) {
    ctx.fillStyle = '#e6b422'; ctx.fillRect(x + 5, y + 8, 3, 3); ctx.fillRect(x + 9, y + 5, 2, 2);
    if (((t / 400) | 0) % 2 === 0) { ctx.fillStyle = '#fff3a0'; ctx.fillRect(x + 5, y + 8, 1, 1); }
  }
  function drawIron(x, y) {
    ctx.fillStyle = '#3d3a36'; ctx.fillRect(x + 1, y + 6, 14, 9);
    ctx.fillStyle = '#5a5650'; ctx.fillRect(x + 2, y + 3, 11, 8);
    ctx.fillStyle = '#c0703c'; ctx.fillRect(x + 4, y + 5, 2, 2); ctx.fillRect(x + 9, y + 7, 3, 2); ctx.fillRect(x + 6, y + 10, 2, 2);
  }
  // pintu goa: lengkungan batu menjorok ke dalam gunung, lantai tangga terlihat dari depan
  function drawCave(x, y) {
    ctx.fillStyle = '#6a675f'; ctx.fillRect(x, y, 16, 16);
    ctx.fillStyle = '#8c8982'; ctx.fillRect(x, y, 16, 2);
    ctx.fillStyle = '#4e4c47'; ctx.fillRect(x, y + 14, 16, 2);
    ctx.fillStyle = '#a09d96'; ctx.fillRect(x + 5, y + 1, 6, 1); ctx.fillRect(x + 3, y + 2, 2, 1); ctx.fillRect(x + 11, y + 2, 2, 1);
    ctx.fillStyle = '#0b0906'; ctx.fillRect(x + 5, y + 2, 6, 1); ctx.fillRect(x + 4, y + 3, 8, 1); ctx.fillRect(x + 3, y + 4, 10, 10);
    ctx.fillStyle = '#17120e'; ctx.fillRect(x + 4, y + 8, 8, 4);
    ctx.fillStyle = '#2a2420'; ctx.fillRect(x + 4, y + 11, 8, 1);
    ctx.fillStyle = '#4a4238'; ctx.fillRect(x + 3, y + 12, 10, 1);
    ctx.fillStyle = '#6a5e50'; ctx.fillRect(x + 2, y + 13, 12, 1);
    ctx.fillStyle = '#8c8982'; ctx.fillRect(x + 2, y + 14, 12, 1);
    ctx.fillStyle = '#3a3834'; ctx.fillRect(x + 3, y + 3, 1, 1); ctx.fillRect(x + 12, y + 3, 1, 1);
  }
  function drawCRock(x, y, tx, ty) {
    var h = World.hash(tx, ty, 77);
    ctx.fillStyle = '#6a675f'; ctx.fillRect(x, y, 16, 16);
    ctx.fillStyle = '#7e7b74'; ctx.fillRect(x + 1, y + 1, 14, 6);
    ctx.fillStyle = '#8c8982'; ctx.fillRect(x + 2 + ((h * 7) | 0), y + 1, 5, 2);
    ctx.fillStyle = '#4e4c47'; ctx.fillRect(x, y + 14, 16, 2); ctx.fillRect(x + 7, y + 8, 1, 5);
    ctx.fillStyle = '#5a5852'; ctx.fillRect(x + 3 + ((h * 5) | 0), y + 9, 4, 3);
  }
  function drawExit(x, y, t) {
    ctx.fillStyle = '#3a3834'; ctx.fillRect(x, y, 16, 16);
    ctx.fillStyle = '#58554e'; ctx.fillRect(x, y, 16, 2);
    ctx.fillStyle = ((t / 500) | 0) % 2 ? '#fff0b0' : '#e8d080';
    ctx.fillRect(x + 5, y + 2, 6, 1); ctx.fillRect(x + 4, y + 3, 8, 1); ctx.fillRect(x + 3, y + 4, 10, 10);
    ctx.fillStyle = '#c8aa50'; ctx.fillRect(x + 5, y + 6, 6, 8);
    ctx.fillStyle = '#fff6d0'; ctx.fillRect(x + 6, y + 7, 4, 5);
    ctx.fillStyle = '#6a5e50'; ctx.fillRect(x + 2, y + 14, 12, 1);
  }
  function drawFurnace(x, y, t) {
    ctx.fillStyle = '#6a625a'; ctx.fillRect(x + 1, y + 3, 14, 13);
    ctx.fillStyle = '#8a8178'; ctx.fillRect(x + 2, y + 2, 12, 4);
    ctx.fillStyle = '#1a1410'; ctx.fillRect(x + 4, y + 8, 8, 7);
    ctx.fillStyle = ((t / 200) | 0) % 2 ? '#ff9a2a' : '#ffcc44'; ctx.fillRect(x + 6, y + 10, 4, 4);
  }
  function drawAnimal(a) {
    var x = Math.round(a.x - camX), y = Math.round(a.y - camY);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 5, y - 1, 10, 3);
    var body, head;
    if (a.flash > 0) { body = head = '#ffffff'; }
    else if (a.type === 'rabbit') { body = '#d8d0c0'; head = '#e8e0d0'; }
    else if (a.type === 'deer')   { body = '#a0703c'; head = '#b88450'; }
    else if (a.type === 'monyet') { body = '#8a6a48'; head = '#d8b890'; }
    else if (a.type === 'musang') { body = '#6a625a'; head = '#4a423a'; }
    else                          { body = '#4e3a2e'; head = '#3a2a20'; }
    if (a.type === 'rabbit') {
      ctx.fillStyle = body; ctx.fillRect(x - 3, y - 5, 6, 4);
      ctx.fillStyle = head; ctx.fillRect(x + a.fx * 3 - 1, y - 7, 3, 3);
      ctx.fillRect(x + a.fx * 3, y - 10, 1, 3);
    } else if (a.type === 'monyet') {
      ctx.fillStyle = body; ctx.fillRect(x - 3, y - 8, 6, 6);
      ctx.fillRect(x - 3, y - 2, 2, 2); ctx.fillRect(x + 1, y - 2, 2, 2);
      ctx.fillStyle = head; ctx.fillRect(x - 3, y - 12, 6, 5);
      ctx.fillStyle = body; ctx.fillRect(x - a.fx * 5 - 1, y - 7, 2, 5);        // ekor
    } else if (a.type === 'musang') {
      ctx.fillStyle = body; ctx.fillRect(x - 6, y - 6, 12, 4);
      ctx.fillRect(x - 5, y - 2, 2, 2); ctx.fillRect(x + 3, y - 2, 2, 2);
      ctx.fillStyle = head; ctx.fillRect(x + a.fx * 6 - 1, y - 8, 4, 4);
      ctx.fillStyle = '#e8e0d0'; ctx.fillRect(x + a.fx * 6, y - 7, 1, 1);
      ctx.fillStyle = '#2a2420'; ctx.fillRect(x - 5, y - 6, 2, 1); ctx.fillRect(x - 1, y - 6, 2, 1);
    } else if (a.type === 'deer') {
      ctx.fillStyle = body; ctx.fillRect(x - 5, y - 8, 10, 5);
      ctx.fillRect(x - 4, y - 3, 1, 3); ctx.fillRect(x + 3, y - 3, 1, 3);
      ctx.fillStyle = head; ctx.fillRect(x + a.fx * 5 - 1, y - 11, 3, 4);
      ctx.fillStyle = '#e8d8b0'; ctx.fillRect(x + a.fx * 5, y - 14, 1, 3);
    } else {
      ctx.fillStyle = body; ctx.fillRect(x - 5, y - 7, 10, 5);
      ctx.fillRect(x - 4, y - 2, 2, 2); ctx.fillRect(x + 2, y - 2, 2, 2);
      ctx.fillStyle = head; ctx.fillRect(x + a.fx * 5 - 1, y - 8, 3, 4);
      ctx.fillStyle = '#f0f0e0'; ctx.fillRect(x + a.fx * 6, y - 5, 1, 2);
    }
  }
  function drawRoof(x, y) {
    ctx.fillStyle = '#9a3b2e'; ctx.fillRect(x, y, 16, 16);
    ctx.fillStyle = '#7d2e24'; ctx.fillRect(x, y + 5, 16, 2); ctx.fillRect(x, y + 11, 16, 2);
  }
  function drawWallH(x, y) {
    ctx.fillStyle = '#d8c9a0'; ctx.fillRect(x, y, 16, 16);
    ctx.fillStyle = '#b8a880'; ctx.fillRect(x, y + 14, 16, 2);
    ctx.fillStyle = '#6a93b8'; ctx.fillRect(x + 11, y + 4, 3, 5);
  }
  function drawDoorH(x, y) {
    ctx.fillStyle = '#d8c9a0'; ctx.fillRect(x, y, 16, 16);
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x + 3, y + 2, 10, 14);
    ctx.fillStyle = '#e6b422'; ctx.fillRect(x + 10, y + 9, 2, 2);
  }
  function drawNpc(x, y) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 3, y + 14, 10, 3);
    ctx.fillStyle = '#b04030'; ctx.fillRect(x + 4, y + 8, 8, 7);
    ctx.fillStyle = '#e8b890'; ctx.fillRect(x + 5, y + 2, 6, 6);
    ctx.fillStyle = '#e6d6a0'; ctx.fillRect(x + 3, y + 1, 10, 2);
    ctx.fillStyle = '#222';    ctx.fillRect(x + 6, y + 5, 1, 1); ctx.fillRect(x + 9, y + 5, 1, 1);
  }
  function drawBoard(x, y) {
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x + 2, y + 10, 2, 6); ctx.fillRect(x + 12, y + 10, 2, 6);
    ctx.fillStyle = '#8b6b3e'; ctx.fillRect(x, y + 1, 16, 11);
    ctx.fillStyle = '#efe6c8'; ctx.fillRect(x + 2, y + 3, 5, 4); ctx.fillRect(x + 9, y + 4, 5, 5);
    ctx.fillStyle = '#c03030'; ctx.fillRect(x + 4, y + 2, 1, 1); ctx.fillRect(x + 11, y + 3, 1, 1);
  }
  function drawChest(x, y, filled) {
    ctx.fillStyle = '#6a4220'; ctx.fillRect(x + 1, y + 7, 14, 8);
    ctx.fillStyle = '#8b5a2b'; ctx.fillRect(x + 1, y + 4, 14, 5);
    ctx.fillStyle = '#e6b422'; ctx.fillRect(x + 7, y + 8, 2, 3);
    ctx.fillStyle = filled ? '#4ad05a' : '#777'; ctx.fillRect(x + 6, y + 1, 4, 2);   // lampu: hijau = ada order
  }
  function drawRoofC(x, y, c1, c2) {
    ctx.fillStyle = c1; ctx.fillRect(x, y, 16, 16);
    ctx.fillStyle = c2; ctx.fillRect(x, y + 5, 16, 2); ctx.fillRect(x, y + 11, 16, 2);
  }
  function drawFence(x, y) {
    ctx.fillStyle = '#6a4a28'; ctx.fillRect(x + 2, y + 3, 3, 12); ctx.fillRect(x + 11, y + 3, 3, 12);
    ctx.fillStyle = '#9a7440'; ctx.fillRect(x, y + 5, 16, 3); ctx.fillRect(x, y + 10, 16, 3);
  }
  function drawLamp(x, y) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 4, y + 14, 8, 2);
    ctx.fillStyle = '#3a3a40'; ctx.fillRect(x + 7, y + 5, 2, 10);
    ctx.fillStyle = '#ffe58a'; ctx.fillRect(x + 5, y + 1, 6, 5);
    ctx.fillStyle = '#fff6c8'; ctx.fillRect(x + 6, y + 2, 2, 2);
  }
  var FLOWER_COL = ['#ff6f91', '#ffd34a', '#ffffff', '#b388ff'];
  function drawFlower(x, y, tx, ty) {
    var c = FLOWER_COL[(World.hash(tx, ty, 31) * 4) | 0];
    ctx.fillStyle = '#2f7a2a'; ctx.fillRect(x + 7, y + 9, 1, 4);
    ctx.fillStyle = c; ctx.fillRect(x + 6, y + 7, 3, 3);
    ctx.fillStyle = '#ffec99'; ctx.fillRect(x + 7, y + 8, 1, 1);
  }
  function drawSoil(x, y, wet) {
    ctx.fillStyle = wet ? '#47301d' : '#6b4a2b'; ctx.fillRect(x + 1, y + 1, 14, 14);
    ctx.fillStyle = wet ? '#3a2616' : '#573b22';
    ctx.fillRect(x + 1, y + 4, 14, 1); ctx.fillRect(x + 1, y + 8, 14, 1); ctx.fillRect(x + 1, y + 12, 14, 1);
  }
  function drawPlant(x, y, inf, wet) {
    drawSoil(x, y, wet);
    var P = Plants.BY[inf.k];
    if (inf.stage === 0) {
      ctx.fillStyle = '#5cbf4a'; ctx.fillRect(x + 7, y + 8, 2, 4); ctx.fillRect(x + 5, y + 8, 2, 1); ctx.fillRect(x + 9, y + 7, 2, 1);
    } else if (inf.stage === 1 || !P.tree && !inf.ready) {
      ctx.fillStyle = '#3f9a30'; ctx.fillRect(x + 7, y + 4, 2, 8); ctx.fillRect(x + 4, y + 6, 3, 2); ctx.fillRect(x + 9, y + 5, 3, 2);
    } else if (P.id === 'jagung') {
      ctx.fillStyle = '#3f9a30'; ctx.fillRect(x + 7, y + 2, 2, 11); ctx.fillRect(x + 4, y + 5, 3, 2); ctx.fillRect(x + 9, y + 7, 3, 2);
      ctx.fillStyle = '#e6c229'; ctx.fillRect(x + 9, y + 4, 3, 4);
    } else {                                   // nanas
      ctx.fillStyle = '#2f8a30'; ctx.fillRect(x + 3, y + 4, 10, 3); ctx.fillRect(x + 5, y + 2, 6, 3);
      ctx.fillStyle = '#e8a21a'; ctx.fillRect(x + 5, y + 7, 6, 6);
      ctx.fillStyle = '#a86a10'; ctx.fillRect(x + 6, y + 9, 1, 1); ctx.fillRect(x + 9, y + 11, 1, 1);
    }
  }
  function drawFTree(x, y, inf) {
    var P = Plants.BY[inf.k];
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x + 2, y + 14, 12, 2);
    if (P.palm) {                              // pisang / kelapa
      ctx.fillStyle = P.id === 'kelapa' ? '#8a6a3a' : '#6a8a3a'; ctx.fillRect(x + 7, y + 4, 2, 11);
      ctx.fillStyle = '#2f8a30'; ctx.fillRect(x + 1, y - 2, 14, 3); ctx.fillRect(x + 3, y - 5, 10, 3); ctx.fillRect(x + 2, y + 1, 4, 2); ctx.fillRect(x + 10, y + 1, 4, 2);
      if (inf.ready) { ctx.fillStyle = P.col; ctx.fillRect(x + 5, y + 3, 3, 3); ctx.fillRect(x + 8, y + 4, 3, 3); }
    } else {
      ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x + 6, y + 8, 4, 8);
      ctx.fillStyle = P.leaf; ctx.fillRect(x + 1, y - 4, 14, 12); ctx.fillRect(x + 3, y - 7, 10, 5);
      if (inf.ready) {
        ctx.fillStyle = P.col;
        ctx.fillRect(x + 3, y - 1, 2, 2); ctx.fillRect(x + 9, y - 3, 2, 2); ctx.fillRect(x + 11, y + 3, 2, 2); ctx.fillRect(x + 6, y + 3, 2, 2);
      }
    }
  }
  function drawPlotBox(i, j, color) {
    var S = Plants.PLOT.size, px = i * S * TS - camX, py = j * S * TS - camY, w = S * TS;
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, w - 1, w - 1);
  }
  function swayOf(tx, now) { var v = Math.sin(now / 700 + tx * 0.9); return v > 0.6 ? 1 : (v < -0.6 ? -1 : 0); }

  // efek per tile kosong: kilau air, rumput bergoyang
  function tileFx(tx, ty, sx, sy, now) {
    var t = World.tileAt(tx, ty);
    if (t === T.WATER) {
      var n = World.hash(tx, ty, 55);
      if (n < 0.14) {
        var ph = ((now / 900) + n * 40) % 1;
        if (ph < 0.45) { ctx.fillStyle = ph < 0.2 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.3)'; ctx.fillRect(sx + 2 + ((n * 977) % 11 | 0), sy + 2 + ((n * 313) % 11 | 0), 3, 1); }
      }
    } else if (fx >= 2 && t === T.GRASS && World.hash(tx, ty, 8) > 0.82) {
      var w = swayOf(tx + ty, now);
      ctx.fillStyle = '#4e9a3a'; ctx.fillRect(sx + 5, sy + 9, 1, 3); ctx.fillRect(sx + 8 + w, sy + 7, 1, 5); ctx.fillRect(sx + 11, sy + 9, 1, 3);
      ctx.fillStyle = '#9be074'; ctx.fillRect(sx + 8 + w, sy + 7, 1, 1);
    }
  }

  // partikel kecil (serpihan kayu, batu, daun, percikan air)
  function burst(wx, wy, col, n) {
    if (fx < 1) return;
    for (var i = 0; i < n && parts.length < 48; i++) {
      var a = Math.random() * 6.283, v = 14 + Math.random() * 26;
      parts.push({ x: wx, y: wy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 16, life: 0.35 + Math.random() * 0.3, col: col });
    }
  }
  function drawParts(dt) {
    for (var i = parts.length - 1; i >= 0; i--) {
      var q = parts[i];
      q.life -= dt; if (q.life <= 0) { parts.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 90 * dt;
      ctx.fillStyle = q.col;
      ctx.fillRect(Math.round(q.x - camX), Math.round(q.y - camY), 2, 2);
    }
  }

  function drawSign(x, y) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x + 3, y + 14, 10, 2);
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x + 7, y + 8, 2, 7);
    ctx.fillStyle = '#c9a266'; ctx.fillRect(x + 2, y + 1, 12, 8);
    ctx.fillStyle = '#8b6b3e'; ctx.fillRect(x + 2, y + 8, 12, 1);
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x + 4, y + 3, 8, 1); ctx.fillRect(x + 4, y + 5, 6, 1);
  }
  function drawTable(x, y) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 1, y + 14, 14, 3);
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x + 2, y + 8, 2, 7); ctx.fillRect(x + 12, y + 8, 2, 7);
    ctx.fillStyle = '#a0703c'; ctx.fillRect(x, y + 5, 16, 4);
    ctx.fillStyle = '#c8955a'; ctx.fillRect(x, y + 5, 16, 1);
    ctx.fillStyle = '#9a9790'; ctx.fillRect(x + 3, y + 2, 4, 3);       // palu di atas meja
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x + 7, y + 3, 5, 1);
  }
  function drawBed(x, y, mine) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y + 14, 16, 3);
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x, y + 12, 2, 3); ctx.fillRect(x + 14, y + 12, 2, 3);
    ctx.fillStyle = '#8b5a2b'; ctx.fillRect(x, y + 8, 16, 5);
    ctx.fillStyle = '#f4efe0'; ctx.fillRect(x + 1, y + 4, 14, 6);
    ctx.fillStyle = '#c0504d'; ctx.fillRect(x + 6, y + 5, 9, 6);
    ctx.fillStyle = '#e07070'; ctx.fillRect(x + 6, y + 5, 9, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y + 3, 5, 4);
    ctx.fillStyle = '#d8d0c0'; ctx.fillRect(x + 1, y + 6, 5, 1);
    if (mine) { ctx.fillStyle = '#ffd34a'; ctx.fillRect(x + 7, y, 2, 2); }
  }
  function drawWell(x, y) {
    ctx.fillStyle = '#7a7670'; ctx.fillRect(x + 1, y + 6, 14, 9);
    ctx.fillStyle = '#2f6fb0'; ctx.fillRect(x + 3, y + 8, 10, 5);
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x + 2, y, 2, 7); ctx.fillRect(x + 12, y, 2, 7); ctx.fillRect(x + 2, y, 12, 2);
  }
  // Gambar karakter di ctx c, kaki di (x, y). sk = warna dari Skin.get(), held = id alat yang dipegang (opsional).
  // Tinggi ~21px, 4 arah, jalan 4 frame, ayun alat saat p.swing (0..1), kedip saat diam.
  var TOOLC = { axe: '#9aa0a8', iaxe: '#d8e0ea', pickaxe: '#9aa0a8', ipickaxe: '#d8e0ea', hoe: '#9aa0a8', can: '#5a9ad0', pan: '#e6b422' };
  function drawPlayerTo(c, x, y, p, sk, held) {
    var moving = p.walkT > 0, fr = moving ? (Math.floor(p.walkT / 1.5708) & 3) : -1;   // 0..3
    var legA = fr === 1 ? 1 : (fr === 3 ? -1 : 0);       // +1 = kaki kiri maju
    var bob = (fr === 0 || fr === 2) ? 0 : (moving ? 1 : 0);
    var sw = p.swing > 0 ? p.swing : 0;
    var dx = p.dx, dy = p.dy, back = dy < 0, side = dx !== 0 && dy === 0, s = dx < 0 ? -1 : 1;
    var diag = !!(p.fx && p.fy), FX = diag ? p.fx : dx, FY = diag ? p.fy : dy;     // arah hadap 8 penjuru (serong = tampak 3/4)
    if (diag) { back = p.fy < 0; side = false; }
    var swSide = diag ? p.fx : 1, hs = diag ? p.fx : 0;                              // sisi lengan yang mengayun, geser kepala
    var gx = Math.max(-1, Math.min(1, p.gx | 0)), gy = Math.max(-1, Math.min(1, p.gy | 0));   // arah pandang mata
    if (diag && !gx) gx = p.fx;
    var OUT = '#241810', skin = sk.skin, shirt = p.hurt > 0 ? '#c03030' : sk.shirt, pants = sk.pants, hair = sk.hair;
    function R(col, ox, oy, w, h) { c.fillStyle = col; c.fillRect(side ? (s > 0 ? x + ox : x - ox - w) : x + ox, y + oy, w, h); }
    function SH(ox, oy, w, h) { R('rgba(0,0,0,0.2)', ox, oy, w, h); }
    function HL(ox, oy, w, h) { R('rgba(255,255,255,0.16)', ox, oy, w, h); }

    // bayangan
    c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(x - 6, y - 1, 12, 3); c.fillRect(x - 5, y - 2, 10, 1);

    // alat saat mengayun (di belakang badan kalau menghadap atas)
    function tool() {
      if (sw <= 0) return;
      var t = 1 - sw, ang = (-1.15 + 2.3 * t * t * (3 - 2 * t));      // sapuan -66 .. +66 derajat
      var fx = FX, fy = FY || 0; if (!fx && !fy) fy = 1;
      if (diag) { fx *= 0.7071; fy *= 0.7071; }
      var ca = Math.cos(ang), sa = Math.sin(ang), vx = fx * ca - fy * sa, vy = fx * sa + fy * ca;
      var sx0 = x + (side ? 0 : (swSide > 0 ? 4 : -5)), sy0 = y - 12 + bob, i, tc = TOOLC[held];
      var hx = sx0 + vx * 4, hy2 = sy0 + vy * 4;
      for (i = 0; i <= 4; i++) { c.fillStyle = OUT; c.fillRect(Math.round(sx0 + vx * i) - 1, Math.round(sy0 + vy * i) - 1, 4, 4); }
      for (i = 0; i <= 4; i++) { c.fillStyle = i < 3 ? shirt : skin; c.fillRect(Math.round(sx0 + vx * i), Math.round(sy0 + vy * i), 2, 2); }
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(Math.round(sx0 + vx) , Math.round(sy0 + vy) + 1, 2, 1);
      if (tc) {
        c.fillStyle = '#6a4220';
        for (i = 0; i <= 6; i++) c.fillRect(Math.round(hx + vx * i), Math.round(hy2 + vy * i), 2, 2);
        c.fillStyle = tc; c.fillRect(Math.round(hx + vx * 7) - 1, Math.round(hy2 + vy * 7) - 1, 4, 4);
        c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(Math.round(hx + vx * 7), Math.round(hy2 + vy * 7) - 1, 2, 1);
      }
      if (sw > 0.25 && sw < 0.75) { c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(Math.round(hx + vx * 9), Math.round(hy2 + vy * 9), 2, 2); }   // kilatan
    }
    if (back) tool();

    var by = -13 + bob;   // atas badan (relatif y)
    if (!side) {
      // kaki
      var lh = 6 - (legA === -1 ? 1 : 0), rh = 6 - (legA === 1 ? 1 : 0);
      R(OUT, -4, -lh - 1, 4, lh + 1); R(OUT, 1, -rh - 1, 4, rh + 1);
      R(pants, -3, -lh, 3, lh - 1); R(pants, 1, -rh, 3, rh - 1);
      SH(1, -rh, 1, rh - 1);
      R('#2b2018', -3, -lh + (lh - 2), 3, 2); R('#2b2018', 1, -rh + (rh - 2), 3, 2);
      // badan + tangan
      var al = legA === 1 ? 1 : 0, ar = legA === -1 ? 1 : 0;
      if (!(sw > 0 && swSide < 0)) { R(OUT, -6, by + 1 - al, 2, 7); R(shirt, -5, by + 1 - al, 1, 4); R(skin, -5, by + 5 - al, 1, 2); }
      if (!(sw > 0 && swSide > 0)) { R(OUT, 4, by + 1 - ar, 2, 7); R(shirt, 4, by + 1 - ar, 1, 4); R(skin, 4, by + 5 - ar, 1, 2); }
      R(OUT, -5, by, 10, 8);
      R(shirt, -4, by + 1, 8, 6);
      HL(-4, by + 1, 2, 5); SH(2, by + 1, 2, 6);
      R('#3a2a1c', -4, by + 6, 8, 1);
      if (!back) { R('rgba(255,255,255,0.18)', -1, by + 2, 2, 1); }
      // kepala (lebar 10, mata 3px dengan pupil 1px yang bisa bergeser)
      var hy = by - 9;
      R(OUT, -6 + hs, hy, 12, 10);
      R(skin, -5 + hs, hy + 1, 10, 8);
      R(skin, -6 + hs, hy + 4, 1, 2); R(skin, 5 + hs, hy + 4, 1, 2);
      SH(3 + hs, hy + 1, 2, 8);
      if (back) {
        R(hair, -5 + hs, hy + 1, 10, 8); SH(3 + hs, hy + 1, 2, 8); HL(-3 + hs, hy + 2, 3, 3);
        if (sk.style === 1) { R(hair, -6 + hs, hy + 3, 12, 8); SH(4 + hs, hy + 3, 2, 8); }
        if (sk.style === 3) { R(OUT, -3 + hs, hy - 4, 6, 5); R(hair, -2 + hs, hy - 3, 4, 4); }
        if (diag) R(skin, hs > 0 ? 4 + hs : -5 + hs, hy + 5, 1, 2);                 // pipi tampak dari serong belakang
      } else {
        if (sk.style === 0) { R(hair, -5 + hs, hy, 10, 3); R(hair, -5 + hs, hy + 3, 1, 2); R(hair, 4 + hs, hy + 3, 1, 2); HL(-3 + hs, hy + 1, 3, 1); }
        else if (sk.style === 1) { R(hair, -5 + hs, hy, 10, 3); R(hair, -6 + hs, hy + 3, 2, 8); R(hair, 4 + hs, hy + 3, 2, 8); HL(-3 + hs, hy + 1, 3, 1); SH(4 + hs, hy + 3, 2, 8); }
        else if (sk.style === 2) { R(OUT, -7 + hs, hy, 14, 4); R(shirt, -6 + hs, hy - 1, 12, 4); R(shirt, -4 + hs, hy - 3, 8, 2); R('rgba(0,0,0,0.25)', -6 + hs, hy + 2, 12, 1); HL(-5 + hs, hy - 1, 3, 1); }
        else { R(hair, -5 + hs, hy, 10, 3); R(OUT, -3 + hs, hy - 4, 6, 4); R(hair, -2 + hs, hy - 3, 4, 3); R(hair, -5 + hs, hy + 3, 1, 2); R(hair, 4 + hs, hy + 3, 1, 2); }
        // mata: putih 3x2, pupil di tengah saat diam, ikut arah gerak
        var blink = !moving && (((Date.now() / 1000) % 4) < 0.15);
        if (blink) { R('#241810', -4 + hs, hy + 6, 3, 1); R('#241810', 1 + hs, hy + 6, 3, 1); }
        else {
          R('#fff', -4 + hs, hy + 5, 3, 2); R('#fff', 1 + hs, hy + 5, 3, 2);
          var pyy = gy > 0 ? hy + 6 : hy + 5, ph = gy === 0 ? 2 : 1;
          R('#241810', -3 + gx + hs, pyy, 1, ph); R('#241810', 2 + gx + hs, pyy, 1, ph);
        }
        R('rgba(220,90,90,0.35)', -5 + hs, hy + 7, 1, 1); R('rgba(220,90,90,0.35)', 4 + hs, hy + 7, 1, 1);
        R('rgba(120,50,40,0.6)', -1 + hs, hy + 8, 2, 1);
      }
    } else {
      // tampak samping: kaki bergantian (x searah hadap)
      var f1 = legA * 2, f2 = -legA * 2;
      var l1 = 6 - (legA === -1 ? 1 : 0), l2 = 6 - (legA === 1 ? 1 : 0);
      R(OUT, -2 + f2, -l2 - 1, 5, l2 + 1); R(pants, -1 + f2, -l2, 3, l2 - 1); SH(-1 + f2, -l2, 3, l2 - 1); R('#2b2018', -1 + f2, -2, 4, 2);
      R(OUT, -2 + f1, -l1 - 1, 5, l1 + 1); R(pants, -1 + f1, -l1, 3, l1 - 1); R('#2b2018', -1 + f1, -2, 4, 2);
      // badan
      R(OUT, -4, by, 8, 8); R(shirt, -3, by + 1, 6, 6); HL(-3, by + 1, 1, 5); SH(1, by + 1, 2, 6); R('#3a2a1c', -3, by + 6, 6, 1);
      // lengan (satu terlihat, ayun berlawanan kaki)
      var ao = -legA * 2;
      if (sw <= 0) { R(OUT, -2 + ao, by + 1, 4, 8); R(shirt, -1 + ao, by + 1, 2, 4); R(skin, -1 + ao, by + 5, 2, 2); }
      // kepala
      var hy2 = by - 9;
      R(OUT, -5, hy2, 10, 10); R(skin, -4, hy2 + 1, 8, 8);
      R(skin, 4, hy2 + 5, 1, 2);                         // hidung
      SH(-4, hy2 + 1, 2, 8);
      R(hair, -5, hy2, 9, 3); R(hair, -5, hy2 + 3, 4, 5); HL(-2, hy2 + 1, 3, 1);
      if (sk.style === 1) { R(hair, -5, hy2 + 3, 4, 8); }
      if (sk.style === 2) { R(OUT, -5, hy2, 11, 4); R(shirt, -4, hy2 - 1, 9, 4); R(shirt, -2, hy2 - 3, 5, 2); R(shirt, 4, hy2 + 2, 3, 1); }
      if (sk.style === 3) { R(OUT, -5, hy2 - 4, 5, 4); R(hair, -4, hy2 - 3, 3, 3); }
      var bl = !moving && (((Date.now() / 1000) % 4) < 0.15);
      if (bl) R('#241810', 1, hy2 + 6, 2, 1); else { R('#fff', 1, hy2 + 5, 2, 2); R('#241810', 2, hy2 + 5 + (gy > 0 ? 1 : 0), 1, gy === 0 ? 2 : 1); }
      R('rgba(120,50,40,0.6)', 2, hy2 + 8, 2, 1);
    }
    if (!back) tool();
  }
  // pemain lain (dari server): badan + nama
  function drawOther(o, now) {
    var x = Math.round(o.x - camX), y = Math.round(o.y - camY);
    if (x < -16 || y < -24 || x > W + 16 || y > H + 16) return;
    drawPlayerTo(ctx, x, y, { dx: o.dx, dy: o.dy || 1, walkT: o.w ? now / 90 : 0, hurt: 0 }, Skin.fromArray(o.skin));
    labels.push({ k: 'n', t: o.name, x: x, y: y - 27 });
    var bt = MP.bubble(o.name); if (bt) labels.push({ k: 'b', t: bt, x: x, y: y - 36 });
  }
  function drawDrop(x, y, t) {
    var b = Math.round(Math.sin(t / 250) * 1);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 5, y - 1, 10, 3);
    ctx.fillStyle = '#4a3220'; ctx.fillRect(x - 5, y - 9 + b, 10, 9);
    ctx.fillStyle = '#7a5530'; ctx.fillRect(x - 4, y - 8 + b, 8, 7);
    ctx.fillStyle = '#a07040'; ctx.fillRect(x - 4, y - 8 + b, 8, 2);
    ctx.fillStyle = '#d8b050'; ctx.fillRect(x - 1, y - 6 + b, 2, 2);
    ctx.fillStyle = '#4a3220'; ctx.fillRect(x - 3, y - 11 + b, 6, 3);
  }
  function drawPlayer(p) {
    drawPlayerTo(ctx, (Math.round(p.x) - camX), (Math.round(p.y) - camY), p, Skin.get(), Hotbar.held(p.inv));
    var mb = Net.user() && MP.bubble(Net.user()); if (mb) labels.push({ k: 'b', t: mb, x: (Math.round(p.x) - camX), y: (Math.round(p.y) - camY) - 29 });
  }

  function render(p, now, daylight) {
    fx = Settings.get('fx');
    var rdt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0.033; lastT = now;
    camX = Math.round(p.x) - (W >> 1);          // kamera dan pemain dibulatkan bersama supaya scroll halus (tidak bergetar)
    camY = Math.round(p.y) - (H >> 1);

    var tx0 = Math.floor(camX / TS), ty0 = Math.floor(camY / TS);
    var tx1 = Math.floor((camX + W) / TS), ty1 = Math.floor((camY + H) / TS);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    var cx0 = Math.floor(tx0 / CH), cx1 = Math.floor(tx1 / CH);
    var cy0 = Math.floor(ty0 / CH), cy1 = Math.floor(ty1 / CH);
    for (var cy = cy0; cy <= cy1; cy++) {
      for (var cx = cx0; cx <= cx1; cx++) {
        var ch = World.getChunk(cx, cy);
        if (!ch.canvas) buildChunk(ch);
        ctx.drawImage(ch.canvas, cx * CH * TS - camX, cy * CH * TS - camY);
      }
    }
    World.prune(Math.floor(p.x / TS / CH), Math.floor(p.y / TS / CH), 2);

    if (!World.inCave()) {
      var pl = Farm.plotList(), Sz = Plants.PLOT.size;
      for (var q = 0; q < pl.length; q++) {
        var qx = pl[q][0] * Sz, qy = pl[q][1] * Sz;
        if (qx + Sz >= tx0 && qx <= tx1 && qy + Sz >= ty0 && qy <= ty1) drawPlotBox(pl[q][0], pl[q][1], 'rgba(255,230,120,0.75)');
      }
      if (Hotbar.held(p.inv) === 'deed') {                       // pratinjau petak yang akan dibeli
        var pc = Farm.plotOf(Math.floor((p.x + p.dx * 11) / TS), Math.floor((p.y + p.dy * 11) / TS));
        drawPlotBox(pc.i, pc.j, Farm.plotCheck(pc.i, pc.j).ok ? 'rgba(120,255,140,0.9)' : 'rgba(255,100,100,0.9)');
      }
    }

    // objek + hewan + pemain, urut per baris supaya depth benar
    var prow = Math.floor(p.y / TS);
    var oth = MP.connected() ? MP.list() : [];
    lamps.length = 0;
    signTexts.length = 0;
    labels.length = 0;
    var ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
    var an = Animals.list;
    var dl = Player.getDrops(), dlk = World.inCave() ? World.caveKey() : 'o';
    for (var ty = ty0 - 1; ty <= ty1 + 1; ty++) {
      for (var tx = tx0 - 1; tx <= tx1 + 1; tx++) {
        var o = World.objectAt(tx, ty, now);
        if (fx >= 1 && o === O.NONE) tileFx(tx, ty, tx * TS - camX, ty * TS - camY, now);
        if (o === O.NONE) continue;
        var sx = tx * TS - camX, sy = ty * TS - camY;
        if (o === O.TREE) drawTree(sx, sy, fx >= 2 ? swayOf(tx, now) : 0);
        else if (o === O.BOULDER) drawBoulder(sx, sy);
        else if (o === O.PEBBLE) drawPebble(sx, sy);
        else if (o === O.GOLD) drawGold(sx, sy, now);
        else if (o === O.IRON) drawIron(sx, sy);
        else if (o === O.CAVE) drawCave(sx, sy);
        else if (o === O.CROCK) drawCRock(sx, sy, tx, ty);
        else if (o === O.PBOARD) drawBoard(sx, sy);
        else if (o === O.PCHEST) { var cb = Farm.chestBoard(tx, ty), bd = cb && Farm.boardData(cb.key); drawChest(sx, sy, !!(bd && bd.orders[cb.i] && !bd.orders[cb.i].closed)); }
        else if (o === O.EXIT) drawExit(sx, sy, now);
        else if (o === O.FURNACE) drawFurnace(sx, sy, now);
        else if (o === O.ROOF) drawRoof(sx, sy);
        else if (o === O.WALLH) drawWallH(sx, sy);
        else if (o === O.DOORH) drawDoorH(sx, sy);
        else if (o === O.NPC) drawNpc(sx, sy);
        else if (o === O.BOARD) drawBoard(sx, sy);
        else if (o === O.CHEST) drawChest(sx, sy, !!Orders.slots[Orders.chestIndex(tx, ty)]);
        else if (o === O.WELL) drawWell(sx, sy);
        else if (o === O.TABLE) drawTable(sx, sy);
        else if (o === O.BED) drawBed(sx, sy, p.bed === tx + ',' + ty);
        else if (o === O.VTREE) drawTree(sx, sy, fx >= 2 ? swayOf(tx, now) : 0);
        else if (o === O.SIGN) { drawSign(sx, sy); var stx = Farm.signText(tx, ty); if (stx && Math.abs(tx - ptx) < 7 && Math.abs(ty - pty) < 6) signTexts.push(stx, sx + 8, sy - 2); }
        else if (o === O.SOIL) drawSoil(sx, sy, Farm.isWet(tx, ty, now));
        else if (o === O.PLANT) drawPlant(sx, sy, Farm.info(tx, ty, now), Farm.isWet(tx, ty, now));
        else if (o === O.FTREE) drawFTree(sx, sy, Farm.info(tx, ty, now));
        else if (o === O.FENCE) drawFence(sx, sy);
        else if (o === O.FLOWER) drawFlower(sx, sy, tx, ty);
        else if (o === O.LAMP) { drawLamp(sx, sy); lamps.push(sx + 8, sy + 3); }
        else if (o === O.ROOFB) drawRoofC(sx, sy, '#3b6ea8', '#2c5686');
        else if (o === O.ROOFG) drawRoofC(sx, sy, '#3d8a55', '#2d6a40');
      }
      for (var i = 0; i < an.length; i++) {
        if (Math.floor(an[i].y / TS) === ty) drawAnimal(an[i]);
      }
      for (var oi = 0; oi < oth.length; oi++) {
        if (Math.floor(oth[oi].y / TS) === ty) drawOther(oth[oi], now);
      }
      for (var di = 0; di < dl.length; di++) {
        if (dl[di].l === dlk && Math.floor(dl[di].y / TS) === ty) drawDrop(Math.round(dl[di].x - camX), Math.round(dl[di].y - camY), now);
      }
      if (ty === prow) drawPlayer(p);
    }

    drawParts(rdt);

    if (World.inCave()) {
      // gelap, hanya sekitar pemain yang terlihat
      var key = W + 'x' + H;
      if (caveGradKey !== key) {
        caveGrad = ctx.createRadialGradient(W / 2, H / 2 - 6, 22, W / 2, H / 2 - 6, 95);
        caveGrad.addColorStop(0, 'rgba(0,0,0,0)');
        caveGrad.addColorStop(1, 'rgba(0,0,0,0.97)');
        caveGradKey = key;
      }
      ctx.fillStyle = caveGrad;
      ctx.fillRect(0, 0, W, H);
    } else {
      var dark = Settings.get('night') ? (1 - daylight) * 0.6 : 0;
      if (dark > 0.02) {
        ctx.fillStyle = 'rgba(8,12,48,' + dark.toFixed(2) + ')';
        ctx.fillRect(0, 0, W, H);
        if (fx >= 2 && dark > 0.2) {          // kunang-kunang
          for (var ff = 0; ff < 10; ff++) {
            var fxx = (Math.sin(now / 1900 + ff * 7.1) * 0.5 + 0.5) * W, fyy = (Math.cos(now / 2300 + ff * 3.7) * 0.5 + 0.5) * H;
            var ga = 0.35 + 0.35 * Math.sin(now / 300 + ff);
            ctx.fillStyle = 'rgba(255,240,120,' + (ga * dark / 0.6).toFixed(2) + ')'; ctx.fillRect(Math.round(fxx), Math.round(fyy), 2, 2);
          }
        }
        if (dark > 0.12) {                    // lampu desa menyala di malam hari
          for (var li = 0; li < lamps.length; li += 2) {
            for (var rr = 3; rr >= 1; rr--) {
              ctx.fillStyle = 'rgba(255,224,130,' + (0.07 * dark / 0.6).toFixed(3) + ')';
              ctx.beginPath(); ctx.arc(lamps[li], lamps[li + 1], rr * 14, 0, 6.2832); ctx.fill();
            }
          }
        }
      }
    }

    if (fx >= 2 && !World.inCave()) {                // vinyet halus di tepi layar
      var vk = W + 'x' + H;
      if (vigKey !== vk) {
        vigGrad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
        vigGrad.addColorStop(0, 'rgba(0,0,0,0)'); vigGrad.addColorStop(1, 'rgba(0,0,0,0.28)');
        vigKey = vk;
      }
      ctx.fillStyle = vigGrad; ctx.fillRect(0, 0, W, H);
    }

    for (var si = 0; si < signTexts.length; si += 3) labels.push({ k: 's', t: signTexts[si], x: signTexts[si + 1], y: signTexts[si + 2] });
    if (p.hurt > 0) {
      ctx.fillStyle = 'rgba(200,0,0,0.25)';
      ctx.fillRect(0, 0, W, H);
    }
    if (p.msgT > 0) labels.push({ k: 'm', t: p.msg, x: W / 2, y: H / 2 - 24 });
    flushLabels();
  }

  // teks digambar di kanvas resolusi layar supaya tajam (kanvas game kecil lalu diperbesar = buram)
  function wrap(g, text, maxW) {
    var words = String(text).split(' '), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var t = cur ? cur + ' ' + words[i] : words[i];
      if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = words[i]; } else cur = t;
      if (lines.length >= 3) break;
    }
    if (cur && lines.length < 3) lines.push(cur);
    return lines;
  }
  function flushLabels() {
    if (!tctx) return;
    if (!labels.length) { if (tDirty) { tctx.clearRect(0, 0, tcv.width, tcv.height); tDirty = false; } return; }
    tctx.clearRect(0, 0, tcv.width, tcv.height); tDirty = true;
    var k = tcv.width / W, d = tdpr, g = tctx;
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    for (var i = 0; i < labels.length; i++) {
      var L = labels[i], x = L.x * k, y = L.y * k;
      if (L.k === 'n') {
        g.font = 'bold ' + Math.round(11 * d) + 'px sans-serif';
        g.lineWidth = 3 * d; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(L.t, x, y);
        g.fillStyle = '#bfe8ff'; g.fillText(L.t, x, y);
      } else if (L.k === 'b') {
        var fs = Math.round(11 * d), lh = fs + 2 * d;
        g.font = fs + 'px sans-serif';
        var ls = wrap(g, L.t, 150 * d), w = 0, n;
        for (n = 0; n < ls.length; n++) w = Math.max(w, g.measureText(ls[n]).width);
        var bw = w + 12 * d, bh = ls.length * lh + 8 * d, bx = x - bw / 2, by = y - bh;
        g.fillStyle = 'rgba(255,255,255,0.95)'; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 1.5 * d;
        g.beginPath();
        if (g.roundRect) g.roundRect(bx, by, bw, bh, 6 * d); else g.rect(bx, by, bw, bh);
        g.fill(); g.stroke();
        g.beginPath(); g.moveTo(x - 4 * d, by + bh); g.lineTo(x, by + bh + 5 * d); g.lineTo(x + 4 * d, by + bh); g.closePath(); g.fill();
        g.fillStyle = '#111';
        for (n = 0; n < ls.length; n++) g.fillText(ls[n], x, by + 4 * d + (n + 1) * lh - 3 * d);
      } else if (L.k === 's') {
        g.font = 'bold ' + Math.round(11 * d) + 'px sans-serif';
        var sw2 = g.measureText(L.t).width;
        g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(x - sw2 / 2 - 4 * d, y - 11 * d, sw2 + 8 * d, 15 * d);
        g.fillStyle = '#fff'; g.fillText(L.t, x, y);
      } else {
        g.font = 'bold ' + Math.round(14 * d) + 'px sans-serif';
        g.lineWidth = 3.5 * d; g.strokeStyle = 'rgba(0,0,0,0.9)'; g.strokeText(L.t, x, y);
        g.fillStyle = '#fff'; g.fillText(L.t, x, y);
      }
    }
  }

  return { init: init, render: render, resize: resize, burst: burst, drawPlayerTo: drawPlayerTo };
})();
