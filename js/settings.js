// Settings: pengaturan grafik dan kontrol (disimpan terpisah). Dibaca Renderer, Input, main.
var Settings = (function () {
  var KEY = 'survival_wilderness_settings_v1';
  var OPTS = [
    { k: 'gfx',   label: 'Zoom (jarak pandang)', vals: [0, 1, 2],          names: ['Dekat', 'Normal', 'Jauh'],               def: 1 },
    { k: 'fx',    label: 'Efek visual',       vals: [0, 1, 2],             names: ['Rendah', 'Sedang', 'Tinggi'],            def: 1 },
    { k: 'fps',   label: 'Batas FPS',         vals: [20, 30, 60],          names: ['20', '30', '60'],                        def: 30 },
    { k: 'night', label: 'Efek malam & lampu', vals: [true, false],         names: ['Nyala', 'Mati'],                         def: true },
    { k: 'mini',  label: 'Minimap',           vals: [true, false],         names: ['Tampil', 'Sembunyi'],                    def: true },
    { k: 'joy',   label: 'Joystick',          vals: ['dyn', 'fix'],        names: ['Muncul di jari', 'Tetap di tempat'],     def: 'dyn' },
    { k: 'lift',  label: 'Tinggi kontrol',    vals: [0, 1, 2, 3],          names: ['Rendah', 'Sedang', 'Tinggi', 'Sangat tinggi'], def: 2 },
    { k: 'opa',   label: 'Transparansi tombol', vals: [0, 1, 2],           names: ['Samar', 'Normal', 'Jelas'],              def: 1 }
  ];
  var RES = [240, 320, 420], LIFT = [0, 40, 80, 120], OPA = [0.45, 0.75, 1];
  var v = {};
  for (var i = 0; i < OPTS.length; i++) v[OPTS[i].k] = OPTS[i].def;

  try {
    var s = JSON.parse(localStorage.getItem(KEY));
    if (s) for (var j = 0; j < OPTS.length; j++) {
      var o = OPTS[j];
      if (s[o.k] !== undefined && o.vals.indexOf(s[o.k]) >= 0) v[o.k] = s[o.k];
    }
  } catch (e) {}

  function get(k) { return v[k]; }
  function res() { return RES[v.gfx] || 320; }
  function frameMs() { return 1000 / v.fps; }
  function liftPx() { return LIFT[v.lift] || 0; }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }

  function apply() {
    var d = document.documentElement.style;
    d.setProperty('--lift', liftPx() + 'px');
    d.setProperty('--cop', OPA[v.opa]);
    var mm = document.getElementById('minimap');
    if (mm) mm.style.visibility = v.mini ? 'visible' : 'hidden';
    if (typeof Renderer !== 'undefined' && Renderer.resize) Renderer.resize();
    if (typeof Input !== 'undefined' && Input.layout) Input.layout();
  }

  // ---- panel (di dalam menu) ----
  function render(box) {
    var h = '<h2>Pengaturan</h2>';
    for (var i = 0; i < OPTS.length; i++) {
      var o = OPTS[i], n = o.names[o.vals.indexOf(v[o.k])];
      h += '<button class="opt" data-k="' + o.k + '"><span>' + o.label + '</span><b>' + n + '</b></button>';
    }
    h += '<small>Efek Rendah dan FPS 20 membuat HP lebih adem. Zoom Jauh melihat lebih luas tapi lebih berat.</small><button id="sBack">Kembali</button>';
    box.innerHTML = h;
  }

  function cycle(k) {
    for (var i = 0; i < OPTS.length; i++) {
      if (OPTS[i].k !== k) continue;
      var o = OPTS[i];
      v[k] = o.vals[(o.vals.indexOf(v[k]) + 1) % o.vals.length];
      save(); apply();
      return;
    }
  }

  return { get: get, res: res, frameMs: frameMs, liftPx: liftPx, apply: apply, render: render, cycle: cycle, OPTS: OPTS };
})();
