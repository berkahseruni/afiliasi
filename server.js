const express = require("express");
const fs = require("fs");
const path = require("path");
const { nanoid } = require("nanoid");
const multer = require("multer");
const sharp = require("sharp");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "links.json");
const UPLOAD_DIR = path.join(__dirname, "public", "uploads");

// Ganti ini dengan domain asli kamu setelah deploy (dipakai untuk generate link pendek & og:url)
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Pastikan folder uploads ada
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ---------- Setup upload foto ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${nanoid(10)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // maksimal 5MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file gambar (JPG, PNG, WEBP, GIF) yang diperbolehkan"));
    }
  },
});

// Upload multi-file untuk kolase — disimpan sementara di memory, bukan disk,
// karena cuma dipakai untuk digabung jadi satu gambar lalu dibuang.
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file gambar (JPG, PNG, WEBP, GIF) yang diperbolehkan"));
    }
  },
});

// Susun satu baris berisi `cols` foto dalam area (x0,y0,w,h), dengan jarak antar foto = gap
function makeRow(cols, x0, y0, w, h, gap) {
  const cellW = Math.floor((w - gap * (cols - 1)) / cols);
  const cells = [];
  for (let i = 0; i < cols; i++) {
    const x = x0 + i * (cellW + gap);
    const isLast = i === cols - 1;
    cells.push({ x, y: y0, w: isLast ? x0 + w - x : cellW, h });
  }
  return cells;
}

// Susunan grid kolase berdasarkan jumlah foto (maks 6 dipakai)
function getCollageLayout(n, W, H, gap = 6) {
  if (n === 1) return [{ x: 0, y: 0, w: W, h: H }];
  if (n === 2) return makeRow(2, 0, 0, W, H, gap);
  if (n === 3) return makeRow(3, 0, 0, W, H, gap);

  if (n === 4) {
    const rowH = Math.floor((H - gap) / 2);
    return [
      ...makeRow(2, 0, 0, W, rowH, gap),
      ...makeRow(2, 0, rowH + gap, W, H - rowH - gap, gap),
    ];
  }

  if (n === 5) {
    // 2 foto besar di atas, 3 foto lebih kecil di bawah
    const rowH1 = Math.round(H * 0.55);
    const rowH2 = H - rowH1 - gap;
    return [
      ...makeRow(2, 0, 0, W, rowH1, gap),
      ...makeRow(3, 0, rowH1 + gap, W, rowH2, gap),
    ];
  }

  // 6 foto -> grid 3x2
  const rowH = Math.floor((H - gap) / 2);
  return [
    ...makeRow(3, 0, 0, W, rowH, gap),
    ...makeRow(3, 0, rowH + gap, W, H - rowH - gap, gap),
  ];
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- Helper: baca & simpan data ----------
function readLinks() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw || "[]");
  } catch (e) {
    return [];
  }
}

function saveLinks(links) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(links, null, 2));
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------- API: upload foto preview ----------
app.post("/api/upload", upload.single("photo"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Tidak ada file yang diupload" });
  }
  const imageUrl = `${BASE_URL}/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

// ---------- API: buat kolase dari beberapa foto ----------
app.post("/api/collage", memoryUpload.array("photos", 6), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "Tidak ada file yang diupload" });
    }

    const CANVAS_W = 1200;
    const CANVAS_H = 630;
    const n = Math.min(files.length, 6); // kolase maksimal 6 foto
    const layout = getCollageLayout(n, CANVAS_W, CANVAS_H);

    const composites = [];
    for (let i = 0; i < n; i++) {
      const cell = layout[i];
      const buf = await sharp(files[i].buffer)
        .resize(cell.w, cell.h, { fit: "cover" })
        .toBuffer();
      composites.push({ input: buf, left: cell.x, top: cell.y });
    }

    const outName = `${nanoid(10)}.jpg`;
    const outPath = path.join(UPLOAD_DIR, outName);

    await sharp({
      create: { width: CANVAS_W, height: CANVAS_H, channels: 3, background: "#ffffff" },
    })
      .composite(composites)
      .jpeg({ quality: 85 })
      .toFile(outPath);

    res.json({ imageUrl: `${BASE_URL}/uploads/${outName}`, photosUsed: n });
  } catch (e) {
    res.status(500).json({ error: "Gagal membuat kolase: " + e.message });
  }
});

// Tangani error dari multer (misal file terlalu besar / tipe salah / terlalu banyak file)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

// ---------- API: buat link pendek baru ----------
app.post("/api/links", (req, res) => {
  const { target, title, description, image, customCode } = req.body;

  if (!target || !/^https?:\/\//i.test(target)) {
    return res.status(400).json({ error: "URL tujuan (target) wajib diisi dan harus diawali http:// atau https://" });
  }

  const links = readLinks();
  let code = (customCode || "").trim();

  if (code) {
    if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
      return res.status(400).json({ error: "Kode custom hanya boleh huruf, angka, - dan _" });
    }
    if (links.some((l) => l.code === code)) {
      return res.status(400).json({ error: "Kode itu sudah dipakai, coba kode lain" });
    }
  } else {
    do {
      code = nanoid(6);
    } while (links.some((l) => l.code === code));
  }

  const newLink = {
    code,
    target,
    title: title || "Klik untuk lihat penawaran ini",
    description: description || "",
    image: image || "",
    clicks: 0,
    createdAt: new Date().toISOString(),
  };

  links.unshift(newLink);
  saveLinks(links);

  res.json({ ...newLink, shortUrl: `${BASE_URL}/${code}` });
});

// ---------- API: daftar semua link ----------
app.get("/api/links", (req, res) => {
  const links = readLinks();
  res.json(links.map((l) => ({ ...l, shortUrl: `${BASE_URL}/${l.code}` })));
});

// ---------- API: hapus link ----------
app.delete("/api/links/:code", (req, res) => {
  let links = readLinks();
  const before = links.length;
  links = links.filter((l) => l.code !== req.params.code);
  saveLinks(links);
  res.json({ deleted: before !== links.length });
});

// ---------- Redirect + Open Graph ----------
app.get("/:code", (req, res, next) => {
  const links = readLinks();
  const link = links.find((l) => l.code === req.params.code);

  if (!link) return next(); // lanjut ke 404 / static file

  link.clicks += 1;
  saveLinks(links);

  const shortUrl = `${BASE_URL}/${link.code}`;

  // Halaman ini yang dibaca crawler Facebook (og:tags) sekaligus
  // otomatis redirect user asli ke link afiliasi tujuan.
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(link.title)}</title>
  <meta property="og:title" content="${escapeHtml(link.title)}" />
  <meta property="og:description" content="${escapeHtml(link.description)}" />
  <meta property="og:image" content="${escapeHtml(link.image)}" />
  <meta property="og:url" content="${escapeHtml(link.target)}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(link.title)}" />
  <meta name="twitter:description" content="${escapeHtml(link.description)}" />
  <meta name="twitter:image" content="${escapeHtml(link.image)}" />
  <script>window.location.replace(${JSON.stringify(link.target)});</script>
</head>
<body>
  <p>Mengalihkan ke penawaran... Jika tidak otomatis, <a href="${escapeHtml(link.target)}">klik di sini</a>.</p>
</body>
</html>`;

  res.send(html);
});

app.listen(PORT, () => {
  console.log(`Server jalan di ${BASE_URL}`);
});
