// Main: menu awal, inisialisasi, loop game (30 FPS), simpan/muat progres
(function () {
  var SAVE_KEY = 'survival_wilderness_v2';
  var MAP_KEY  = 'survival_wilderness_map_v1';   // peta yang sudah dijelajahi (terpisah supaya ringan)
  var OLD_KEY  = 'survival_wilderness_v1';   // versi lama (sebelum ada desa)
  var DAY_LEN = 300;      // detik per siklus siang-malam

  Renderer.init();
  Input.init();
  Settings.apply();
  HUD.init();
  Minimap.init();
  Chat.init();

  var p = Player.state;
  var running = false;
  var gameTime = 20;       // mulai pagi hari

  // simpan lokal per akun: tanpa login = kunci dasar, dengan login = kunci + ":nama"
  function sk() { return Net.user() ? SAVE_KEY + ':' + Net.user() : SAVE_KEY; }
  function mk() { return Net.user() ? MAP_KEY + ':' + Net.user() : MAP_KEY; }

  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function readSave() {
    return validSave(readJSON(sk()));
  }
  function validSave(s) { return (s && s.ver === 2 && typeof s.x === 'number' && s.inv) ? s : null; }
  function readOld() {
    var s = readJSON(OLD_KEY);
    return (s && s.inv) ? s : null;
  }

  function resetState() {
    if (World.inCave()) World.exitCave();
    Animals.clear();
    p.ret = null;
    for (var k in p.inv) p.inv[k] = 0;
    Hotbar.reset();
    Minimap.reset();
    Farm.reset();
    p.can = 0;
    p.hp = 100; p.hunger = 100; p.thirst = 100; p.hurt = 0; p.money = 0;
    World.setStructures({});
    p.bed = null; p.swing = 0; p.swingT = 0; Player.clearDrops();
    var sp = World.findSpawn();
    p.spawn = { x: sp.x, y: sp.y };
    Player.setPos(sp.x, sp.y);
    Orders.init();
  }

  // Game baru. Kalau ada data versi lama, isi tasnya dibawa (posisinya tidak).
  function newGame(old) {
    resetState();
    p.money = 30;
    p.inv.axe = 1;
    Bag.add(p.inv, 'bread', 2);
    Bag.add(p.inv, 'bottle', 1);
    if (old && old.inv) {
      for (var k in p.inv) {
        if (k !== 'bread' && typeof old.inv[k] === 'number' && old.inv[k] > 0) p.inv[k] = Math.max(p.inv[k], old.inv[k]);
      }
    }
    Hotbar.update(p.inv);
    try { localStorage.removeItem(mk()); } catch (e) {}
    save();
  }

  function loadGame(s, mapData) {
    resetState();
    p.x = s.x; p.y = s.y;
    for (var k in p.inv) if (s.inv && typeof s.inv[k] === 'number') p.inv[k] = s.inv[k];
    if (typeof s.hp === 'number') { p.hp = s.hp; p.hunger = s.hunger; p.thirst = s.thirst; }
    if (typeof s.money === 'number') p.money = s.money;
    World.setStructures(s.st);
    p.bed = (typeof s.bed === 'string') ? s.bed : null;
    Player.setDrops(s.dr);
    Farm.restore(s.farm);
    p.can = (typeof s.can === 'number') ? Math.max(0, Math.min(8, s.can)) : 0;
    Skin.restore(s.skin);
    Hotbar.restore(s.hb);
    Minimap.restore(mapData ? mapData : readJSON(mk()));
    Minimap.restorePins(s.pins);
    Hotbar.update(p.inv);
    if (World.isSolid(Math.floor(p.x / 16), Math.floor(p.y / 16))) Player.setPos(p.spawn.x, p.spawn.y);
  }

  function buildSave() {
    // kalau sedang di goa, simpan posisi di dunia luar
    var pos = (World.inCave() && p.ret) ? p.ret : p;
    return {
      ver: 2, x: pos.x, y: pos.y, inv: p.inv, hp: p.hp, hunger: p.hunger, thirst: p.thirst,
      st: World.getStructures(), money: p.money, hb: Hotbar.serialize(), farm: Farm.serialize(), can: p.can, pins: Minimap.getPins(), skin: Skin.serialize(), bed: p.bed, dr: Player.getDrops()
    };
  }
  function save() {
    try { localStorage.setItem(sk(), JSON.stringify(buildSave())); } catch (e) {}
  }
  // Peta disimpan terpisah dan lebih jarang (hanya bila ada area baru), supaya tidak membebani HP
  var mapSaved = 0, mapNet = false;
  function saveMap(force) {
    if (!Minimap.isDirty()) return;
    var now = Date.now();
    if (!force && now - mapSaved < 30000) return;
    try { localStorage.setItem(mk(), JSON.stringify(Minimap.serialize())); Minimap.clean(); mapSaved = now; mapNet = true; } catch (e) {}
  }
  // Kirim ke server (bila sudah masuk akun): paling sering tiap 20 detik, dipaksa saat keluar ke menu
  var netAt = 0;
  function pushServer(force) {
    if (!Net.online()) return;
    var now = Date.now();
    if (!force && now - netAt < 20000) return;
    netAt = now;
    Net.putSave(buildSave(), force).catch(function () {});
    if (mapNet || force) { mapNet = false; Net.putMap(Minimap.serialize()); }
  }
  setInterval(function () { if (running) { save(); saveMap(false); pushServer(false); } }, 10000);
  window.addEventListener('pagehide', function () { if (running) { save(); saveMap(true); pushServer(true); } });

  // ---- menu ----
  var menu = document.getElementById('menu');
  var bCont = document.getElementById('mCont');
  var bNew = document.getElementById('mNew');
  var note = document.getElementById('mnote');
  var confirmNew = false;
  var mmain = document.getElementById('mmain'), setp = document.getElementById('setp'), authp = document.getElementById('authp');
  var aMsg = document.getElementById('aMsg');

  var skinp = document.getElementById('skinp');
  function showPanel(name) {
    if (name === 'set') Settings.render(setp);
    if (name === 'skin') Skin.render(skinp);
    skinp.style.display = name === 'skin' ? 'block' : 'none';
    if (name === 'auth') renderAuth('');
    setp.style.display = name === 'set' ? 'block' : 'none';
    authp.style.display = name === 'auth' ? 'block' : 'none';
    mmain.style.display = name === 'main' ? 'block' : 'none';
  }
  function showSettings(on) { showPanel(on ? 'set' : 'main'); }
  document.getElementById('mSet').addEventListener('click', function () { showPanel('set'); });
  document.getElementById('mSkin').addEventListener('click', function () { showPanel('skin'); });
  skinp.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== skinp && !(t.getAttribute && (t.getAttribute('data-sk') || t.id === 'kBack'))) t = t.parentNode;
    if (!t || t === skinp) return;
    if (t.id === 'kBack') { save(); pushServer(true); showPanel('main'); return; }
    Skin.cycle(t.getAttribute('data-sk'));
    Skin.render(skinp);
  });

  // ---- akun online ----
  function renderAuth(msg) {
    var on = Net.online();
    document.getElementById('aSrvBox').style.display = Net.needsBase() ? 'block' : 'none';
    document.getElementById('aSrv').value = Net.base();
    document.getElementById('aIn').style.display = on ? 'none' : 'block';
    document.getElementById('aOutBox').style.display = on ? 'block' : 'none';
    document.getElementById('aWho').textContent = on ? 'Masuk sebagai ' + Net.user() : '';
    aMsg.textContent = msg || (on ? 'Progresmu disimpan ke server.' : 'Daftar atau masuk agar progres tersimpan di server.');
  }
  function doAuth(kind) {
    var u = document.getElementById('aUser').value.trim().toLowerCase(), pw = document.getElementById('aPass').value;
    if (Net.needsBase()) Net.setBase(document.getElementById('aSrv').value);
    aMsg.textContent = 'Menghubungi server...';
    Net[kind](u, pw).then(function () {
      document.getElementById('aPass').value = '';
      showPanel('main');
      refreshMenu();
    }, function (e) { aMsg.textContent = e.msg || 'Gagal'; });
  }
  document.getElementById('mAcc').addEventListener('click', function () { showPanel('auth'); });
  document.getElementById('aLogin').addEventListener('click', function () { doAuth('login'); });
  document.getElementById('aReg').addEventListener('click', function () { doAuth('register'); });
  document.getElementById('aOut').addEventListener('click', function () {
    Net.logout().then(function () { showPanel('main'); refreshMenu(); });
  });
  document.getElementById('aBack').addEventListener('click', function () { showPanel('main'); });
  setp.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== setp && !(t.getAttribute && (t.getAttribute('data-k') || t.id === 'sBack'))) t = t.parentNode;
    if (!t || t === setp) return;
    if (t.id === 'sBack') { showSettings(false); return; }
    Settings.cycle(t.getAttribute('data-k'));
    Settings.render(setp);
  });

  function refreshMenu() {
    var on = Net.online();
    var has = !!readSave(), old = !has && !!readOld();
    bCont.disabled = !(has || old || on);
    bCont.textContent = old ? 'Lanjutkan (data lama)' : 'Lanjutkan';
    document.getElementById('mAcc').textContent = on ? 'Akun: ' + Net.user() : 'Akun online';
    bNew.textContent = 'Game Baru';
    confirmNew = false;
    note.textContent = on ? 'Online sebagai ' + Net.user() : (old ? 'Data lama ditemukan. Isi tasmu dibawa ke desa.' :
                       (has ? 'Main offline (data hanya di HP ini).' : 'Belum ada data tersimpan.'));
  }
  function showMenu() {
    running = false;
    HUD.show(null);
    Minimap.close();
    Chat.close();
    MP.stop();
    refreshMenu();
    showPanel('main');
    menu.style.display = 'flex';
  }

  function startRunning() {
    menu.style.display = 'none';
    MP.start();
    Chat.refresh();
    last = performance.now();
    running = true;
  }

  function offlineBase() { return validSave(readJSON(SAVE_KEY)); }   // data main offline sebelum punya akun

  bCont.addEventListener('click', function () {
    if (!Net.online()) {
      var s = readSave();
      if (s) loadGame(s); else newGame(readOld());
      startRunning();
      return;
    }
    note.textContent = 'Memuat dari server...';
    bCont.disabled = true;
    Net.getSave().then(function (r) {
      var srv = validSave(r.save), loc = readSave(), imp = offlineBase();
      if (srv) { loadGame(srv, r.map); note.textContent = ''; }
      else if (loc) { loadGame(loc); }
      else if (imp) { loadGame(imp, readJSON(MAP_KEY)); }                 // impor satu kali dari data offline
      else newGame(readOld());
      save(); saveMap(true); mapNet = true;
      startRunning();
      pushServer(true);
    }, function (e) {
      bCont.disabled = false;
      note.textContent = (e.msg || 'Gagal') + '. Coba lagi, atau keluar akun untuk main offline.';
    });
  });
  bNew.addEventListener('click', function () {
    var has = !!readSave() || !!readOld() || Net.online();
    if (has && !confirmNew) {            // tekan dua kali supaya tidak terhapus tidak sengaja
      confirmNew = true;
      bNew.textContent = 'Yakin? Hapus semua progres';
      return;
    }
    newGame(null);
    startRunning();
    mapNet = true;
    pushServer(true);
  });
  document.getElementById('btnM').addEventListener('click', function () {
    save();
    saveMap(true);
    pushServer(true);
    showMenu();
  });

  // ---- loop ----
  var last = performance.now();
  var frames = 0, fps = 0, fpsT = last;

  function loop(now) {
    requestAnimationFrame(loop);
    if (!running) return;
    var el = now - last;
    if (el < Settings.frameMs() - 2) return;
    last = now;
    var dt = Math.min(el, 100) / 1000;

    // jam dunia = jam server (sama untuk semua pemain, tetap jalan walau sendirian/offline)
    var phase = ((MP.clock() / 1000) % DAY_LEN) / DAY_LEN;
    var daylight = 0.5 + 0.5 * Math.cos(phase * Math.PI * 2);

    var inp = Input.read();
    Player.update(dt, inp.ix, inp.iy, inp.act);
    Hotbar.update(p.inv);
    Minimap.update(dt, p);
    MP.update(dt, p);
    Animals.update(dt, p);
    Economy.update(dt);
    Orders.update(Date.now());
    Renderer.render(p, Date.now(), daylight);

    frames++;
    if (now - fpsT >= 1000) { fps = frames; frames = 0; fpsT = now; }
    HUD.update(p, fps, now, daylight, phase);
  }

  var sp0 = World.findSpawn();
  p.spawn = { x: sp0.x, y: sp0.y };
  Orders.init();
  showMenu();
  requestAnimationFrame(loop);
})();
