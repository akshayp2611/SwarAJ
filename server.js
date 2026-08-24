require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const {
  pool,
  initDatabase,
  getSongs,
  getCategories,
  createSong,
  deleteSong,
  toggleLike
} = require("./database");

const app = express();

const PORT = process.env.PORT || 10000;

const ROOT = __dirname;

app.use(cors());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// --------------------------------------------------
// Static files
// --------------------------------------------------

app.use(express.static(ROOT, {
  extensions: ["html"]
}));

// --------------------------------------------------
// Health
// --------------------------------------------------

app.get("/api/health", async (req, res) => {
  let database = "not-configured";

  if (pool) {
    try {
      await pool.query("SELECT 1");
      database = "connected";
    } catch (error) {
      database = "error";
    }
  }

  res.json({
    status: "ok",
    service: "स्वरAJ Music",
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || "development",
    database,
    timestamp: new Date().toISOString()
  });
});

// --------------------------------------------------
// Songs
// --------------------------------------------------

app.get("/api/songs", async (req, res) => {
  try {
    const songs = await getSongs();

    res.json({
      success: true,
      count: songs.length,
      songs
    });
  } catch (error) {
    console.error("GET /api/songs:", error);

    res.status(500).json({
      success: false,
      error: "Unable to load songs"
    });
  }
});

// --------------------------------------------------
// Categories
// --------------------------------------------------

app.get("/api/categories", async (req, res) => {
  try {
    const categories = await getCategories();

    res.json({
      success: true,
      count: categories.length,
      categories
    });
  } catch (error) {
    console.error("GET /api/categories:", error);

    res.status(500).json({
      success: false,
      error: "Unable to load categories"
    });
  }
});

// --------------------------------------------------
// Add song
// --------------------------------------------------

app.post("/api/admin/songs", async (req, res) => {
  try {
    const {
      title,
      artist,
      album,
      category,
      audio_url,
      cover_url,
      duration
    } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: "Song title is required"
      });
    }

    if (!audio_url) {
      return res.status(400).json({
        success: false,
        error: "Audio URL is required"
      });
    }

    const song = await createSong({
      title,
      artist,
      album,
      category,
      audio_url,
      cover_url,
      duration
    });

    res.status(201).json({
      success: true,
      message: "Song added successfully",
      song
    });

  } catch (error) {
    console.error("POST /api/admin/songs:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// --------------------------------------------------
// Delete song
// --------------------------------------------------

app.delete("/api/admin/songs/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid song ID"
      });
    }

    await deleteSong(id);

    res.json({
      success: true,
      message: "Song deleted"
    });

  } catch (error) {
    console.error("DELETE /api/admin/songs:", error);

    res.status(500).json({
      success: false,
      error: "Unable to delete song"
    });
  }
});

// --------------------------------------------------
// Like song
// --------------------------------------------------

app.post("/api/songs/:id/like", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const song = await toggleLike(id);

    if (!song) {
      return res.status(404).json({
        success: false,
        error: "Song not found"
      });
    }

    res.json({
      success: true,
      song
    });

  } catch (error) {
    console.error("LIKE:", error);

    res.status(500).json({
      success: false,
      error: "Unable to update like"
    });
  }
});

// --------------------------------------------------
// Admin page
// --------------------------------------------------

app.get("/admin", (req, res) => {
  res.sendFile(path.join(ROOT, "admin.html"));
});

// --------------------------------------------------
// SPA fallback
// IMPORTANT: Express 5 does NOT accept "*"
// --------------------------------------------------

app.use((req, res, next) => {
  if (
    req.method === "GET" &&
    !req.path.startsWith("/api/")
  ) {
    return res.sendFile(
      path.join(ROOT, "index.html")
    );
  }

  next();
});

// --------------------------------------------------
// 404
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Not found",
    path: req.originalUrl
  });
});

// --------------------------------------------------
// Start
// --------------------------------------------------

async function startServer() {
  try {
    await initDatabase();
  } catch (error) {
    console.error(
      "Database initialization error:",
      error.message
    );
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log("==========================================");
    console.log("स्वरAJ Music Server");
    console.log("==========================================");
    console.log(`Server: http://0.0.0.0:${PORT}`);
    console.log(
      `Environment: ${process.env.NODE_ENV || "development"}`
    );
    console.log(
      `Database: ${pool ? "configured" : "NOT CONFIGURED"}`
    );
    console.log("==========================================");
  });
}

startServer();