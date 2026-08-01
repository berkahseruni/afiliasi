# Affiliate Link Shortener + Facebook Preview

Aplikasi Node.js sederhana untuk memperpendek link afiliasi dan menampilkan
preview foto (Open Graph) saat dibagikan di Facebook/WhatsApp/Twitter.

## Cara Menjalankan di Komputer (opsional, untuk coba-coba)
```bash
npm install
npm start
```
Buka `http://localhost:3000`

## Cara Deploy ke Internet (gratis)

Karena preview Facebook butuh server yang benar-benar online, pilih salah satu:

### Opsi 1: Railway (paling mudah)
1. Buat akun di https://railway.app
2. New Project → Deploy from GitHub repo (upload folder ini ke GitHub dulu)
3. Railway otomatis deteksi Node.js dan jalankan `npm start`
4. Setelah deploy, buka Settings → Networking → Generate Domain
5. Tambahkan environment variable: `BASE_URL` = domain yang didapat (contoh: `https://xxxx.up.railway.app`)
6. Redeploy

### Opsi 2: Render
1. Buat akun di https://render.com
2. New → Web Service → hubungkan repo GitHub kamu
3. Build command: `npm install`, Start command: `npm start`
4. Tambahkan environment variable `BASE_URL` sesuai domain yang diberikan Render

### Opsi 3: VPS sendiri (misal DigitalOcean/Niagahoster)
1. Upload folder ini ke server
2. `npm install`
3. Jalankan dengan PM2: `pm2 start server.js`
4. Pasang domain + SSL (Nginx + certbot)
5. Set `BASE_URL` ke domain kamu

## Cara Pakai
1. Buka halaman utama (`/`)
2. Isi URL afiliasi tujuan, judul, deskripsi, dan **URL foto** untuk preview
3. Klik "Buat Link Pendek"
4. Bagikan link pendek yang muncul (contoh: `https://domainmu.com/promo-sepatu`) ke Facebook

## Catatan Penting
- **URL Foto Preview** harus link gambar yang bisa diakses publik (bukan upload
  file lokal). Upload dulu fotomu ke Imgur, Cloudinary, atau hosting gambar
  lain, lalu tempel link-nya.
- Ukuran foto ideal untuk Facebook: minimal 200x200px, disarankan 1200x630px.
- Setelah share pertama kali, Facebook menyimpan cache preview. Kalau kamu
  ganti foto/judul link yang sama, gunakan
  [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
  untuk refresh cache-nya.
- Data link disimpan di file `data/links.json`. Untuk skala besar/produksi,
  sebaiknya diganti ke database (misalnya PostgreSQL atau SQLite).
