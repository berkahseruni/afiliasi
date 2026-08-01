const express = require("express");
const fs = require("fs");
const path = require("path");
const { nanoid } = require("nanoid");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "links.json");

// Ganti ini dengan domain asli kamu setelah deploy (dipakai untuk generate link pendek & og:url)
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

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
  <meta property="og:url" content="${escapeHtml(shortUrl)}" />
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
