// Store: penyimpanan data server. Semua data dipegang di memori (cepat), lalu ditulis ke:
//  - berkas JSON di DATA_DIR (bawaan; di Render gratis HILANG saat restart), atau
//  - PostgreSQL bila DATABASE_URL diisi (tahan restart; mis. Neon gratis).
'use strict';
const fs = require('fs');
const path = require('path');

const KINDS = ['users', 'saves', 'maps', 'social'];

function writeAtomic(file, text) {
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}
function readJSON(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } }

function create(opts) {
  const DATA = opts.dataDir, log = opts.log || console.log;
  const mem = { meta: {} };
  for (const k of KINDS) mem[k] = {};
  let mode = 'file', pool = null;
  const dirty = new Map();          // "kind\u0000key" -> true  (hanya untuk mode pg)
  let timer = null, flushing = Promise.resolve();

  function fileOf(kind, key) { return kind === 'meta' ? path.join(DATA, key + '.json') : path.join(DATA, kind, key + '.json'); }

  async function init() {
    fs.mkdirSync(DATA, { recursive: true });
    for (const k of KINDS) fs.mkdirSync(path.join(DATA, k), { recursive: true });
    if (opts.databaseUrl) {
      try {
        const { Pool } = require('pg');
        pool = new Pool({ connectionString: opts.databaseUrl, ssl: { rejectUnauthorized: false }, max: 3, connectionTimeoutMillis: 15000 });
        pool.on('error', e => log('[db] ' + e.message));
        await pool.query('CREATE TABLE IF NOT EXISTS kv (kind text NOT NULL, key text NOT NULL, val text NOT NULL, PRIMARY KEY (kind, key))');
        const r = await pool.query('SELECT kind, key, val FROM kv');
        let n = 0;
        for (const row of r.rows) {
          if (!mem[row.kind]) continue;
          try { mem[row.kind][row.key] = JSON.parse(row.val); n++; } catch (e) {}
        }
        mode = 'pg';
        log('Penyimpanan: PostgreSQL (' + n + ' data dimuat). Data aman dari restart.');
        return;
      } catch (e) {
        log('PERINGATAN: database gagal dipakai (' + e.message + '). Memakai berkas lokal; di Render gratis data HILANG saat restart.');
        try { if (pool) await pool.end(); } catch (e2) {}
        pool = null;
      }
    }
    for (const k of KINDS) {
      for (const f of fs.readdirSync(path.join(DATA, k))) {
        if (!f.endsWith('.json')) continue;
        const v = readJSON(path.join(DATA, k, f));
        if (v) mem[k][f.slice(0, -5)] = v;
      }
    }
    const s = readJSON(path.join(DATA, 'sessions.json'));
    if (s) mem.meta.sessions = s;
    mode = 'file';
    log('Penyimpanan: berkas lokal di ' + DATA + (process.env.RENDER ? '  (PERINGATAN: Render gratis menghapus berkas saat restart; isi DATABASE_URL)' : ''));
  }

  function get(kind, key) { const v = mem[kind] && mem[kind][key]; return v === undefined ? null : v; }
  function has(kind, key) { return !!(mem[kind] && mem[kind][key] !== undefined); }
  function keys(kind) { return Object.keys(mem[kind] || {}); }
  function count(kind) { return keys(kind).length; }

  async function flush() {
    if (mode !== 'pg' || !dirty.size) return flushing;
    const batch = Array.from(dirty.keys());
    dirty.clear();
    flushing = flushing.then(async () => {
      for (const id of batch) {
        const [kind, key] = id.split('\u0000');
        try {
          await pool.query('INSERT INTO kv (kind, key, val) VALUES ($1, $2, $3) ON CONFLICT (kind, key) DO UPDATE SET val = EXCLUDED.val',
            [kind, key, JSON.stringify(mem[kind][key])]);
        } catch (e) { log('[db] gagal menulis ' + id.replace('\u0000', '/') + ': ' + e.message); dirty.set(id, true); }
      }
    });
    return flushing;
  }

  function set(kind, key, val) {
    if (!mem[kind]) throw new Error('kind tidak dikenal');
    mem[kind][key] = val;
    if (mode === 'pg') {
      dirty.set(kind + '\u0000' + key, true);
      if (!timer) timer = setTimeout(() => { timer = null; flush(); }, 3000);
    } else {
      try { writeAtomic(fileOf(kind, key), JSON.stringify(val)); } catch (e) { log('gagal menulis berkas: ' + e.message); }
    }
  }

  return { init, get, set, has, keys, count, flush, mode: () => mode };
}

module.exports = { create };
