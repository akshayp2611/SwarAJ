const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

const ROOT = __dirname;
const SONGS_DIR = path.join(ROOT, "songs");
const IMAGES_DIR = path.join(ROOT, "images");

const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".ogg",
  ".flac",
  ".webm"
]);

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif"
]);

app.disable("x-powered-by");

app.use(express.json({ limit: "1mb" }));

function ensureDirectories() {
  if (!fs.existsSync(SONGS_DIR)) {
    fs.mkdirSync(SONGS_DIR, { recursive: true });
  }

  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }
}

ensureDirectories();

function cleanName(filename) {
  return filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function encodePath(parts) {
  return parts
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function scanSongs() {
  const songs = [];

  if (!fs.existsSync(SONGS_DIR)) {
    return songs;
  }

  function walk(directory) {
    let entries = [];

    try {
      entries = fs.readdirSync(directory, {
        withFileTypes: true
      });
    } catch (error) {
      console.error("Unable to read directory:", directory, error.message);
      return;
    }

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();

      if (!AUDIO_EXTENSIONS.has(extension)) {
        continue;
      }

      const relativePath = path.relative(SONGS_DIR, absolutePath);
      const pathParts = relativePath.split(path.sep);

      const category =
        pathParts.length > 1
          ? cleanName(pathParts[0])
          : "All Songs";

      const filename = entry.name;

      let stats;

      try {
        stats = fs.statSync(absolutePath);
      } catch {
        stats = null;
      }

      songs.push({
        id: Buffer.from(relativePath).toString("base64url"),
        title: cleanName(filename),
        filename,
        category,
        extension: extension.substring(1),
        size: stats ? stats.size : 0,
        url:
          "/songs/" +
          encodePath(pathParts),
        cover:
          "/api/cover/" +
          encodeURIComponent(category)
      });
    }
  }

  walk(SONGS_DIR);

  songs.sort((a, b) =>
    a.title.localeCompare(b.title, undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );

  return songs;
}

function findCover(category) {
  const possibleNames = [
    category,
    category.toLowerCase(),
    category.replace(/\s+/g, "-"),
    category.replace(/\s+/g, "_"),
    "default",
    "ganpati"
  ];

  for (const name of possibleNames) {
    for (const extension of IMAGE_EXTENSIONS) {
      const file = path.join(IMAGES_DIR, name + extension);

      if (fs.existsSync(file)) {
        return file;
      }
    }
  }

  let files = [];

  try {
    files = fs.readdirSync(IMAGES_DIR);
  } catch {
    return null;
  }

  const image = files.find((file) =>
    IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase())
  );

  return image ? path.join(IMAGES_DIR, image) : null;
}

/*
|--------------------------------------------------------------------------
| API
|--------------------------------------------------------------------------
*/

app.get("/api/health", (req, res) => {
  const songs = scanSongs();

  res.json({
    status: "ok",
    service: "स्वरAJ Music",
    environment: process.env.NODE_ENV || "production",
    port: PORT,
    songsDirectory: SONGS_DIR,
    songsDirectoryExists: fs.existsSync(SONGS_DIR),
    songCount: songs.length,
    timestamp: new Date().toISOString()
  });
});

app.get("/api/songs", (req, res) => {
  try {
    const songs = scanSongs();

    res.json({
      success: true,
      count: songs.length,
      songs
    });
  } catch (error) {
    console.error("Song scan failed:", error);

    res.status(500).json({
      success: false,
      count: 0,
      songs: [],
      error: "Unable to scan songs"
    });
  }
});

app.get("/api/categories", (req, res) => {
  try {
    const songs = scanSongs();

    const map = new Map();

    for (const song of songs) {
      if (!map.has(song.category)) {
        map.set(song.category, {
          name: song.category,
          count: 0,
          cover: song.cover
        });
      }

      map.get(song.category).count++;
    }

    const categories = Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    res.json({
      success: true,
      count: categories.length,
      categories
    });
  } catch (error) {
    console.error("Category scan failed:", error);

    res.status(500).json({
      success: false,
      count: 0,
      categories: []
    });
  }
});

app.get("/api/search", (req, res) => {
  const query = String(req.query.q || "")
    .trim()
    .toLowerCase();

  if (!query) {
    return res.json({
      success: true,
      count: 0,
      songs: []
    });
  }

  const songs = scanSongs();

  const results = songs.filter((song) => {
    return (
      song.title.toLowerCase().includes(query) ||
      song.category.toLowerCase().includes(query) ||
      song.filename.toLowerCase().includes(query)
    );
  });

  res.json({
    success: true,
    count: results.length,
    songs: results
  });
});

app.get("/api/cover/:category", (req, res) => {
  const category = decodeURIComponent(req.params.category || "");

  const cover = findCover(category);

  if (!cover) {
    return res.status(404).send("Cover not found");
  }

  res.sendFile(cover);
});

/*
|--------------------------------------------------------------------------
| Static files
|--------------------------------------------------------------------------
*/

app.use(
  "/songs",
  express.static(SONGS_DIR, {
    fallthrough: false,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=31536000");
      res.setHeader("Accept-Ranges", "bytes");
    }
  })
);

app.use(
  "/images",
  express.static(IMAGES_DIR, {
    maxAge: "7d"
  })
);

app.use(
  express.static(ROOT, {
    extensions: ["html"]
  })
);

/*
|--------------------------------------------------------------------------
| SPA fallback
|--------------------------------------------------------------------------
*/

app.get("*", (req, res) => {
  if (
    req.path.startsWith("/api/") ||
    req.path.startsWith("/songs/") ||
    req.path.startsWith("/images/")
  ) {
    return res.status(404).json({
      error: "Not found"
    });
  }

  res.sendFile(path.join(ROOT, "index.html"));
});

/*
|--------------------------------------------------------------------------
| Error handler
|--------------------------------------------------------------------------
*/

app.use((error, req, res, next) => {
  console.error("Server error:", error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    success: false,
    error: "Internal server error"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  const songs = scanSongs();

  console.log("==========================================");
  console.log(" स्वरAJ Premium Music Server");
  console.log("==========================================");
  console.log(`Port: ${PORT}`);
  console.log(`Songs directory: ${SONGS_DIR}`);
  console.log(`Songs found: ${songs.length}`);

  if (songs.length === 0) {
    console.warn("WARNING: No audio files found.");
    console.warn("Add MP3 files inside the songs/ directory.");
  } else {
    console.log("Music library:");

    const categories = {};

    songs.forEach((song) => {
      categories[song.category] =
        (categories[song.category] || 0) + 1;
    });

    Object.entries(categories).forEach(([name, count]) => {
      console.log(`  ${name}: ${count}`);
    });
  }

  console.log("==========================================");
});