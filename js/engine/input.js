// Input: joystick virtual (layar kiri), tombol AKSI, dan keyboard untuk tes di komputer
var Input = (function () {
  var st = { ix: 0, iy: 0, act: false };
  var keys = {};
  var zone, base, knob, joyId = null, ox = 0, oy = 0, R = 40;

  function homeX() { return 74; }
  function homeY() { return window.innerHeight - Settings.liftPx() - 110; }
  // posisi joystick: idle = cincin samar di tempat tetap; aktif = di titik sentuh
  function place(x, y, idle) {
    base.style.left = x + 'px';
    base.style.top = y + 'px';
    base.className = idle ? 'idle' : 'on';
  }
  function layout() {
    if (!base) return;
    if (joyId === null) place(homeX(), homeY(), true);
  }
  function moveKnob(t) {
    var dx = t.clientX - ox, dy = t.clientY - oy;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    st.ix = dx / R; st.iy = dy / R;
    knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  }

  function init() {
    zone = document.getElementById('joyzone');
    base = document.getElementById('joybase');
    knob = document.getElementById('joyknob');

    layout();
    window.addEventListener('resize', layout);

    zone.addEventListener('touchstart', function (e) {
      e.preventDefault();
      if (joyId !== null) return;
      var t = e.changedTouches[0];
      joyId = t.identifier;
      if (Settings.get('joy') === 'fix') { ox = homeX(); oy = homeY(); }       // joystick tetap: pusat di tempatnya
      else { ox = t.clientX; oy = t.clientY; }                                  // dinamis: muncul di jari
      place(ox, oy, false);
      knob.style.transform = 'translate(0,0)';
      moveKnob(t);
    }, { passive: false });

    zone.addEventListener('touchmove', function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier !== joyId) continue;
        moveKnob(t);
      }
    }, { passive: false });

    function endJoy(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joyId) {
          joyId = null; st.ix = 0; st.iy = 0;
          knob.style.transform = 'translate(0,0)';
          layout();
        }
      }
    }
    zone.addEventListener('touchend', endJoy);
    zone.addEventListener('touchcancel', endJoy);

    var btn = document.getElementById('btnA');
    function actOn(e) { e.preventDefault(); st.act = true; }
    function actOff(e) { e.preventDefault(); st.act = false; }
    btn.addEventListener('touchstart', actOn, { passive: false });
    btn.addEventListener('touchend', actOff, { passive: false });
    btn.addEventListener('touchcancel', actOff, { passive: false });
    btn.addEventListener('mousedown', actOn);
    btn.addEventListener('mouseup', actOff);

    window.addEventListener('keydown', function (e) { if (e.target && e.target.tagName === 'INPUT') return; keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
  }

  // Gabungan joystick + keyboard
  function read() {
    var ix = st.ix, iy = st.iy;
    if (keys['a'] || keys['arrowleft']) ix = -1;
    if (keys['d'] || keys['arrowright']) ix = 1;
    if (keys['w'] || keys['arrowup']) iy = -1;
    if (keys['s'] || keys['arrowdown']) iy = 1;
    return { ix: ix, iy: iy, act: st.act || !!keys[' '] || !!keys['e'] };
  }

  return { init: init, read: read, layout: layout };
})();
