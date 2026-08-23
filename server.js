const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const SONGS_DIR = path.join(ROOT, "songs");

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(express.json());

// --------------------------------------------------
// Song scanner
// --------------------------------------------------

const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
  ".flac"
]);

function getAudioFiles(dir, category = null, results = []) {
  if (!fs.existsSync(dir)) {
    return results;
  }

  let items;

  try {
    items = fs.readdirSync(dir, {
      withFileTypes: true
    });
  } catch (error) {
    console.error("Cannot read directory:", dir);
    console.error(error.message);
    return results;
  }

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    // ----------------------------------------------
    // Directory
    // ----------------------------------------------

    if (item.isDirectory()) {
      // First folder under songs/ becomes category
      const nextCategory = category || item.name;

      getAudioFiles(
        fullPath,
        nextCategory,
        results
      );

      continue;
    }

    // ----------------------------------------------
    // File
    // ----------------------------------------------

    const extension = path
      .extname(item.name)
      .toLowerCase();

    if (!AUDIO_EXTENSIONS.has(extension)) {
      continue;
    }

    const relativePath = path.relative(
      SONGS_DIR,
      fullPath
    );

    // Encode every path component separately.
    // This safely handles spaces, &, #, Marathi,
    // Hindi and other special characters.
    const encodedPath = relativePath
      .split(path.sep)
      .map(part => encodeURIComponent(part))
      .join("/");

    const title =
      path.basename(item.name, extension).trim() ||
      "Untitled";

    results.push({
      id: `song-${results.length + 1}`,

      title,

      artist: "स्वरAJ",

      album: category || "Music",

      category: category || "Music",

      cover: "/images/default-cover.svg",

      url: `/songs/${encodedPath}`,

      file: relativePath
        .split(path.sep)
        .join("/")
    });
  }

  return results;
}

// --------------------------------------------------
// Get all songs
// --------------------------------------------------

function getSongs() {
  return getAudioFiles(SONGS_DIR);
}

// --------------------------------------------------
// Health API
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  try {
    const songs = getSongs();

    res.json({
      status: "ok",

      songsDirectory: SONGS_DIR,

      songsDirectoryExists:
        fs.existsSync(SONGS_DIR),

      songCount: songs.length,

      message:
        songs.length > 0
          ? "Songs are available"
          : "No audio files found inside songs/"
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      status: "error",
      songCount: 0,
      error: error.message
    });
  }
});

// --------------------------------------------------
// All songs API
// --------------------------------------------------

app.get("/api/songs", (req, res) => {
  try {
    const songs = getSongs();

    res.json({
      success: true,
      count: songs.length,
      songs
    });
  } catch (error) {
    console.error(
      "Song scan error:",
      error
    );

    res.status(500).json({
      success: false,
      count: 0,
      songs: [],
      error: error.message
    });
  }
});

// --------------------------------------------------
// Categories API
// --------------------------------------------------

app.get("/api/categories", (req, res) => {
  try {
    const songs = getSongs();

    const categoryMap = new Map();

    for (const song of songs) {
      const category = song.category;

      if (!categoryMap.has(category)) {
        categoryMap.set(category, 0);
      }

      categoryMap.set(
        category,
        categoryMap.get(category) + 1
      );
    }

    const categories = [...categoryMap.entries()]
      .map(([name, count]) => ({
        name,
        count
      }))
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );

    res.json({
      success: true,
      count: categories.length,
      categories
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      count: 0,
      categories: [],
      error: error.message
    });
  }
});

// --------------------------------------------------
// Search API
// --------------------------------------------------

app.get("/api/search", (req, res) => {
  try {
    const query = String(
      req.query.q || ""
    )
      .trim()
      .toLowerCase();

    const songs = getSongs();

    if (!query) {
      return res.json({
        success: true,
        count: songs.length,
        songs
      });
    }

    const results = songs.filter(song => {
      return [
        song.title,
        song.artist,
        song.album,
        song.category,
        song.file
      ].some(value =>
        String(value)
          .toLowerCase()
          .includes(query)
      );
    });

    res.json({
      success: true,
      count: results.length,
      songs: results
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      count: 0,
      songs: [],
      error: error.message
    });
  }
});

// --------------------------------------------------
// API 404
// --------------------------------------------------

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API endpoint not found"
  });
});

// --------------------------------------------------
// Static files
//
// IMPORTANT:
// Your GitHub project has index.html, styles.css,
// script.js and images/ in the ROOT.
// --------------------------------------------------

app.use(
  express.static(ROOT, {
    index: false,

    setHeaders: (res, filePath) => {
      const normalized = path.normalize(filePath);

      if (
        normalized.startsWith(
          path.normalize(SONGS_DIR) +
          path.sep
        )
      ) {
        res.setHeader(
          "Accept-Ranges",
          "bytes"
        );

        res.setHeader(
          "Cache-Control",
          "public, max-age=3600"
        );
      }
    }
  })
);

// --------------------------------------------------
// Dedicated song route
//
// Handles spaces and special characters safely.
// Supports browser audio seeking.
// --------------------------------------------------

app.get("/songs/*splat", (req, res) => {
  try {
    let requestedPath = req.params.splat;

    if (Array.isArray(requestedPath)) {
      requestedPath = requestedPath.join("/");
    }

    requestedPath = String(
      requestedPath || ""
    );

    // Decode URL path safely
    const decodedPath = requestedPath
      .split("/")
      .map(part => {
        try {
          return decodeURIComponent(part);
        } catch {
          return part;
        }
      })
      .join("/");

    const filePath = path.resolve(
      SONGS_DIR,
      decodedPath
    );

    const songsRoot = path.resolve(
      SONGS_DIR
    );

    // Security: don't allow files outside songs/
    if (
      filePath !== songsRoot &&
      !filePath.startsWith(
        songsRoot + path.sep
      )
    ) {
      return res.status(403).send(
        "Forbidden"
      );
    }

    if (!fs.existsSync(filePath)) {
      console.log(
        "Song not found:",
        filePath
      );

      return res.status(404).send(
        "Song not found"
      );
    }

    const stat = fs.statSync(filePath);

    if (!stat.isFile()) {
      return res.status(404).send(
        "Song not found"
      );
    }

    res.setHeader(
      "Accept-Ranges",
      "bytes"
    );

    res.setHeader(
      "Cache-Control",
      "public, max-age=3600"
    );

    res.sendFile(filePath);
  } catch (error) {
    console.error(
      "Song serving error:",
      error
    );

    res.status(500).send(
      "Unable to play song"
    );
  }
});

// --------------------------------------------------
// Frontend fallback
// --------------------------------------------------

app.get(/.*/, (req, res) => {
  const indexFile = path.join(
    ROOT,
    "index.html"
  );

  if (!fs.existsSync(indexFile)) {
    return res.status(404).send(
      "index.html not found"
    );
  }

  res.sendFile(indexFile);
});

// --------------------------------------------------
// Start server
// --------------------------------------------------

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    const songs = getSongs();

    console.log(
      "----------------------------------------"
    );

    console.log(
      `SwarAJ Music running on port ${PORT}`
    );

    console.log(
      `Songs directory: ${SONGS_DIR}`
    );

    console.log(
      `Songs found: ${songs.length}`
    );

    if (songs.length) {
      console.log(
        "Available songs:"
      );

      songs.forEach(song => {
        console.log(
          ` - [${song.category}] ${song.title}`
        );
      });
    } else {
      console.log(
        "WARNING: No audio files found."
      );
    }

    console.log(
      "----------------------------------------"
    );
  }
);