# Server Survival Wilderness (tahap 2)

Fitur: akun, simpan progres + peta di server, pemain saling terlihat, chat (lokal/global/bisik), perintah, teman, blokir.
Perlu **Node.js 18+** saja. Tidak perlu `npm install`: server punya WebSocket bawaan. Paket `ws` dipakai otomatis kalau terpasang (tidak wajib).

## Jalankan di Termux (HP) + localtunnel
    pkg update && pkg install nodejs unzip
    unzip survival-game.zip && cd survival-game
    termux-wake-lock                  # supaya Termux tidak tidur
    TRUST_PROXY=1 node server/server.js          # jendela/sesi 1: server di port 3000

Sesi Termux kedua (geser dari tepi kiri > New session):
    npx localtunnel --port 3000       # mencetak alamat https://xxxx.loca.lt

Buka alamat itu dari HP mana pun (HTTPS otomatis, jadi chat wss jalan). Daftar akun di menu "Akun online".
Catatan localtunnel: kunjungan pertama dari peramban bisa menampilkan halaman pengingat yang minta "tunnel password"
(isinya IP publik pemilik tunnel; dicek di https://loca.lt/mytunnelpassword). Lewati sekali, lalu game jalan.
Alamat berubah tiap dijalankan ulang, jadi bagikan alamat baru ke teman. Data akun tersimpan di `server/data/`
(di HP-mu, tidak hilang), cadangkan folder itu.

## Perintah chat
/help · /w nama pesan (bisik) · /r pesan · /g pesan (global) · /me aksi · /teman · /teman tambah|terima|tolak|hapus nama · /blok nama · /buka nama · /online

## Opsi lain
- Env: PORT (3000), DATA_DIR, MAX_USERS (300), TRUST_PROXY=1 (di belakang proxy/tunnel), HOST.
- DATABASE_URL (PostgreSQL, mis. Neon) agar data tahan restart di hosting berkas-sementara seperti Render gratis. Belum diuji ke Neon sungguhan.
- Render gratis: server tidur setelah 15 menit sepi, berkas hilang saat restart (butuh DATABASE_URL).

## Keamanan yang sudah ada
Sandi di-hash (scrypt) · token acak 30 hari · batas percobaan login/daftar · ukuran data dibatasi · data simpan divalidasi ·
posisi pemain dicek kecepatannya · chat dibatasi laju (5 per 10 detik, global tiap 8 detik) dan karakter < > dibuang ·
koneksi tanpa login diputus 10 detik · hanya index.html, css/, js/ yang bisa diunduh.

## Belum
Server belum menghitung uang/panen/lahan (HP masih bisa mengubah angka sebelum dikirim, dalam batas validasi),
dan papan order milik pemain belum bisa diisi pemain lain. Itu tahap berikutnya.
