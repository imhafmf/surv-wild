// Hotbar: 4 slot kotak (alat, bahan, meja) + 3 slot bulat (makanan & minuman).
// Slot hanya PINTASAN ke tumpukan di tas (jumlahnya tetap dibaca dari tas).
// AKSI selalu memakai item yang sedang dipegang (slot terpilih). Tidak ada slot terpilih = tangan kosong.
var Hotbar = (function () {
  var slots = { s: [null, null, null, null], c: [null, null, null] };
  var sel = 's0';
  var had = {};      // item yang sudah pernah dimasukkan otomatis (supaya yang dilepas pemain tidak balik sendiri)

  function grp(k) { return k.charAt(0); }
  function idx(k) { return +k.slice(1); }
  function idAt(k) { return slots[grp(k)][idx(k)]; }
  function getSel() { return sel; }

  // id item yang dipegang, atau null (tangan kosong / slot kosong / jumlah habis)
  function held(inv) {
    if (!sel) return null;
    var id = idAt(sel);
    return (id && (inv[id] || 0) > 0) ? id : null;
  }

  function isAssigned(id) {
    for (var g in slots) for (var i = 0; i < slots[g].length; i++) if (slots[g][i] === id) return true;
    return false;
  }

  function unassign(id) {
    for (var g in slots) for (var i = 0; i < slots[g].length; i++) if (slots[g][i] === id) slots[g][i] = null;
  }

  function assign(id, k) {
    if ((grp(k) === 'c') !== Bag.isConsumable(id)) return false;   // makanan/minuman hanya di slot bulat
    unassign(id);
    slots[grp(k)][idx(k)] = id;
    had[id] = true;
    return true;
  }

  // Ketuk slot: pilih. Ketuk slot yang sudah dipilih: tangan kosong.
  function select(k) { sel = (sel === k) ? null : k; }

  // Item baru yang masuk tas otomatis menempati slot kosong pertama yang sesuai
  function update(inv) {
    for (var n = 0; n < Bag.ITEMS.length; n++) {
      var id = Bag.ITEMS[n].id, c = inv[id] || 0;
      if (c > 0 && !had[id]) {
        had[id] = true;
        if (Bag.autoHotbar(id) && !isAssigned(id)) {
          var arr = slots[Bag.isConsumable(id) ? 'c' : 's'];
          // slot kosong, atau slot yang itemnya sudah habis, dianggap bebas
          for (var i = 0; i < arr.length; i++) if (!arr[i] || (inv[arr[i]] || 0) <= 0) { arr[i] = id; break; }
        }
      } else if (c <= 0) {
        had[id] = false;
      }
    }
  }

  function reset() {
    slots = { s: [null, null, null, null], c: [null, null, null] };
    sel = 's0';
    had = {};
  }

  function serialize() { return { s: slots.s.slice(), c: slots.c.slice(), sel: sel, had: had }; }

  function restore(o) {
    reset();
    if (!o || !o.s || !o.c) return;
    for (var i = 0; i < 4; i++) slots.s[i] = (typeof o.s[i] === 'string' && Bag.find(o.s[i]) && !Bag.isConsumable(o.s[i])) ? o.s[i] : null;
    for (i = 0; i < 3; i++) slots.c[i] = (typeof o.c[i] === 'string' && Bag.isConsumable(o.c[i])) ? o.c[i] : null;
    sel = (typeof o.sel === 'string' && /^(s[0-3]|c[0-2])$/.test(o.sel)) ? o.sel : null;
    had = (o.had && typeof o.had === 'object') ? o.had : {};
  }

  return { held: held, idAt: idAt, getSel: getSel, select: select, assign: assign, unassign: unassign,
           update: update, reset: reset, serialize: serialize, restore: restore };
})();
