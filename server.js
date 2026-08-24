const express = require("express");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");

const { pool, initDatabase } = require("./database");

const app = express();

const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// --------------------------------------------------
// Cloudinary
// --------------------------------------------------

if (process.env.CLOUDINARY_URL) {
  cloudinary.config();
  console.log("Cloudinary configured.");
} else {
  console.warn("CLOUDINARY_URL is not configured.");
}

// --------------------------------------------------
// Static files
// --------------------------------------------------

app.use(express.static(path.join(__dirname)));

app.use(
  "/images",
  express.static(path.join(__dirname, "images"))
);

// --------------------------------------------------
// Multer
// --------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 100 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const allowed = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/mp4",
      "audio/aac",
      "audio/ogg",
    ];

    if (
      allowed.includes(file.mimetype) ||
      /\.(mp3|wav|m4a|aac|ogg)$/i.test(file.originalname)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed."));
    }
  },
});

// --------------------------------------------------
// Cloudinary audio upload
// --------------------------------------------------

function uploadAudioToCloudinary(buffer, filename) {
  return new Promise((resolve, reject) => {
    const publicId = filename
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_");

    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video",
        folder: "swaraj/songs",
        public_id: publicId,
        overwrite: true,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function normalizeYouTubeUrl(url) {
  if (!url) return null;

  const value = url.trim();

  if (!value) return null;

  return value;
}

function isValidYouTubeUrl(url) {
  if (!url) return false;

  try {
    const parsed = new URL(url);

    return (
      parsed.hostname === "youtube.com" ||
      parsed.hostname === "www.youtube.com" ||
      parsed.hostname === "youtu.be" ||
      parsed.hostname === "m.youtube.com"
    );
  } catch {
    return false;
  }
}

// --------------------------------------------------
// HOME
// --------------------------------------------------

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// --------------------------------------------------
// ADMIN
// --------------------------------------------------

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// --------------------------------------------------
// HEALTH
// --------------------------------------------------

app.get("/api/health", async (req, res) => {
  let database = "not configured";

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
    cloudinary: Boolean(process.env.CLOUDINARY_URL),
    timestamp: new Date().toISOString(),
  });
});

// --------------------------------------------------
// CATEGORIES
// --------------------------------------------------

app.get("/api/categories", async (req, res) => {
  if (!pool) {
    return res.json([]);
  }

  try {
    const result = await pool.query(`
      SELECT
        category,
        COUNT(*)::int AS song_count
      FROM songs
      WHERE published = TRUE
      GROUP BY category
      ORDER BY category
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("CATEGORY ERROR:", error);

    res.status(500).json({
      error: "Unable to load categories",
    });
  }
});

// --------------------------------------------------
// ALL SONGS
// --------------------------------------------------

app.get("/api/songs", async (req, res) => {
  if (!pool) {
    return res.json([]);
  }

  try {
    const result = await pool.query(`
      SELECT
        id,
        title,
        artist,
        album,
        category,
        language,
        genre,
        audio_url,
        youtube_url,
        cover_url,
        lyrics,
        featured,
        published,
        created_at
      FROM songs
      WHERE published = TRUE
      ORDER BY created_at DESC, id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("SONGS ERROR:", error);

    res.status(500).json({
      error: "Unable to load songs",
    });
  }
});

// --------------------------------------------------
// SINGLE SONG
// --------------------------------------------------

app.get("/api/songs/:id", async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: "Database not configured",
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM songs
      WHERE id = $1
      `,
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Song not found",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Unable to load song",
    });
  }
});

// --------------------------------------------------
// ADMIN UPLOAD
// --------------------------------------------------

app.post(
  "/api/admin/upload-song",
  upload.single("audio"),
  async (req, res) => {
    if (!pool) {
      return res.status(503).json({
        error: "Database not configured",
      });
    }

    try {
      const {
        title,
        artist,
        album,
        category,
        language,
        genre,
        audio_url,
        youtube_url,
        cover_url,
        lyrics,
        featured,
        published,
      } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({
          error: "Song title is required.",
        });
      }

      let finalAudioUrl = audio_url?.trim() || null;

      let finalYouTubeUrl =
        normalizeYouTubeUrl(youtube_url);

      // Validate YouTube URL
      if (finalYouTubeUrl && !isValidYouTubeUrl(finalYouTubeUrl)) {
        return res.status(400).json({
          error: "Invalid YouTube URL.",
        });
      }

      // Upload MP3 if selected
      if (req.file) {
        if (!process.env.CLOUDINARY_URL) {
          return res.status(500).json({
            error:
              "CLOUDINARY_URL is not configured on Render.",
          });
        }

        const cloudinaryResult =
          await uploadAudioToCloudinary(
            req.file.buffer,
            req.file.originalname
          );

        finalAudioUrl =
          cloudinaryResult.secure_url;
      }

      // At least one source required
      if (!finalAudioUrl && !finalYouTubeUrl) {
        return res.status(400).json({
          error:
            "Provide an MP3 URL, YouTube URL, or upload an MP3 file.",
        });
      }

      const result = await pool.query(
        `
        INSERT INTO songs (
          title,
          artist,
          album,
          category,
          language,
          genre,
          audio_url,
          youtube_url,
          cover_url,
          lyrics,
          featured,
          published
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
        )
        RETURNING *
        `,
        [
          title.trim(),
          artist?.trim() || "",
          album?.trim() || "",
          category?.trim() || "All Songs",
          language?.trim() || "",
          genre?.trim() || "",
          finalAudioUrl,
          finalYouTubeUrl,
          cover_url?.trim() || null,
          lyrics || "",
          featured === "true",
          published !== "false",
        ]
      );

      res.json({
        success: true,
        message: "Song added successfully.",
        song: result.rows[0],
      });
    } catch (error) {
      console.error("UPLOAD SONG ERROR:", error);

      res.status(500).json({
        error: "Failed to add song.",
        details: error.message,
      });
    }
  }
);

// --------------------------------------------------
// DELETE SONG
// --------------------------------------------------

app.delete("/api/admin/songs/:id", async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: "Database not configured",
    });
  }

  try {
    const result = await pool.query(
      `
      DELETE FROM songs
      WHERE id = $1
      RETURNING *
      `,
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Song not found",
      });
    }

    res.json({
      success: true,
      message: "Song deleted.",
      song: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Delete failed.",
    });
  }
});

// --------------------------------------------------
// Error handler
// --------------------------------------------------

app.use((error, req, res, next) => {
  console.error("SERVER ERROR:", error);

  res.status(500).json({
    error: error.message || "Server error",
  });
});

// --------------------------------------------------
// START
// --------------------------------------------------

async function startServer() {
  try {
    await initDatabase();

    app.listen(PORT, "0.0.0.0", () => {
      console.log("==========================================");
      console.log("स्वरAJ Music Server");
      console.log("==========================================");
      console.log(`Server: http://0.0.0.0:${PORT}`);
      console.log(
        `Environment: ${
          process.env.NODE_ENV || "development"
        }`
      );
      console.log(
        `Database: ${
          pool ? "configured" : "NOT CONFIGURED"
        }`
      );
      console.log(
        `Cloudinary: ${
          process.env.CLOUDINARY_URL
            ? "configured"
            : "NOT CONFIGURED"
        }`
      );
      console.log("==========================================");
    });
  } catch (error) {
    console.error("STARTUP ERROR:", error);
    process.exit(1);
  }
}

startServer();