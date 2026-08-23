const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const SONGS_DIR = path.join(ROOT, "songs");
const IMAGES_DIR = path.join(ROOT, "images");

for (const dir of [SONGS_DIR, IMAGES_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

app.use(express.json({ limit: "2mb" }));
app.use(express.static(ROOT));

const AUDIO_EXTENSIONS = new Set([".mp3", ".m4a", ".aac", ".ogg", ".wav", ".webm"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function cleanTitle(filename) {
  return path.basename(filename, path.extname(filename))
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryFromPath(relativePath) {
  const parts = relativePath.split(path.sep);
  return parts.length > 1 ? parts[0] : "All Songs";
}

function findCover(category, relativeSongPath) {
  const folder = path.join(SONGS_DIR, path.dirname(relativeSongPath));
  const candidates = [
    path.join(folder, "cover.jpg"),
    path.join(folder, "cover.jpeg"),
    path.join(folder, "cover.png"),
    path.join(folder, "cover.webp"),
    path.join(IMAGES_DIR, `${category}.jpg`),
    path.join(IMAGES_DIR, `${category}.png`),
    path.join(IMAGES_DIR, "default-cover.jpg")
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      const rel = path.relative(ROOT, file).split(path.sep).join("/");
      return "/" + rel.split("/").map(encodeURIComponent).join("/");
    }
  }
  return "/images/default-cover.svg";
}

function scanSongs() {
  const result = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        const relative = path.relative(SONGS_DIR, full);
        const category = categoryFromPath(relative);
        const encodedPath = relative.split(path.sep).map(encodeURIComponent).join("/");
        result.push({
          id: Buffer.from(relative).toString("base64url"),
          title: cleanTitle(entry.name),
          artist: category === "All Songs" ? "स्वरAJ" : category,
          album: category,
          category,
          url: `/songs/${encodedPath}`,
          cover: findCover(category, relative),
          filename: entry.name
        });
      }
    }
  }

  walk(SONGS_DIR);
  result.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  return result.map((song, index) => ({ ...song, index }));
}

app.get("/api/health", (req, res) => {
  const songs = scanSongs();
  res.json({
    ok: true,
    service: "स्वरAJ",
    songs: songs.length,
    time: new Date().toISOString()
  });
});

app.get("/api/songs", (req, res) => {
  res.json(scanSongs());
});

app.get("/api/categories", (req, res) => {
  const songs = scanSongs();
  const map = new Map();
  for (const song of songs) {
    if (!map.has(song.category)) map.set(song.category, 0);
    map.set(song.category, map.get(song.category) + 1);
  }
  const categories = [...map.entries()].map(([name, count]) => ({ name, count }));
  res.json(categories);
});

app.get("/api/search", (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (!q) return res.json([]);
  const songs = scanSongs().filter(s =>
    [s.title, s.artist, s.album, s.category].some(v => v.toLowerCase().includes(q))
  );
  res.json(songs);
});

app.get("*splat", (req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "API route not found" });
  res.sendFile(path.join(ROOT, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`स्वरAJ running on port ${PORT}`);
});