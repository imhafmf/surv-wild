// Animals: hewan buruan di dunia luar (maks 8 sekaligus, tidak disimpan -> hemat RAM)
var Animals = (function () {
  var TS = World.TS, T = World.T;
  var list = [];
  var spawnT = 0;
  var MAX = 8;

  var TYPES = {
    rabbit: { name: 'Kelinci',    hp: 1, speed: 44, flee: 6 * TS, meat: 1 },
    deer:   { name: 'Rusa',       hp: 2, speed: 54, flee: 7 * TS, meat: 2 },
    boar:   { name: 'Babi hutan', hp: 3, speed: 42, chase: 6 * TS, dmg: 8, meat: 2 },
    // pembawa benih: jarang muncul, lari saat didekati
    monyet: { name: 'Monyet',     hp: 2, speed: 56, flee: 8 * TS, meat: 1, seeds: ['spisang', 'skelapa', 'smangga', 'sjeruk', 'ssalak'], seedP: 0.6 },
    musang: { name: 'Musang',     hp: 1, speed: 52, flee: 8 * TS, meat: 1, seeds: ['skopi', 'skopi', 'skakao'], seedP: 0.7 }
  };

  function clear() { list.length = 0; }

  function canWalk(x, y) {
    var tx = Math.floor(x / TS), ty = Math.floor(y / TS);
    return !World.isSolid(tx, ty) && !World.inVillage(tx, ty);   // hewan liar tidak masuk desa
  }

  function trySpawn(p) {
    var ang = Math.random() * 6.283, dist = (12 + Math.random() * 8) * TS;
    var x = p.x + Math.cos(ang) * dist, y = p.y + Math.sin(ang) * dist;
    var tx = Math.floor(x / TS), ty = Math.floor(y / TS);
    var tile = World.tileAt(tx, ty);
    if ((tile !== T.GRASS && tile !== T.FOREST) || World.isSolid(tx, ty) || World.inVillage(tx, ty)) return;
    var rr = Math.random(), type;
    if (tile === T.FOREST && rr < 0.04) type = 'musang';
    else if (rr < 0.10) type = 'monyet';
    else type = (tile === T.FOREST && Math.random() < 0.3) ? 'boar' : (Math.random() < 0.55 ? 'rabbit' : 'deer');
    list.push({ type: type, x: x, y: y, hp: TYPES[type].hp, wt: 0, wx: 0, wy: 0, fx: 1, flash: 0, atk: 0, agro: false });
  }

  function update(dt, p) {
    if (World.inCave()) { list.length = 0; return; }
    spawnT -= dt;
    if (list.length < MAX && spawnT <= 0) { spawnT = 2; trySpawn(p); }

    for (var i = list.length - 1; i >= 0; i--) {
      var a = list[i], Ty = TYPES[a.type];
      var ex = p.x - a.x, ey = p.y - a.y;
      var d = Math.sqrt(ex * ex + ey * ey) || 1;
      if (d > 26 * TS) { list.splice(i, 1); continue; }
      if (a.flash > 0) a.flash -= dt;
      if (a.atk > 0) a.atk -= dt;

      var vx = 0, vy = 0, sp = Ty.speed;
      if (Ty.chase && (d < Ty.chase || a.agro) && d < 14 * TS) {
        vx = ex / d; vy = ey / d;
        if (d < 11 && a.atk <= 0) { Player.damage(Ty.dmg); a.atk = 1; }
        if (d < 9) { vx = 0; vy = 0; }
      } else if (Ty.flee && d < Ty.flee) {
        vx = -ex / d; vy = -ey / d; sp *= 1.3;
      } else {
        a.wt -= dt;
        if (a.wt <= 0) {
          a.wt = 1 + Math.random() * 2.5;
          if (Math.random() < 0.4) { a.wx = 0; a.wy = 0; }
          else { var g = Math.random() * 6.283; a.wx = Math.cos(g); a.wy = Math.sin(g); }
        }
        vx = a.wx * 0.4; vy = a.wy * 0.4;
      }

      var nx = a.x + vx * sp * dt;
      if (canWalk(nx, a.y)) a.x = nx; else a.wx = -a.wx;
      var ny = a.y + vy * sp * dt;
      if (canWalk(a.x, ny)) a.y = ny; else a.wy = -a.wy;
      if (vx > 0.05) a.fx = 1; else if (vx < -0.05) a.fx = -1;
    }
  }

  // Serang hewan di titik depan pemain. null / {hit, killed, meat, name}
  function hitAt(fx, fy, dx, dy, dmg) {
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      var ddx = a.x - fx, ddy = a.y - fy;
      if (ddx * ddx + ddy * ddy < 169) {
        var Ty = TYPES[a.type];
        a.hp -= dmg; a.flash = 0.2; a.agro = true;
        if (canWalk(a.x + dx * 5, a.y + dy * 5)) { a.x += dx * 5; a.y += dy * 5; }
        if (a.hp <= 0) {
          list.splice(i, 1);
          var sd = (Ty.seeds && Math.random() < Ty.seedP) ? Ty.seeds[(Math.random() * Ty.seeds.length) | 0] : null;
          return { hit: true, killed: true, meat: Ty.meat, name: Ty.name, seed: sd };
        }
        return { hit: true, killed: false, name: Ty.name };
      }
    }
    return null;
  }

  return { list: list, update: update, hitAt: hitAt, clear: clear };
})();
