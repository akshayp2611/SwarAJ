const express = require("express");
const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");

const app = express();

const PORT = Number(process.env.PORT) || 10000;
const HOST = "0.0.0.0";

const ROOT = __dirname;
const SONGS_DIR = path.join(ROOT, "songs");
const IMAGES_DIR = path.join(ROOT, "images");

// =====================================================
// POSTGRESQL
// =====================================================

let pool = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  pool.on("error", (err) => {
    console.error("PostgreSQL pool error:", err);
  });
} else {
  console.warn("DATABASE_URL is not configured.");
}

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(ROOT));

// =====================================================
// DATABASE INITIALIZATION
// =====================================================

async function initializeDatabase() {
  if (!pool) {
    console.warn("Database initialization skipped.");
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS songs (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT DEFAULT 'Unknown Artist',
      album TEXT DEFAULT 'Unknown Album',
      category TEXT DEFAULT 'Other',
      file_path TEXT NOT NULL UNIQUE,
      cover_path TEXT,
      duration INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_songs_category
    ON songs(category)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_songs_title
    ON songs(title)
  `);

  console.log("PostgreSQL database initialized.");
}

// =====================================================
// HEALTH
// =====================================================

app.get("/api/health", async (req, res) => {
  let database = "not_configured";

  if (pool) {
    try {
      await pool.query("SELECT 1");
      database = "connected";
    } catch (error) {
      database = "error";
    }
  }

  let songCount = 0;

  if (pool) {
    try {
      const result = await pool.query(
        "SELECT COUNT(*)::int AS count FROM songs"
      );

      songCount = result.rows[0].count;
    } catch (error) {
      console.error("Health song count error:", error.message);
    }
  }

  res.status(200).json({
    status: "ok",
    service: "स्वरAJ Music",
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || "production",
    database,
    songCount,
    songsDirectoryExists: fs.existsSync(SONGS_DIR),
    imagesDirectoryExists: fs.existsSync(IMAGES_DIR),
    timestamp: new Date().toISOString()
  });
});

// =====================================================
// API ROOT
// =====================================================

app.get("/api", (req, res) => {
  res.json({
    status: "ok",
    service: "स्वरAJ Music API",
    endpoints: [
      "/api/health",
      "/api/categories",
      "/api/songs",
      "/api/songs/:id"
    ]
  });
});

// =====================================================
// CATEGORIES
// =====================================================

app.get("/api/categories", async (req, res) => {
  try {
    // Prefer PostgreSQL
    if (pool) {
      const result = await pool.query(`
        SELECT
          category,
          COUNT(*)::int AS song_count
        FROM songs
        WHERE category IS NOT NULL
          AND TRIM(category) <> ''
        GROUP BY category
        ORDER BY category ASC
      `);

      return res.json({
        status: "ok",
        source: "database",
        categories: result.rows
      });
    }

    // Fallback to folders
    if (!fs.existsSync(SONGS_DIR)) {
      return res.json({
        status: "ok",
        source: "filesystem",
        categories: []
      });
    }

    const categories = fs
      .readdirSync(SONGS_DIR, { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((item) => item.name)
      .sort();

    return res.json({
      status: "ok",
      source: "filesystem",
      categories: categories.map((category) => ({
        category,
        song_count: 0
      }))
    });

  } catch (error) {
    console.error("Categories API error:", error);

    res.status(500).json({
      status: "error",
      message: "Unable to load categories",
      error:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.message
    });
  }
});

// =====================================================
// ALL SONGS
// =====================================================

app.get("/api/songs", async (req, res) => {
  try {
    if (!pool) {
      return res.json({
        status: "ok",
        songs: []
      });
    }

    const result = await pool.query(`
      SELECT
        id,
        title,
        artist,
        album,
        category,
        file_path,
        cover_path,
        duration,
        created_at
      FROM songs
      ORDER BY id DESC
    `);

    const songs = result.rows.map((song) => ({
      ...song,
      url: `/songs/${song.file_path}`,
      cover:
        song.cover_path
          ? `/images/${song.cover_path}`
          : null
    }));

    res.json({
      status: "ok",
      count: songs.length,
      songs
    });

  } catch (error) {
    console.error("Songs API error:", error);

    res.status(500).json({
      status: "error",
      message: "Unable to load songs"
    });
  }
});

// =====================================================
// SONGS BY CATEGORY
// =====================================================

app.get("/api/songs/category/:category", async (req, res) => {
  try {
    if (!pool) {
      return res.json({
        status: "ok",
        songs: []
      });
    }

    const category = req.params.category;

    const result = await pool.query(
      `
      SELECT
        id,
        title,
        artist,
        album,
        category,
        file_path,
        cover_path,
        duration
      FROM songs
      WHERE LOWER(category) = LOWER($1)
      ORDER BY title ASC
      `,
      [category]
    );

    const songs = result.rows.map((song) => ({
      ...song,
      url: `/songs/${song.file_path}`,
      cover:
        song.cover_path
          ? `/images/${song.cover_path}`
          : null
    }));

    res.json({
      status: "ok",
      category,
      count: songs.length,
      songs
    });

  } catch (error) {
    console.error("Category songs error:", error);

    res.status(500).json({
      status: "error",
      message: "Unable to load category"
    });
  }
});

// =====================================================
// SINGLE SONG
// =====================================================

app.get("/api/songs/:id", async (req, res) => {
  try {
    if (!pool) {
      return res.status(404).json({
        status: "error",
        message: "Database not configured"
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        title,
        artist,
        album,
        category,
        file_path,
        cover_path,
        duration
      FROM songs
      WHERE id = $1
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Song not found"
      });
    }

    const song = result.rows[0];

    res.json({
      status: "ok",
      song: {
        ...song,
        url: `/songs/${song.file_path}`,
        cover:
          song.cover_path
            ? `/images/${song.cover_path}`
            : null
      }
    });

  } catch (error) {
    console.error("Single song error:", error);

    res.status(500).json({
      status: "error",
      message: "Unable to load song"
    });
  }
});

// =====================================================
// STATIC SONG FILES
// =====================================================

if (fs.existsSync(SONGS_DIR)) {
  app.use(
    "/songs",
    express.static(SONGS_DIR, {
      fallthrough: true,
      maxAge: "1d"
    })
  );
}

// =====================================================
// STATIC IMAGES
// =====================================================

if (fs.existsSync(IMAGES_DIR)) {
  app.use(
    "/images",
    express.static(IMAGES_DIR, {
      fallthrough: true,
      maxAge: "7d"
    })
  );
}

// =====================================================
// API 404
// =====================================================

app.use("/api", (req, res) => {
  res.status(404).json({
    status: "error",
    message: "API endpoint not found",
    path: req.originalUrl
  });
});

// =====================================================
// FRONTEND
// =====================================================

app.get("/", (req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

// =====================================================
// START
// =====================================================

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, HOST, () => {
      console.log("==========================================");
      console.log("स्वरAJ Music Server");
      console.log("==========================================");
      console.log(`Server: http://${HOST}:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "production"}`);
      console.log(`Database: ${pool ? "configured" : "NOT CONFIGURED"}`);
      console.log("==========================================");
    });
  } catch (error) {
    console.error("Server startup error:", error);
    process.exit(1);
  }
}

startServer();