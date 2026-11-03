// wsmini: server WebSocket minimal (RFC 6455) tanpa paket. Dipakai bila paket "ws" tidak terpasang
// (mis. npm install gagal di penyimpanan bersama Android). API sengaja mirip "ws": WebSocketServer, clients, send, close, ping, terminate.
'use strict';
const crypto = require('crypto');
const { EventEmitter } = require('events');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

class Conn extends EventEmitter {
  constructor(socket, maxPayload) {
    super();
    this.socket = socket; this.maxPayload = maxPayload;
    this.readyState = 1; this.buf = Buffer.alloc(0); this.frag = null; this.fragLen = 0; this.closeSent = false;
    socket.setNoDelay(true);
    socket.on('data', d => this._data(d));
    socket.on('close', () => this._closed());
    socket.on('error', () => {});
  }
  _closed() { if (this.readyState === 3) return; this.readyState = 3; this.emit('close', this.closeCode || 1006); }
  _frame(op, payload) {
    const len = payload.length;
    let h;
    if (len < 126) h = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(len, 2); }
    else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); }
    return Buffer.concat([h, payload]);
  }
  send(data) { if (this.readyState === 1) this.socket.write(this._frame(1, Buffer.from(String(data)))); }
  ping() { if (this.readyState === 1) this.socket.write(this._frame(9, Buffer.alloc(0))); }
  close(code, reason) {
    if (this.readyState !== 1) return;
    this.readyState = 2; this.closeCode = code || 1000;
    const r = Buffer.from(String(reason || '').slice(0, 100)), p = Buffer.alloc(2 + r.length);
    p.writeUInt16BE(this.closeCode, 0); r.copy(p, 2);
    try { this.socket.write(this._frame(8, p)); } catch (e) {}
    this.closeSent = true;
    setTimeout(() => { try { this.socket.destroy(); } catch (e) {} }, 1500).unref();
  }
  terminate() { this.readyState = 3; try { this.socket.destroy(); } catch (e) {} this.emit('close', 1006); }

  _data(d) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    for (;;) {
      const b = this.buf;
      if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0, op = b[0] & 0x0f, masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; const big = b.readBigUInt64BE(2); if (big > BigInt(this.maxPayload)) return this._fail(1009); len = Number(big); off = 10; }
      if (!masked) return this._fail(1002);                        // klien wajib menyamarkan (mask)
      if (len > this.maxPayload || this.fragLen + len > this.maxPayload) return this._fail(1009);
      if (b.length < off + 4 + len) return;
      const mask = b.subarray(off, off + 4), payload = Buffer.from(b.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buf = b.subarray(off + 4 + len);
      if (op >= 8) {                                              // kontrol
        if (op === 8) { this.closeCode = payload.length >= 2 ? payload.readUInt16BE(0) : 1005; if (!this.closeSent) { this.readyState = 2; try { this.socket.write(this._frame(8, payload.subarray(0, 2))); } catch (e) {} } this.socket.end(); return; }
        if (op === 9) { try { this.socket.write(this._frame(10, payload)); } catch (e) {} }
        else if (op === 10) this.emit('pong');
        continue;
      }
      if (op === 0x1 || op === 0x2) { this.frag = [payload]; this.fragLen = payload.length; }
      else if (op === 0x0 && this.frag) { this.frag.push(payload); this.fragLen += payload.length; }
      else return this._fail(1002);
      if (fin) { const msg = Buffer.concat(this.frag); this.frag = null; this.fragLen = 0; this.emit('message', msg); }
    }
  }
  _fail(code) { this.close(code, ''); this.buf = Buffer.alloc(0); }
}

class WebSocketServer extends EventEmitter {
  constructor(opts) {
    super();
    this.clients = new Set();
    const path = opts.path || '/', max = opts.maxPayload || 1024;
    opts.server.on('upgrade', (req, socket) => {
      const url = (req.url || '').split('?')[0], key = req.headers['sec-websocket-key'];
      if (url !== path || !key || String(req.headers.upgrade || '').toLowerCase() !== 'websocket' || req.headers['sec-websocket-version'] !== '13') {
        socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); return socket.destroy();
      }
      const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
      const c = new Conn(socket, max);
      this.clients.add(c);
      c.on('close', () => this.clients.delete(c));
      this.emit('connection', c, req);
    });
  }
  close() { for (const c of this.clients) c.terminate(); this.clients.clear(); }
}
module.exports = { WebSocketServer };
