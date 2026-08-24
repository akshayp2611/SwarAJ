const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const ROOT_DIR = __dirname;
const SONGS_DIR = path.join(ROOT_DIR, "songs");

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------------------------------------------
// Create songs directory if it doesn't exist
// --------------------------------------------------

if (!fs.existsSync(SONGS_DIR)) {
  fs.mkdirSync(SONGS_DIR, { recursive: true });
}

// --------------------------------------------------
// Utility functions
// --------------------------------------------------

function cleanName(name) {
  return name
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function encodeSongPath(relativePath) {
  return relativePath
    .split(path.sep)
    .map(part => encodeURIComponent(part))
    .join("/");
}

function getCategory(relativePath) {
  const parts = relativePath.split(path.sep);

  if (parts.length > 1) {
    return parts[0];
  }

  return "All Songs";
}

// --------------------------------------------------
// Recursively scan songs directory
// --------------------------------------------------

function scanSongs() {
  const songs = [];

  function scanDirectory(directory) {
    let entries;

    try {
      entries = fs.readdirSync(directory, {
        withFileTypes: true
      });
    } catch (error) {
      console.error("Unable to read directory:", directory);
      console.error(error.message);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        scanDirectory(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();

      if (![".mp3", ".m4a", ".wav", ".ogg", ".aac"].includes(extension)) {
        continue;
      }

      const relativePath = path.relative(
        SONGS_DIR,
        fullPath
      );

      const normalizedRelativePath = relativePath.split(path.sep);

      const category =
        normalizedRelativePath.length > 1
          ? normalizedRelativePath[0]
          : "All Songs";

      const fileName = path.basename(entry.name);

      const title = cleanName(fileName);

      const encodedPath = encodeSongPath(relativePath);

      songs.push({
        id: songs.length + 1,

        title,

        artist: "SwarAJ",

        album: category,

        category,

        filename: fileName,

        path: relativePath.replace(/\\/g, "/"),

        url: `/songs/${encodedPath}`,

        type: extension.substring(1)
      });
    }
  }

  scanDirectory(SONGS_DIR);

  songs.sort((a, b) =>
    a.title.localeCompare(b.title)
  );

  return songs.map((song, index) => ({
    ...song,
    id: index + 1
  }));
}

// --------------------------------------------------
// API: Health
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  const songs = scanSongs();

  res.json({
    status: "ok",
    message: "SwarAJ server is running",
    node: process.version,
    songsDirectory: SONGS_DIR,
    songsFound: songs.length,
    timestamp: new Date().toISOString()
  });
});

// --------------------------------------------------
// API: All songs
// --------------------------------------------------

app.get("/api/songs", (req, res) => {
  try {
    const songs = scanSongs();

    res.json({
      success: true,
      count: songs.length,
      songs
    });
  } catch (error) {
    console.error("Song scanning error:", error);

    res.status(500).json({
      success: false,
      count: 0,
      songs: [],
      error: error.message
    });
  }
});

// --------------------------------------------------
// API: Categories
// --------------------------------------------------

app.get("/api/categories", (req, res) => {
  try {
    const songs = scanSongs();

    const categoryMap = {};

    for (const song of songs) {
      if (!categoryMap[song.category]) {
        categoryMap[song.category] = 0;
      }

      categoryMap[song.category]++;
    }

    const categories = Object.entries(categoryMap)
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
    console.error("Category error:", error);

    res.status(500).json({
      success: false,
      categories: [],
      error: error.message
    });
  }
});

// --------------------------------------------------
// API: Songs by category
// --------------------------------------------------

app.get("/api/category/:category", (req, res) => {
  try {
    const requestedCategory =
      decodeURIComponent(req.params.category);

    const songs = scanSongs();

    const filteredSongs = songs.filter(
      song =>
        song.category.toLowerCase() ===
        requestedCategory.toLowerCase()
    );

    res.json({
      success: true,
      category: requestedCategory,
      count: filteredSongs.length,
      songs: filteredSongs
    });
  } catch (error) {
    console.error("Category songs error:", error);

    res.status(500).json({
      success: false,
      songs: [],
      error: error.message
    });
  }
});

// --------------------------------------------------
// Serve music files
// --------------------------------------------------

app.use(
  "/songs",
  express.static(SONGS_DIR, {
    fallthrough: false,
    setHeaders: (res, filePath) => {
      const extension =
        path.extname(filePath).toLowerCase();

      if (extension === ".mp3") {
        res.setHeader("Content-Type", "audio/mpeg");
      }

      if (extension === ".m4a") {
        res.setHeader("Content-Type", "audio/mp4");
      }

      if (extension === ".wav") {
        res.setHeader("Content-Type", "audio/wav");
      }

      if (extension === ".ogg") {
        res.setHeader("Content-Type", "audio/ogg");
      }

      if (extension === ".aac") {
        res.setHeader("Content-Type", "audio/aac");
      }

      res.setHeader(
        "Cache-Control",
        "public, max-age=3600"
      );

      res.setHeader(
        "Accept-Ranges",
        "bytes"
      );
    }
  })
);

// --------------------------------------------------
// Serve images
// --------------------------------------------------

const IMAGES_DIR = path.join(ROOT_DIR, "images");

if (fs.existsSync(IMAGES_DIR)) {
  app.use(
    "/images",
    express.static(IMAGES_DIR)
  );
}

// --------------------------------------------------
// Serve frontend static files
// --------------------------------------------------

app.use(
  express.static(ROOT_DIR, {
    index: "index.html"
  })
);

// --------------------------------------------------
// Express 5 fallback
//
// IMPORTANT:
// Do NOT use:
//
// app.get("*", ...)
//
// Express 5 throws:
//
// PathError: Missing parameter name
// --------------------------------------------------

app.use((req, res) => {
  const indexFile = path.join(
    ROOT_DIR,
    "index.html"
  );

  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(404).json({
      success: false,
      error: "index.html not found"
    });
  }
});

// --------------------------------------------------
// Error handler
// --------------------------------------------------

app.use((err, req, res, next) => {
  console.error("Server error:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    success: false,
    error: "Internal server error"
  });
});

// --------------------------------------------------
// Start server
// --------------------------------------------------

app.listen(PORT, HOST, () => {
  console.log("====================================");
  console.log("        SwarAJ Music Server");
  console.log("====================================");
  console.log(`Server: http://${HOST}:${PORT}`);
  console.log(`Songs:  ${SONGS_DIR}`);
  console.log(`Node:   ${process.version}`);

  const songs = scanSongs();

  console.log(`Songs found: ${songs.length}`);

  if (songs.length > 0) {
    console.log("------------------------------------");

    songs.slice(0, 10).forEach(song => {
      console.log(
        `${song.category} → ${song.title}`
      );
    });

    if (songs.length > 10) {
      console.log(
        `...and ${songs.length - 10} more`
      );
    }
  } else {
    console.log("------------------------------------");
    console.log("WARNING: No songs found.");
    console.log(
      "Make sure MP3 files are inside the songs/ folder."
    );
  }

  console.log("====================================");
});