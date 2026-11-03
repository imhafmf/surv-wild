// Player: gerak, tabrakan, status survival, dan AKSI = memakai item yang dipegang (lihat Hotbar)
var Player = (function () {
  var TS = World.TS;
  var HB = 4; // setengah lebar hitbox

  var p = {
    x: 0, y: 0,                 // posisi kaki (px dunia)
    dx: 0, dy: 1,               // arah hadap
    speed: 62,                  // px per detik
    cool: 0,                    // jeda antar aksi
    hp: 100, hunger: 100, thirst: 100, hurt: 0,
    money: 0,                   // koin
    ret: null,                  // posisi di dunia luar saat berada di goa
    spawn: { x: 0, y: 0 },      // tile titik awal
    inv: { wood: 0, stone: 0, pebble: 0, gold: 0, meat: 0, bread: 0, bottle: 0, table: 0, furnace: 0,
           ironore: 0, iron: 0, axe: 0, pickaxe: 0, pan: 0, iaxe: 0, ipickaxe: 0 },
    doorCool: 0,
    can: 0,                     // isi gembor (0..8)
    msg: '', msgT: 0,
    walkT: 0,
    fx: 0, fy: 0, gx: 0, gy: 0, // arah serong (gambar) dan arah pandang mata
    swing: 0, swingT: 0,        // animasi pukul (swing = sisa 1..0)
    bed: null                   // "x,y" kasur yang jadi titik kembali
  };
  var drops = [];               // tas jatuh saat mati: {x,y,l,inv,t}
  var DROP_LIFE = 20 * 60 * 1000;

  for (var bi = 0; bi < Bag.ITEMS.length; bi++) if (p.inv[Bag.ITEMS[bi].id] === undefined) p.inv[Bag.ITEMS[bi].id] = 0;

  function blocked(px, py) {
    var x0 = Math.floor((px - HB) / TS), x1 = Math.floor((px + HB - 0.01) / TS);
    var y0 = Math.floor((py - HB) / TS), y1 = Math.floor((py + HB - 0.01) / TS);
    for (var ty = y0; ty <= y1; ty++) {
      for (var tx = x0; tx <= x1; tx++) {
        if (World.isSolid(tx, ty)) return true;
      }
    }
    return false;
  }

  function setPos(tx, ty) {
    p.x = tx * TS + TS / 2;
    p.y = ty * TS + TS / 2;
  }

  function fxAt(tx, ty, col, n) {
    if (typeof Renderer !== 'undefined' && Renderer.burst) Renderer.burst(tx * TS + 8, ty * TS + 8, col, n);
  }
  function say(text) { p.msg = text; p.msgT = 1.6; }

  // Makan/minum item yang dipegang. true bila terpakai.
  function consume(id) {
    var it = Bag.find(id);
    if (it.eat) {
      if (p.hunger >= 95) { say('Belum lapar'); return false; }
      p.inv[id]--; p.hunger = Math.min(100, p.hunger + it.eat); say('Makan ' + it.name);
      return true;
    }
    if (it.drink) {
      if (p.thirst >= 95) { say('Belum haus'); return false; }
      p.inv[id]--; p.thirst = Math.min(100, p.thirst + it.drink); say('Minum ' + it.name);
      return true;
    }
    return false;
  }

  // Pasang meja/tungku yang dipegang di tile depan
  function placeHeld(id) {
    var fx = Math.floor((p.x + p.dx * 16) / TS), fy = Math.floor((p.y + p.dy * 16) / TS);
    if (World.place(fx, fy, id)) {
      p.inv[id]--;
      say(Bag.find(id).name + ' dipasang');
      return true;
    }
    say(World.inCave() ? 'Tidak bisa dipasang di dalam goa' : 'Tidak bisa dipasang di sini');
    return false;
  }

  // Cangkul, gembor, benih, sertifikat. true = aksi sudah ditangani.
  function farmAct(held, fx, fy) {
    var r;
    if (held === 'deed') {
      if (World.inVillage(fx, fy)) { say('Desa tidak dijual, cari di luar pagar'); return true; }
      r = Farm.claim(fx, fy);
      if (r.ok) p.inv.deed--;
      say(r.why);
      return true;
    }
    if (held === 'sign') {
      r = Farm.placeSign(fx, fy);
      if (r.ok) p.inv.sign--;
      say(r.msg);
      return true;
    }
    if (held === 'oboard') {
      r = Farm.placeBoard(fx, fy);
      if (r.ok) p.inv.oboard--;
      say(r.msg);
      return true;
    }
    if (held === 'hoe') {
      if (World.objectAt(fx, fy) === World.O.SOIL) { say('Sudah digali'); return true; }
      r = Farm.till(fx, fy);
      if (r.ok) fxAt(fx, fy, '#7a5230', 6);
      say(r.msg);
      return true;
    }
    if (held === 'can') {
      var o = World.objectAt(fx, fy);
      if (World.tileAt(fx, fy) === World.T.WATER || o === World.O.WELL) { p.can = 8; say('Gembor penuh'); return true; }
      if (o === World.O.SOIL || o === World.O.PLANT || o === World.O.FTREE) { r = Farm.water(fx, fy, p); if (r.ok) fxAt(fx, fy, '#7ec8e8', 8); say(r.msg); return true; }
      say(p.can < 1 ? 'Gembor kosong, isi di air' : 'Arahkan ke tanah galian');
      return true;
    }
    var it = Bag.find(held);
    if (it && it.seed) { r = Farm.plant(fx, fy, held, p.inv); if (r.ok) fxAt(fx, fy, '#5cbf4a', 6); say(r.msg); return true; }
    return false;
  }

  // Pintu goa: masuk/keluar bisa lewat AKSI atau menabrak (jalan ke arah pintu)
  function enterDoor(tx, ty) {
    var ry = p.y + TS;                                   // keluar nanti: satu petak di selatan (muka goa menghadap bawah)
    p.ret = { x: p.x, y: blocked(p.x, ry) ? p.y : ry };
    World.enterCave(tx, ty);
    Animals.clear();
    setPos(0, 1);
    p.dx = 0; p.dy = -1;
    p.doorCool = 1.2;
    say('Masuk goa');
  }
  function leaveDoor() {
    World.exitCave();
    Animals.clear();
    if (p.ret) { p.x = p.ret.x; p.y = p.ret.y; }
    p.ret = null;
    p.dx = 0; p.dy = 1;
    p.doorCool = 1.2;
    say('Keluar goa');
  }
  function bumpDoor() {
    var px = p.x + p.dx * (HB + 2), py = p.y + p.dy * (HB + 2);
    var tx = Math.floor(px / TS), ty = Math.floor(py / TS);
    var d = World.DEF[World.objectAt(tx, ty)];
    if (!d || !d.portal) return;
    if (d.portal === 'enter') enterDoor(tx, ty); else leaveDoor();
  }

  // PvP aktif: malam (21:00-05:00 jam dunia), dunia luar, di luar desa. Server memeriksa ulang.
  function pvpNow() {
    if (typeof MP === 'undefined' || !MP.connected() || World.inCave()) return false;
    var h = ((((MP.clock() / 1000) % 300) / 300) * 24 + 12) % 24;
    if (!(h >= 21 || h < 5)) return false;
    return !World.inVillage(Math.floor(p.x / TS), Math.floor(p.y / TS));
  }

  function layerKey() { return World.inCave() ? World.caveKey() : 'o'; }

  function dropNear() {
    var L = layerKey(), now = Date.now();
    for (var i = 0; i < drops.length; i++) {
      var d = drops[i];
      if (d.l === L && d.t > now && Math.abs(d.x - p.x) < 18 && Math.abs(d.y - p.y) < 18) return i;
    }
    return -1;
  }

  // Ambil isi tas jatuh sebanyak yang muat
  function pickDrop(i) {
    var d = drops[i], left = 0, got = 0;
    for (var id in d.inv) {
      var n = d.inv[id]; if (n <= 0) continue;
      var a = Bag.add(p.inv, id, n);
      got += a; d.inv[id] = n - a; left += n - a;
    }
    if (left <= 0) drops.splice(i, 1);
    say(left > 0 ? 'Tas penuh, sisa ' + left + ' item tertinggal' : 'Barangmu diambil kembali (' + got + ')');
  }

  function act() {
    p.swingT = 0.28;
    p.fx = 0; p.fy = 0;           // pukulan selalu ke 4 arah, gambar ikut
    var di = dropNear();
    if (di >= 0) { pickDrop(di); return; }
    var held = Hotbar.held(p.inv);          // id item yang dipegang, null = tangan kosong
    var hi = held ? Bag.find(held) : null;

    // 1) item yang dipegang menentukan aksinya
    if (hi && (hi.eat || hi.drink)) {
      if (consume(held)) return;            // tidak terpakai (misal belum lapar): lanjut ke objek di depan
    } else if (held === 'table' || held === 'furnace' || held === 'bed') {
      placeHeld(held);
      return;
    }

    var fxp = p.x + p.dx * 11, fyp = p.y + p.dy * 11;
    var fx = Math.floor(fxp / TS), fy = Math.floor(fyp / TS);

    // 1b) alat/benih/sertifikat pertanian
    if (held && !World.inCave() && farmAct(held, fx, fy)) return;

    // 1c) serang pemain lain (malam, di luar desa)
    if (pvpNow()) {
      var pt = MP.hitTarget(fxp, fyp, 15);
      if (pt) { MP.sendHit(pt, held === 'iaxe' ? 'i' : (held === 'axe' ? 'a' : 'h')); return; }
    }

    // 2) serang hewan di depan (kapak = lebih kuat)
    var a = Animals.hitAt(fxp, fyp, p.dx, p.dy, Math.max(1, World.toolPow(held, 'axe')));
    if (a) {
      if (a.killed) {
        var got = Bag.add(p.inv, 'meat', a.meat), extra = '';
        if (a.seed && Bag.add(p.inv, a.seed, 1)) extra = ' + ' + Bag.find(a.seed).name;
        say(got < a.meat ? 'Tas penuh!' : '+' + got + ' Daging' + extra);
      }
      else say(a.name + '!');
      return;
    }

    // 3) objek di depan, lalu di bawah kaki
    var ox = Math.floor(p.x / TS), oy = Math.floor(p.y / TS);
    var tx = fx, ty = fy, r;
    var df = World.DEF[World.objectAt(fx, fy)], dof = World.DEF[World.objectAt(ox, oy)];
    if (df && df.portal) {
      r = World.hit(fx, fy, held);                  // pintu di depan
    } else if (dof && dof.portal) {
      tx = ox; ty = oy;
      r = World.hit(ox, oy, held);                  // berdiri di atas pintu
    } else {
      var inFront = World.objectAt(fx, fy) !== World.O.NONE;
      tx = inFront ? fx : ox; ty = inFront ? fy : oy;
      var dd = World.DEF[World.objectAt(tx, ty)];
      if (dd && dd.item && !Bag.canAdd(p.inv, dd.item, dd.qty)) { say('Tas penuh!'); return; }
      r = World.hit(tx, ty, held);
    }

    // 4) air: minum langsung hanya dengan tangan kosong
    if (!r) {
      if (World.tileAt(fx, fy) === World.T.WATER) {
        if (held) { say('Kosongkan tangan untuk minum'); return; }
        p.thirst = Math.min(100, p.thirst + 25);
        say('Minum...');
      }
      return;
    }

    if (r.deco) return;
    if (r.done !== undefined && r.def && r.def.item) fxAt(tx, ty, Bag.find(r.def.item).color, r.done ? 10 : 4);
    if (r.farm) {
      if (r.o === World.O.SIGN) { HUD.openSign(tx, ty); return; }
      r = Farm.harvest(tx, ty, p.inv);
      if (r.ok) fxAt(tx, ty, '#ffd34a', 8);
      say(r.msg);
      return;
    }
    if (r.interact === 'pboard') { HUD.openPBoard(tx + ',' + ty); return; }
    if (r.interact === 'pchest') { say('Peti ordermu. Ambil barang lewat papan order'); return; }
    if (r.interact === 'table') { HUD.show('craft'); return; }
    if (r.interact === 'bed') {
      var bk = tx + ',' + ty;
      if (p.bed === bk) { say('Kasur ini sudah jadi titik kembalimu'); return; }
      p.bed = bk; fxAt(tx, ty, '#ffd34a', 10); say('Titik kembali diatur ke kasur ini');
      return;
    }
    if (r.interact === 'shop')  { HUD.show('shop');  return; }
    if (r.interact === 'board') { HUD.show('board'); return; }
    if (r.interact === 'well')  { if (held) { say('Kosongkan tangan untuk minum'); return; } p.thirst = 100; say('Minum dari sumur'); return; }
    if (r.interact === 'chest') {
      var res = Orders.deposit(Orders.chestIndex(tx, ty), p.inv);
      if (res.none) say('Peti ini belum ada order');
      else if (res.missing) say('Order ini butuh ' + res.name);
      else { p.money += res.pay; say('+' + res.pay + ' koin' + (res.done ? ' (order selesai)' : '')); }
      return;
    }

    if (r.blocked) { say('Pegang ' + r.def.needName + ' di tangan'); return; }

    if (r.portal === 'enter') { enterDoor(tx, ty); return; }
    if (r.portal === 'exit') { leaveDoor(); return; }
    if (r.furnace) {
      if (p.inv.ironore >= 1 && p.inv.wood >= 1) {
        p.inv.ironore--; p.inv.wood--;
        if (Bag.add(p.inv, 'iron', 1) < 1) { p.inv.ironore++; p.inv.wood++; say('Tas penuh!'); return; }
        say('+1 Besi');
      } else {
        say('Butuh 1 bijih besi + 1 kayu');
      }
      return;
    }

    if (r.done) {
      var n = Bag.add(p.inv, r.def.item, r.def.qty);
      say(n < r.def.qty ? 'Tas penuh!' : '+' + n + ' ' + r.def.name);
    } else {
      say(r.def.name + '... ' + r.left);
    }
  }

  // Ada meja kerja dalam 2 tile?
  function nearTable() {
    return World.nearTable(Math.floor(p.x / TS), Math.floor(p.y / TS), 2);
  }

  // Bangunan pemain terdekat yang bisa diambil (meja/tungku/kasur), null bila tidak ada
  function pickable() {
    if (World.inCave()) return null;
    return World.nearestStruct(Math.floor(p.x / TS), Math.floor(p.y / TS), 2);
  }
  var SNAME = { table: 'Meja kerja', furnace: 'Tungku', bed: 'Kasur' };
  function pickupStruct() {
    var s = pickable();
    if (!s) { say('Tidak ada bangunanmu di dekat sini'); return false; }
    if (!Bag.canAdd(p.inv, s.kind, 1)) { say('Tas penuh!'); return false; }
    World.removeStruct(s.key);
    Bag.add(p.inv, s.kind, 1);
    if (p.bed === s.key) p.bed = null;
    say(SNAME[s.kind] + ' diambil');
    return true;
  }
  var pickupTable = pickupStruct;

  function damage(n) {
    p.hp -= n;
    p.hurt = 0.3;
  }

  function die() {
    // semua item jatuh di tempat mati (tas jatuh), bisa diambil dengan AKSI selama 20 menit
    var inv = {}, any = false;
    for (var id in p.inv) if (p.inv[id] > 0) { inv[id] = p.inv[id]; p.inv[id] = 0; any = true; }
    if (any) {
      drops.push({ x: p.x, y: p.y, l: layerKey(), inv: inv, t: Date.now() + DROP_LIFE });
      if (drops.length > 5) drops.shift();
    }
    p.can = 0;
    if (World.inCave()) { World.exitCave(); Animals.clear(); p.ret = null; }
    p.hp = 60; p.hunger = 60; p.thirst = 60;
    var home = null;
    if (p.bed) {
      var a = p.bed.split(',');
      var st = World.getStructures();
      if (st[p.bed] === 'bed') home = { x: +a[0], y: +a[1] };
      else p.bed = null;
    }
    if (home) setPos(home.x, home.y); else setPos(p.spawn.x, p.spawn.y);
    say(any ? 'Kamu pingsan! Barangmu jatuh di tempat tadi' : (home ? 'Kamu pingsan, kembali ke kasur' : 'Kamu pingsan, kembali ke awal'));
  }

  function update(dt, ix, iy, wantAct) {
    var len = Math.sqrt(ix * ix + iy * iy);
    if (len > 0.12) {
      if (len > 1) { ix /= len; iy /= len; }
      // arah hadap dengan histeresis: di diagonal tidak bolak-balik (sprite tidak berkedip)
      var ax = Math.abs(ix), ay = Math.abs(iy), horiz = p.dx !== 0;
      // 8 arah untuk gambar: serong bila kedua sumbu sama kuat (histeresis supaya tidak berkedip)
      var rr = Math.min(ax, ay) / Math.max(ax, ay), dg = !!(p.fx && p.fy);
      if (dg ? rr < 0.42 : rr > 0.62) dg = !dg;
      p.gx = ax > 0.35 ? (ix > 0 ? 1 : -1) : 0; p.gy = 0;   // mata hanya melirik kiri/kanan
      if (horiz ? ay > ax * 1.6 : ax > ay * 1.6) horiz = !horiz;
      if (horiz) { p.dx = ix > 0 ? 1 : -1; p.dy = 0; } else { p.dx = 0; p.dy = iy > 0 ? 1 : -1; }
      p.fx = 0; p.fy = 0;                          // gambar 4 arah dulu (8 arah menunggu sprite HD)
      var nx = p.x + ix * p.speed * dt;
      if (!blocked(nx, p.y)) p.x = nx;
      var ny = p.y + iy * p.speed * dt;
      if (!blocked(p.x, ny)) p.y = ny;
      p.walkT += dt * 8;
      if (p.doorCool <= 0) bumpDoor();
    } else {
      p.walkT = 0;
      p.gx = 0; p.gy = 0;
    }

    if (p.swingT > 0) { p.swingT -= dt; if (p.swingT < 0) p.swingT = 0; }
    p.swing = p.swingT / 0.28;
    if (p.cool > 0) p.cool -= dt;
    if (p.doorCool > 0) p.doorCool -= dt;
    if (wantAct && p.cool <= 0) { act(); p.cool = 0.35; }
    if (p.msgT > 0) p.msgT -= dt;
    if (p.hurt > 0) p.hurt -= dt;

    // survival: lapar habis ~7.5 menit, haus habis ~6 menit
    p.hunger = Math.max(0, p.hunger - dt / 4.5);
    p.thirst = Math.max(0, p.thirst - dt / 3.5);
    if (p.hunger <= 0 || p.thirst <= 0) p.hp -= dt * 0.5;
    else if (p.hunger > 40 && p.thirst > 40 && p.hp < 100) p.hp = Math.min(100, p.hp + dt * 0.33);
    if (p.hp <= 0) die();
  }

  return { state: p, update: update, setPos: setPos, setPx: function (x, y) { p.x = x; p.y = y; }, say: say, nearTable: nearTable,
           pickupTable: pickupTable, pickupStruct: pickupStruct, pickable: pickable, damage: damage,
           pvpNow: pvpNow,
           pvpHurt: function (from, d) { damage(d); say('Diserang ' + from + '!'); fxAt(Math.floor(p.x / TS), Math.floor(p.y / TS), '#c03030', 8); },
           pvpOk: function (name) { fxAt(Math.floor(p.x / TS) + p.dx, Math.floor(p.y / TS) + p.dy, '#ffd34a', 6); say('Kena ' + name + '!'); },
           getDrops: function () { var n = Date.now(); drops = drops.filter(function (d) { return d.t > n; }); return drops; },
           setDrops: function (a) { drops = []; if (Array.isArray(a)) for (var i = 0; i < a.length && i < 5; i++) { var d = a[i]; if (d && typeof d.x === 'number' && typeof d.y === 'number' && typeof d.l === 'string' && d.inv && typeof d.t === 'number') drops.push({ x: d.x, y: d.y, l: d.l, inv: d.inv, t: d.t }); } },
           clearDrops: function () { drops = []; } };
})();
