// Net: akun dan sinkron simpan ke server (tahap 1). Bila game dibuka dari alamat server, alamatnya otomatis.
// Bila dibuka dari berkas lokal (Acode), isi alamat server di panel Akun.
var Net = (function () {
  var KEY = 'survival_wilderness_net_v1';
  var st = { base: '', token: '', user: '' };
  var lastErr = '';
  try {
    var s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') { st.base = String(s.base || ''); st.token = String(s.token || ''); st.user = String(s.user || ''); }
  } catch (e) {}

  function persist() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function origin() { return /^https?:$/.test(location.protocol) ? location.origin : ''; }
  function base() { return origin() || st.base; }
  function setBase(u) {
    u = String(u || '').trim().replace(/\/+$/, '');
    if (u && !/^https?:\/\//i.test(u)) u = 'http://' + u;
    st.base = u; persist();
  }

  function req(method, path, body, keep) {
    var b = base();
    if (!b) return Promise.reject({ status: 0, msg: 'Alamat server belum diisi' });
    var h = { 'Content-Type': 'application/json' };
    if (st.token) h.Authorization = 'Bearer ' + st.token;
    return fetch(b + path, { method: method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), keepalive: !!keep }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          if (r.status === 401 && st.token && path.indexOf('/api/login') < 0 && path.indexOf('/api/register') < 0) { st.token = ''; st.user = ''; persist(); }
          throw { status: r.status, msg: j.error || ('Kesalahan ' + r.status) };
        }
        return j;
      });
    }, function () { throw { status: 0, msg: 'Server tidak terjangkau' }; });
  }

  function auth(path, user, pass) {
    return req('POST', path, { user: user, pass: pass }).then(function (j) {
      st.token = j.token; st.user = j.user; lastErr = ''; persist();
      return j;
    });
  }

  return {
    base: base, setBase: setBase, needsBase: function () { return !origin(); },
    user: function () { return st.user; },
    token: function () { return st.token; },
    online: function () { return !!(st.token && st.user); },
    login: function (u, p) { return auth('/api/login', u, p); },
    register: function (u, p) { return auth('/api/register', u, p); },
    logout: function () {
      var done = function () { st.token = ''; st.user = ''; lastErr = ''; persist(); };
      return req('POST', '/api/logout').then(done, done);
    },
    getSave: function () { return req('GET', '/api/save'); },
    putSave: function (obj, keep) {
      return req('PUT', '/api/save', obj, keep && JSON.stringify(obj).length < 60000).then(function () { lastErr = ''; }, function (e) { lastErr = e.msg || 'gagal'; throw e; });
    },
    putMap: function (str) { return req('PUT', '/api/map', { map: str }).catch(function () {}); },
    status: function () { return !st.token ? 'offline' : (lastErr ? 'gagal' : 'online'); }
  };
})();
