// HUD (HP, lapar, haus, koordinat, jam, fps) + panel BUAT + panel TAS 9x3
var HUD = (function () {
  var pickEl, pickKind = '', csel = 'table', pbEl, pbKey = null, signEl, signAt = null, el, craftEl, bagEl, shopEl, boardEl, hotEl, hLabel, hSlots = {}, last = 0, cur = null, sel = -1;

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function findAttr(t, root, attr) {
    while (t && t !== root) {
      if (t.getAttribute && t.getAttribute(attr) !== null) return t;
      t = t.parentNode;
    }
    return null;
  }

  function init() {
    el = document.getElementById('hud');
    pickEl = document.createElement('button');
    pickEl.id = 'pickbtn';
    pickEl.style.cssText = 'position:fixed;left:50%;bottom:calc(96px + var(--lift,0px));transform:translateX(-50%);z-index:7;display:none;padding:7px 14px;font:bold 12px monospace;background:#7a5a2a;color:#fff;border:2px solid #ffd34a;border-radius:8px';
    pickEl.addEventListener('click', function () { Player.pickupStruct(); });
    document.body.appendChild(pickEl);
    craftEl = document.getElementById('craft');
    bagEl = document.getElementById('bag');
    shopEl = document.getElementById('shop');
    boardEl = document.getElementById('board');
    signEl = document.getElementById('signp');
    signEl.addEventListener('click', function (e) {
      var id = e.target.id;
      if (id === 'sgx') { show(null); return; }
      if (!signAt) return;
      if (id === 'sgs') { Farm.setSign(signAt[0], signAt[1], document.getElementById('sgt').value); Player.say('Tulisan disimpan'); show(null); }
      else if (id === 'sgp') {
        if (!Bag.canAdd(Player.state.inv, 'sign', 1)) { Player.say('Tas penuh!'); return; }
        Farm.removeSign(signAt[0], signAt[1]); Bag.add(Player.state.inv, 'sign', 1); Player.say('Papan diambil'); show(null);
      }
    });
    hotEl = document.getElementById('hotbar');
    hLabel = document.getElementById('hlabel');
    var keys = ['s0', 's1', 's2', 's3', 'c0', 'c1', 'c2'];
    for (var q = 0; q < keys.length; q++) hSlots[keys[q]] = document.getElementById('h' + (keys[q].charAt(0) === 's' ? 's' : 'c') + keys[q].charAt(1));
    hotEl.addEventListener('click', function (e) {
      var n = findAttr(e.target, hotEl, 'data-k');
      if (!n) return;
      Hotbar.select(n.getAttribute('data-k'));
      renderHotbar();
    });
    document.getElementById('btnB').addEventListener('click', function () { show(cur === 'bag' ? null : 'bag'); });

    craftEl.addEventListener('click', function (e) {
      var t = e.target;
      if (t.id === 'cx') { show(null); return; }
      var P = Player.state;
      if (t.id === 'tpick')  { Player.pickupTable(); renderCraft(); return; }
      var cell = findAttr(t, craftEl, 'data-r');
      if (cell) { csel = cell.getAttribute('data-r'); renderCraft(); return; }
      if (t.id === 'cmk') {
        var ctx = { table: Player.nearTable() };
        for (var i = 0; i < Crafting.RECIPES.length; i++) {
          var r = Crafting.RECIPES[i];
          if (r.id !== csel) continue;
          if (!Crafting.canCraft(r, P.inv, ctx)) { Player.say(r.at === 'table' && !ctx.table ? 'Butuh meja kerja di dekat' : 'Bahan kurang'); renderCraft(); return; }
          Crafting.craft(r, P.inv, ctx);
          Player.say(r.name + ' dibuat!');
          renderCraft();
        }
      }
    });

    pbEl = document.getElementById('pbp');
    pbEl.addEventListener('click', function (e) {
      var t = e.target, id = t.id, P = Player.state, r = null;
      if (id === 'pbx') { show(null); return; }
      var i = t.getAttribute && t.getAttribute('data-i');
      if (id === 'pbrm') r = Farm.removeBoard(pbKey, P.inv);
      else if (id === 'pbs') {
        r = Farm.postOrder(pbKey, +i, document.getElementById('pbi' + i).value, +document.getElementById('pbq' + i).value, +document.getElementById('pbu' + i).value, P);
      } else if (id === 'pbc') r = Farm.cancelOrder(pbKey, +i, P);
      else if (id === 'pbt') r = Farm.collect(pbKey, +i, P.inv);
      if (!r) return;
      Player.say(r.msg);
      if (id === 'pbrm' && r.ok) { show(null); return; }
      renderPBoard();
    });

    shopEl.addEventListener('click', function (e) {
      var t = e.target;
      if (t.id === 'sx') { show(null); return; }
      var id = t.getAttribute && t.getAttribute('data-sell');
      var buy = t.getAttribute && t.getAttribute('data-buy');
      var p = Player.state;
      if (id) {
        var amt = t.getAttribute('data-n') === 'all' ? (p.inv[id] || 0) : 1;
        var r = Economy.sell(p.inv, id, amt);
        if (r.n > 0) { p.money += r.earn; Player.say('Terjual +' + r.earn + ' koin'); }
        renderShop();
      } else if (buy) {
        var price = Economy.sellPrice(buy);
        if (p.money < price) { Player.say('Uang kurang'); }
        else if (!Bag.canAdd(p.inv, buy, 1)) { Player.say('Tas penuh!'); }
        else { p.money -= price; Bag.add(p.inv, buy, 1); Player.say('Beli ' + Bag.find(buy).name); }
        renderShop();
      }
    });

    boardEl.addEventListener('click', function (e) {
      if (e.target.id === 'ox') show(null);
    });

    bagEl.addEventListener('click', function (e) {
      var t = e.target;
      if (t.id === 'bx') { show(null); return; }
      var as = t.getAttribute && t.getAttribute('data-as');
      if (as) { Hotbar.assign(t.getAttribute('data-id'), as); renderBag(); renderHotbar(); Player.say('Ditaruh di slot ' + (as.charAt(0) === 'c' ? 'bulat ' : 'kotak ') + (+as.slice(1) + 1)); return; }
      var cl = t.getAttribute && t.getAttribute('data-clr');
      if (cl) { Hotbar.unassign(cl); renderBag(); renderHotbar(); return; }
      var s = findAttr(t, bagEl, 'data-i');
      if (s) { sel = parseInt(s.getAttribute('data-i'), 10); renderBag(); }
    });
  }

  function show(name) {
    cur = name;
    craftEl.style.display = name === 'craft' ? 'block' : 'none';
    bagEl.style.display = name === 'bag' ? 'block' : 'none';
    shopEl.style.display = name === 'shop' ? 'block' : 'none';
    boardEl.style.display = name === 'board' ? 'block' : 'none';
    pbEl.style.display = name === 'pboard' ? 'block' : 'none';
    signEl.style.display = name === 'sign' ? 'block' : 'none';
    if (name === 'shop') renderShop();
    if (name === 'board') renderBoard();
    if (name === 'craft') renderCraft();
    if (name === 'pboard') renderPBoard();
    if (name === 'bag') { sel = -1; renderBag(); }
  }

  function openSign(x, y) {
    var txt = Farm.signText(x, y);
    if (txt === null) return;
    signAt = [x, y];
    var mine = Farm.owned(x, y);
    show('sign');
    signEl.innerHTML = '<div class="ch">Papan <span id="sgx">X</span></div>' +
      (mine ? '<input id="sgt" maxlength="40" placeholder="Tulis sesuatu (maks 40 huruf)" value="' + txt.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '">' +
              '<button id="sgs">Simpan</button> <button id="sgp" class="red">Ambil papan</button>'
            : '<div class="cr"></div>');
    if (!mine) signEl.lastChild.textContent = txt || '(kosong)';
  }

  function costHtml(r, inv) {
    var out = '';
    for (var k in r.cost) {
      var have = inv[k] || 0, ok = have >= r.cost[k];
      out += '<span class="cc' + (ok ? '' : ' no') + '">' + Icons.img(k, 'ci2') + have + '/' + r.cost[k] + '</span>';
    }
    return out;
  }

  function renderCraft() {
    var inv = Player.state.inv;
    var near = Player.nearTable();
    var h = '<div class="ch">Buat barang <span id="cx">X</span></div>';
    var cur = null;
    for (var i = 0; i < Crafting.RECIPES.length; i++) if (Crafting.RECIPES[i].id === csel) cur = Crafting.RECIPES[i];
    if (!cur) { cur = Crafting.RECIPES[0]; csel = cur.id; }
    var owned = Crafting.has(cur, inv), ok = Crafting.canCraft(cur, inv, { table: near });
    h += '<div class="cdet">' + Icons.img(cur.id, 'cbig') + '<div><b>' + cur.name + '</b><br><small>' + cur.note + '</small><div class="cost">' + costHtml(cur, inv) + '</div>' +
         (owned ? '<span class="own">Dimiliki</span>' : '<button id="cmk"' + (ok ? '' : ' disabled') + '>' + (near ? 'Buat' : 'Butuh meja kerja') + '</button>') + '</div></div>';
    h += '<div class="cgrid">';
    for (i = 0; i < Crafting.RECIPES.length; i++) {
      var r = Crafting.RECIPES[i], can = Crafting.canCraft(r, inv, { table: near });
      h += '<div class="cc2' + (r.id === csel ? ' on' : '') + (can ? ' can' : '') + '" data-r="' + r.id + '">' + Icons.img(r.id, 'ci3') + '<span>' + r.name + '</span></div>';
    }
    h += '</div><div class="sec">Meja kerja di dekat: <b style="color:' + (near ? '#7fd' : '#f88') + '">' + (near ? 'ADA' : 'TIDAK ADA') + '</b> <button id="tpick">Ambil bangunan terdekat</button></div>';
    craftEl.innerHTML = h;
  }

  var ORDER_ITEMS = ['wood', 'stone', 'pebble', 'gold', 'ironore', 'iron', 'meat', 'bread', 'jagung', 'nanas', 'pisang', 'kelapa', 'mangga', 'jeruk', 'salak', 'kopi', 'kakao'];
  function openPBoard(bk) { pbKey = bk; show('pboard'); }
  function renderPBoard() {
    var b = Farm.boardData(pbKey), P = Player.state;
    if (!b) { show(null); return; }
    var h = '<div class="ch">Papan Order milikmu <span id="pbx">X</span></div><div class="sec">Kamu membayar di muka (uang ditahan). Pemain lain mengirim barang lewat 3 peti di bawah papan, lalu dibayar otomatis. Maks 3 order.</div>';
    for (var i = 0; i < 3; i++) {
      var o = b.orders[i];
      h += '<div class="cr"><b>Peti #' + (i + 1) + '</b> ';
      if (!o) {
        h += '<br><select id="pbi' + i + '">';
        for (var k = 0; k < ORDER_ITEMS.length; k++) h += '<option value="' + ORDER_ITEMS[k] + '">' + Bag.find(ORDER_ITEMS[k]).name + ' (NPC ' + Economy.base(ORDER_ITEMS[k]) + ')</option>';
        h += '</select> <input id="pbq' + i + '" type="number" min="1" max="200" value="10"> x <input id="pbu' + i + '" type="number" min="1" value="10"> koin<br><button id="pbs" data-i="' + i + '">Pasang order</button>';
      } else {
        var left = Math.max(0, Math.ceil((o.exp - Date.now()) / 60000));
        h += Icons.img(o.item, 'ci2') + Bag.find(o.item).name + ' ' + o.filled + '/' + o.qty + ' &middot; ' + o.unit + ' koin' + (o.closed ? ' (selesai)' : ' &middot; sisa ' + Math.floor(left / 60) + 'j ' + left % 60 + 'm') +
             '<br><small>Ditahan ' + o.escrow + ' koin &middot; belum diambil ' + (o.filled - o.taken) + '</small><br>' +
             '<button id="pbt" data-i="' + i + '"' + (o.filled - o.taken > 0 ? '' : ' disabled') + '>Ambil barang</button> ' +
             (o.closed ? '' : '<button id="pbc" data-i="' + i + '" class="red">Batalkan</button>');
      }
      h += '</div>';
    }
    h += '<div class="cr"><button id="pbrm" class="red">Ambil papan (semua order harus kosong)</button> <small>Uang: ' + P.money + '</small></div>';
    pbEl.innerHTML = h;
  }

  function renderHotbar() {
    var inv = Player.state.inv, selK = Hotbar.getSel();
    for (var k in hSlots) {
      var n = hSlots[k], id = Hotbar.idAt(k), c = id ? (inv[id] || 0) : 0;
      if (id && c > 0) {
        var it = Bag.find(id);
        n.innerHTML = Icons.img(id, 'hi') + (it.tool ? '' : '<span class="ct">' + c + '</span>');
      } else {
        n.innerHTML = '';
      }
      n.className = 'hs ' + (k.charAt(0) === 's' ? 'sq' : 'ci') + (k === selK ? ' on' : '');
    }
    var hid = Hotbar.held(inv);
    hLabel.textContent = hid ? Bag.find(hid).name + (hid === 'can' ? ' ' + Player.state.can + '/8' : '') : 'Tangan kosong';
  }

  function renderShop() {
    var p = Player.state, h = '<div class="ch">Toko desa &middot; Koin ' + p.money + ' <span id="sx">X</span></div>';
    h += '<div class="sec">Jual ke penjual (harga turun jika terlalu banyak dijual)</div>';
    var any = false;
    for (var i = 0; i < Bag.ITEMS.length; i++) {
      var it = Bag.ITEMS[i], c = p.inv[it.id] || 0;
      if (it.tool || c <= 0 || !Economy.base(it.id)) continue;
      any = true;
      h += '<div class="cr">' + Icons.img(it.id, 'ci2') + '<b>' + it.name + '</b> x' + c + ' &middot; ' + Economy.buyPrice(it.id) + ' koin/buah<br>' +
           '<button data-sell="' + it.id + '" data-n="1">Jual 1</button> ' +
           '<button data-sell="' + it.id + '" data-n="all">Jual semua</button></div>';
    }
    if (!any) h += '<div class="cr"><small>Tidak ada barang untuk dijual.</small></div>';
    h += '<div class="sec">Beli</div>';
    for (var k in Economy.SELL) {
      h += '<div class="cr">' + Icons.img(k, 'ci2') + '<b>' + Bag.find(k).name + '</b> &middot; ' + Economy.SELL[k] + ' koin<br><small>' + Bag.find(k).note + '</small><br>' +
           '<button data-buy="' + k + '"' + (p.money < Economy.SELL[k] ? ' disabled' : '') + '>Beli</button></div>';
    }
    shopEl.innerHTML = h;
  }

  function renderBoard() {
    var h = '<div class="ch">Papan Order <span id="ox">X</span></div>' +
            '<div class="sec">Ambil barangnya, lalu setor ke peti bernomor di sebelah kiri papan (tekan AKSI di peti). Dibayar otomatis.</div>';
    for (var i = 0; i < Orders.slots.length; i++) {
      var o = Orders.slots[i];
      if (!o) { h += '<div class="cr"><b>Peti #' + (i + 1) + '</b><br><small>Belum ada order.</small></div>'; continue; }
      var left = Math.max(0, Math.ceil((o.expireAt - Date.now()) / 60000));
      h += '<div class="cr"><b>Peti #' + (i + 1) + ': ' + Bag.find(o.item).name + ' ' + o.filled + '/' + o.qty + '</b><br>' +
           '<small>Dari ' + o.poster + ' &middot; ' + o.unit + ' koin/buah (NPC: ' + Economy.buyPrice(o.item) + ') &middot; sisa ' + left + ' menit</small><br>' +
           '<small>Total hadiah ' + o.price + ' koin</small></div>';
    }
    boardEl.innerHTML = h;
  }

  function renderBag() {
    var slots = Bag.slots(Player.state.inv);
    var h = '<div class="ch">Tas (' + slots.length + '/' + Bag.CAP + ') <span id="bx">X</span></div><div class="grid">';
    for (var i = 0; i < Bag.CAP; i++) {
      var s = slots[i];
      if (s) {
        h += '<div class="slot full' + (i === sel ? ' sel' : '') + '" data-i="' + i + '">' +
             Icons.img(s.item.id, 'bi') +
             '<span class="nm">' + s.item.short + '</span>' +
             '<span class="ct">' + (s.item.tool ? '' : s.count) + '</span></div>';
      } else {
        h += '<div class="slot"></div>';
      }
    }
    h += '</div><div id="binfo">';
    if (sel >= 0 && slots[sel]) {
      var it = slots[sel].item;
      h += '<b>' + it.name + '</b>' + (it.tool ? '' : ' x' + (Player.state.inv[it.id] || 0)) + '<br>' + it.note;
      var circ = Bag.isConsumable(it.id), nb = circ ? 3 : 4;
      h += '<div class="asg">Taruh di slot ' + (circ ? 'bulat' : 'kotak') + ': ';
      for (var z = 0; z < nb; z++) h += '<button data-as="' + (circ ? 'c' : 's') + z + '" data-id="' + it.id + '">' + (z + 1) + '</button>';
      h += '<button class="clr" data-clr="' + it.id + '">Lepas</button></div>';
    } else if (!slots.length) {
      h += 'Tas kosong.';
    } else {
      h += 'Ketuk item untuk melihat info. Resource menumpuk sampai ' + Bag.STACK + ' per slot.';
    }
    bagEl.innerHTML = h + '</div>';
  }

  // phase 0..1: 0 = tengah hari (12:00)
  function update(p, fps, now, daylight, phase) {
    if (now - last < 250) return;
    last = now;
    if (cur === 'board') renderBoard();
    Farm.tickBoards(Player.state, Date.now());
    renderHotbar();
    var pk = Player.pickable(), pn = pk ? ({ table: 'Meja', furnace: 'Tungku', bed: 'Kasur' }[pk.kind]) : '';
    if (pn !== pickKind) { pickKind = pn; pickEl.style.display = pn ? 'block' : 'none'; pickEl.textContent = 'Ambil ' + pn; }
    var hour = (((phase || 0) * 24) + 12) % 24;
    var hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
    function stat(cls, v) {
      var w = Math.max(0, Math.min(100, Math.round(v)));
      return '<div class="st"><i class="ic ' + cls + '"></i><span class="bar"><b class="f-' + cls + (w < 25 ? ' low' : '') +
             '" style="width:' + w + '%"></b></span><em>' + w + '</em></div>';
    }
    el.innerHTML = stat('hp', p.hp) + stat('food', p.hunger) + stat('water', p.thirst) +
      '<div class="st"><i class="ic coin"></i><em>' + p.money + '</em></div>' +
      '<div class="inf">' + (World.inCave() ? 'goa ' : '') + Math.floor(p.x / 16) + ',' + Math.floor(p.y / 16) +
      ' &middot; ' + pad(hh) + ':' + pad(mm) + (Player.pvpNow() ? ' &middot; <b style="color:#f66">PVP</b>' : '') + ' &middot; ' + fps + 'fps' + (MP.connected() ? ' &middot; ' + MP.count() + ' online' : (Net.status() === 'offline' ? '' : ' &middot; ' + Net.status())) + '</div>';
  }

  return { init: init, update: update, show: show, renderHotbar: renderHotbar, openSign: openSign, openPBoard: openPBoard };
})();
