const express = require("express");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");

const { pool, initDatabase } = require("./database");

const app = express();

const PORT = process.env.PORT || 10000;

app.use(cors());

app.use(
  express.json({
    limit: "10mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb"
  })
);

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

app.use(express.static(__dirname));

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
    fileSize: 100 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const valid =
      file.mimetype.startsWith("audio/") ||
      /\.(mp3|wav|m4a|aac|ogg)$/i.test(
        file.originalname
      );

    if (valid) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only audio files are allowed."
        )
      );
    }
  }
});

// --------------------------------------------------
// YouTube helpers
// --------------------------------------------------

function cleanYouTubeUrl(value) {
  if (!value) {
    return null;
  }

  return String(value).trim() || null;
}

function isValidYouTubeUrl(value) {
  if (!value) {
    return true;
  }

  const url = String(value).trim();

  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\//i.test(
    url
  );
}

// --------------------------------------------------
// Cloudinary upload
// --------------------------------------------------

function uploadAudioToCloudinary(
  buffer,
  filename
) {
  return new Promise((resolve, reject) => {
    const publicId = filename
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_");

    const stream =
      cloudinary.uploader.upload_stream(
        {
          resource_type: "video",
          folder: "swaraj/songs",
          public_id: publicId,
          overwrite: true
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
// Home
// --------------------------------------------------

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

// --------------------------------------------------
// Admin
// --------------------------------------------------

app.get("/admin", (req, res) => {
  res.sendFile(
    path.join(__dirname, "admin.html")
  );
});

// --------------------------------------------------
// Health
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
    environment:
      process.env.NODE_ENV || "development",
    database,
    cloudinary:
      Boolean(process.env.CLOUDINARY_URL),
    timestamp: new Date().toISOString()
  });
});

// --------------------------------------------------
// Categories
// --------------------------------------------------

app.get(
  "/api/categories",
  async (req, res) => {
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
      console.error(
        "CATEGORY ERROR:",
        error
      );

      res.status(500).json({
        error: "Unable to load categories"
      });
    }
  }
);

// --------------------------------------------------
// Songs
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
    console.error(
      "SONGS ERROR:",
      error
    );

    res.status(500).json({
      error: "Unable to load songs",
      details: error.message
    });
  }
});

// --------------------------------------------------
// Get single song
// --------------------------------------------------

app.get(
  "/api/songs/:id",
  async (req, res) => {
    if (!pool) {
      return res.status(503).json({
        error: "Database not configured"
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
          error: "Song not found"
        });
      }

      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

// --------------------------------------------------
// Add song
// --------------------------------------------------

app.post(
  "/api/admin/upload-song",
  upload.single("audio"),
  async (req, res) => {
    if (!pool) {
      return res.status(503).json({
        error: "Database not configured"
      });
    }

    try {
      const title =
        String(req.body.title || "").trim();

      const artist =
        String(req.body.artist || "").trim();

      const album =
        String(req.body.album || "").trim();

      const category =
        String(
          req.body.category ||
            "All Songs"
        ).trim();

      const language =
        String(
          req.body.language || ""
        ).trim();

      const genre =
        String(
          req.body.genre || ""
        ).trim();

      const audioUrl =
        String(
          req.body.audio_url || ""
        ).trim() || null;

      const youtubeUrl =
        cleanYouTubeUrl(
          req.body.youtube_url
        );

      const coverUrl =
        String(
          req.body.cover_url || ""
        ).trim() || null;

      const lyrics =
        String(
          req.body.lyrics || ""
        );

      const featured =
        req.body.featured === "true";

      const published =
        req.body.published !== "false";

      if (!title) {
        return res.status(400).json({
          error:
            "Song title is required."
        });
      }

      if (
        youtubeUrl &&
        !isValidYouTubeUrl(
          youtubeUrl
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid YouTube URL."
        });
      }

      let finalAudioUrl =
        audioUrl;

      // Upload MP3 to Cloudinary
      if (req.file) {
        if (
          !process.env.CLOUDINARY_URL
        ) {
          return res.status(500).json({
            error:
              "CLOUDINARY_URL is not configured."
          });
        }

        const result =
          await uploadAudioToCloudinary(
            req.file.buffer,
            req.file.originalname
          );

        finalAudioUrl =
          result.secure_url;
      }

      if (
        !finalAudioUrl &&
        !youtubeUrl
      ) {
        return res.status(400).json({
          error:
            "Enter an MP3 URL, YouTube URL, or upload an MP3 file."
        });
      }

      const result =
        await pool.query(
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
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12
          )
          RETURNING *
          `,
          [
            title,
            artist,
            album,
            category,
            language,
            genre,
            finalAudioUrl,
            youtubeUrl,
            coverUrl,
            lyrics,
            featured,
            published
          ]
        );

      res.json({
        success: true,
        message:
          "Song added successfully.",
        song: result.rows[0]
      });
    } catch (error) {
      console.error(
        "ADD SONG ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to add song.",
        details:
          error.message
      });
    }
  }
);

// --------------------------------------------------
// Delete song
// --------------------------------------------------

app.delete(
  "/api/admin/songs/:id",
  async (req, res) => {
    if (!pool) {
      return res.status(503).json({
        error:
          "Database not configured"
      });
    }

    try {
      const result =
        await pool.query(
          `
          DELETE FROM songs
          WHERE id = $1
          RETURNING *
          `,
          [req.params.id]
        );

      if (!result.rows.length) {
        return res.status(404).json({
          error:
            "Song not found"
        });
      }

      res.json({
        success: true,
        message:
          "Song deleted."
      });
    } catch (error) {
      res.status(500).json({
        error:
          error.message
      });
    }
  }
);

// --------------------------------------------------
// Error handler
// --------------------------------------------------

app.use(
  (error, req, res, next) => {
    console.error(
      "SERVER ERROR:",
      error
    );

    res.status(500).json({
      error:
        error.message ||
        "Server error"
    });
  }
);

// --------------------------------------------------
// Start
// --------------------------------------------------

async function startServer() {
  try {
    await initDatabase();

    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          "=========================================="
        );

        console.log(
          "स्वरAJ Music Server"
        );

        console.log(
          "=========================================="
        );

        console.log(
          `Server: http://0.0.0.0:${PORT}`
        );

        console.log(
          `Environment: ${
            process.env.NODE_ENV ||
            "development"
          }`
        );

        console.log(
          `Database: ${
            pool
              ? "configured"
              : "NOT CONFIGURED"
          }`
        );

        console.log(
          `Cloudinary: ${
            process.env.CLOUDINARY_URL
              ? "configured"
              : "NOT CONFIGURED"
          }`
        );

        console.log(
          "=========================================="
        );
      }
    );
  } catch (error) {
    console.error(
      "STARTUP ERROR:",
      error
    );

    process.exit(1);
  }
}

startServer();