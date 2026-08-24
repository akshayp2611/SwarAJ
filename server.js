const express = require("express");
const fs = require("fs");
const path = require("path");

const {
  initializeDatabase,
  isDatabaseAvailable,
  getSongs,
  getCategories,
  upsertSong,
  removeMissingSongs,
  closeDatabase
} = require("./database");

const app = express();

const PORT = process.env.PORT || 3000;

const ROOT_DIR = __dirname;
const SONGS_DIR = path.join(ROOT_DIR, "songs");
const IMAGES_DIR = path.join(ROOT_DIR, "images");

const INDEX_FILE = path.join(ROOT_DIR, "index.html");

app.disable("x-powered-by");

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ----------------------------------------------------
// Ensure directories exist
// ----------------------------------------------------

if (!fs.existsSync(SONGS_DIR)) {
  fs.mkdirSync(SONGS_DIR, {
    recursive: true
  });
}

if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, {
    recursive: true
  });
}

// ----------------------------------------------------
// Utility functions
// ----------------------------------------------------

function cleanText(value, fallback = "") {
  if (!value) return fallback;

  return String(value)
    .replace(/\0/g, "")
    .trim();
}

function titleFromFilename(filename) {
  return path
    .basename(filename, path.extname(filename))
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function encodePathParts(relativePath) {
  return relativePath
    .split(path.sep)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function isAudioFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  return [
    ".mp3",
    ".m4a",
    ".aac",
    ".wav",
    ".ogg",
    ".flac"
  ].includes(extension);
}

function getCategory(relativePath) {
  const parts = relativePath.split(path.sep);

  if (parts.length >= 2) {
    return parts[0] || "Uncategorized";
  }

  return "Uncategorized";
}

function getCoverForCategory(category) {
  const possibleFiles = [
    `${category}.jpg`,
    `${category}.jpeg`,
    `${category}.png`,
    `${category}.webp`,
    "cover.jpg",
    "cover.jpeg",
    "cover.png",
    "ganpati.jpg"
  ];

  for (const file of possibleFiles) {
    const filePath = path.join(IMAGES_DIR, file);

    if (fs.existsSync(filePath)) {
      return `/images/${encodeURIComponent(file)}`;
    }
  }

  return null;
}

// ----------------------------------------------------
// Recursive song scanner
// ----------------------------------------------------

function scanSongsDirectory(directory) {
  const songs = [];

  function walk(currentDirectory) {
    let entries = [];

    try {
      entries = fs.readdirSync(currentDirectory, {
        withFileTypes: true
      });
    } catch (error) {
      console.error(
        "Unable to read directory:",
        currentDirectory,
        error.message
      );

      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(
        currentDirectory,
        entry.name
      );

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!isAudioFile(fullPath)) {
        continue;
      }

      const relativePath = path.relative(
        SONGS_DIR,
        fullPath
      );

      const category = getCategory(relativePath);

      const title = titleFromFilename(entry.name);

      const encodedRelativePath =
        encodePathParts(relativePath);

      songs.push({
        title,
        artist: "स्वरAJ",
        album: category,
        category,
        filename: relativePath,
        file_path: `/songs/${encodedRelativePath}`,
        cover: getCoverForCategory(category),
        duration: 0
      });
    }
  }

  walk(directory);

  songs.sort((a, b) =>
    a.title.localeCompare(b.title)
  );

  return songs;
}

// ----------------------------------------------------
// Synchronize filesystem -> PostgreSQL
// ----------------------------------------------------

async function syncSongsToDatabase() {
  const scannedSongs = scanSongsDirectory(SONGS_DIR);

  console.log(
    `Found ${scannedSongs.length} audio files.`
  );

  if (!isDatabaseAvailable()) {
    return scannedSongs;
  }

  try {
    const existingFiles = [];

    for (const song of scannedSongs) {
      existingFiles.push(song.filename);

      await upsertSong(song);
    }

    await removeMissingSongs(existingFiles);

    console.log(
      `Database synchronized: ${scannedSongs.length} songs.`
    );

    return await getSongs();
  } catch (error) {
    console.error(
      "Database synchronization failed:",
      error.message
    );

    return scannedSongs;
  }
}

// ----------------------------------------------------
// Health API
// ----------------------------------------------------

app.get("/api/health", async (req, res) => {
  let dbStatus = "disconnected";

  if (isDatabaseAvailable()) {
    dbStatus = "connected";
  }

  const songs = scanSongsDirectory(SONGS_DIR);

  res.json({
    status: "ok",
    service: "स्वरAJ Music",
    nodeVersion: process.version,
    environment:
      process.env.NODE_ENV || "production",
    database: dbStatus,
    databaseConfigured:
      Boolean(process.env.DATABASE_URL),
    songsDirectoryExists:
      fs.existsSync(SONGS_DIR),
    imagesDirectoryExists:
      fs.existsSync(IMAGES_DIR),
    songCount: songs.length,
    timestamp: new Date().toISOString()
  });
});

// ----------------------------------------------------
// Songs API
// ----------------------------------------------------

app.get("/api/songs", async (req, res) => {
  try {
    const songs = await syncSongsToDatabase();

    res.json({
      success: true,
      count: songs.length,
      songs
    });
  } catch (error) {
    console.error(
      "/api/songs error:",
      error.message
    );

    res.status(500).json({
      success: false,
      error: "Unable to load songs",
      message: error.message,
      songs: []
    });
  }
});

// ----------------------------------------------------
// Categories API
// ----------------------------------------------------

app.get("/api/categories", async (req, res) => {
  try {
    if (isDatabaseAvailable()) {
      const categories = await getCategories();

      return res.json({
        success: true,
        categories
      });
    }

    const songs = scanSongsDirectory(SONGS_DIR);

    const map = new Map();

    for (const song of songs) {
      const category =
        song.category || "Uncategorized";

      map.set(
        category,
        (map.get(category) || 0) + 1
      );
    }

    const categories = Array.from(map.entries())
      .map(([category, song_count]) => ({
        category,
        song_count
      }))
      .sort((a, b) =>
        a.category.localeCompare(b.category)
      );

    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error(
      "/api/categories error:",
      error.message
    );

    res.status(500).json({
      success: false,
      categories: []
    });
  }
});

// ----------------------------------------------------
// Rescan API
// ----------------------------------------------------

app.post("/api/rescan", async (req, res) => {
  try {
    const songs = await syncSongsToDatabase();

    res.json({
      success: true,
      count: songs.length,
      message: "Music library synchronized."
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ----------------------------------------------------
// Static files
// ----------------------------------------------------

app.use(
  "/songs",
  express.static(SONGS_DIR, {
    fallthrough: false,
    maxAge: "1h"
  })
);

app.use(
  "/images",
  express.static(IMAGES_DIR, {
    fallthrough: false,
    maxAge: "1d"
  })
);

app.use(
  express.static(ROOT_DIR, {
    index: false,
    maxAge: "1h"
  })
);

// ----------------------------------------------------
// SPA / HTML fallback
// ----------------------------------------------------
//
// IMPORTANT:
// Do NOT use app.get("*") with Express 5.
// It causes:
// Missing parameter name at index 1: *
// ----------------------------------------------------

app.use((req, res, next) => {
  if (req.method !== "GET") {
    return next();
  }

  if (
    req.path.startsWith("/api/") ||
    req.path.startsWith("/songs/") ||
    req.path.startsWith("/images/")
  ) {
    return next();
  }

  const acceptsHtml =
    req.headers.accept &&
    req.headers.accept.includes("text/html");

  if (!acceptsHtml) {
    return next();
  }

  if (!fs.existsSync(INDEX_FILE)) {
    return res.status(404).send("index.html not found");
  }

  res.sendFile(INDEX_FILE);
});

// ----------------------------------------------------
// 404
// ----------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Not found",
    path: req.originalUrl
  });
});

// ----------------------------------------------------
// Start
// ----------------------------------------------------

async function startServer() {
  try {
    await initializeDatabase();

    await syncSongsToDatabase();

    app.listen(PORT, "0.0.0.0", () => {
      console.log("");
      console.log("======================================");
      console.log("        स्वरAJ MUSIC SERVER");
      console.log("======================================");
      console.log(`Port: ${PORT}`);
      console.log(`Songs: ${SONGS_DIR}`);
      console.log(`Images: ${IMAGES_DIR}`);
      console.log(
        `Database: ${
          isDatabaseAvailable()
            ? "CONNECTED"
            : "NOT CONNECTED"
        }`
      );
      console.log("======================================");
      console.log("");
    });
  } catch (error) {
    console.error(
      "Server startup error:",
      error
    );

    process.exit(1);
  }
}

process.on("SIGTERM", async () => {
  console.log("SIGTERM received.");

  await closeDatabase();

  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received.");

  await closeDatabase();

  process.exit(0);
});

startServer();