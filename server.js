const express = require("express");
const path = require("path");
const cors = require("cors");
const multer = require("multer");

const { v2: cloudinary } = require("cloudinary");

const {
  pool,
  initDatabase
} = require("./database");

const app = express();

const PORT =
  process.env.PORT || 10000;

// ==================================================
// BASIC CONFIG
// ==================================================

app.use(cors());

app.use(
  express.json({
    limit: "20mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "20mb"
  })
);

// ==================================================
// STATIC FILES
// ==================================================

app.use(
  express.static(__dirname)
);

app.use(
  "/images",
  express.static(
    path.join(__dirname, "images")
  )
);

// ==================================================
// CLOUDINARY
// ==================================================

let cloudinaryReady = false;

if (process.env.CLOUDINARY_URL) {
  try {
    cloudinary.config();

    cloudinaryReady = true;

    console.log(
      "Cloudinary configured."
    );
  } catch (error) {
    console.error(
      "Cloudinary configuration error:",
      error.message
    );
  }
} else {
  console.warn(
    "CLOUDINARY_URL is not configured."
  );
}

// ==================================================
// MULTER
// ==================================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize:
      100 * 1024 * 1024
  },

  fileFilter: (
    req,
    file,
    cb
  ) => {
    const valid =
      file.mimetype.startsWith(
        "audio/"
      ) ||
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

// ==================================================
// HELPERS
// ==================================================

function clean(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value).trim();
}

function nullable(value) {
  const cleaned = clean(value);

  return cleaned
    ? cleaned
    : null;
}

function isValidYouTubeUrl(value) {
  if (!value) {
    return true;
  }

  const url = clean(value);

  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\//i.test(
    url
  );
}

// ==================================================
// CLOUDINARY AUDIO UPLOAD
// ==================================================

function uploadAudio(
  buffer,
  filename
) {
  return new Promise(
    (resolve, reject) => {
      const safeName =
        filename
          .replace(
            /\.[^/.]+$/,
            ""
          )
          .replace(
            /[^a-zA-Z0-9_-]/g,
            "_"
          );

      const stream =
        cloudinary.uploader.upload_stream(
          {
            resource_type: "video",
            folder: "swaraj/songs",
            public_id: safeName,
            overwrite: true
          },
          (
            error,
            result
          ) => {
            if (error) {
              reject(error);
              return;
            }

            resolve(result);
          }
        );

      stream.end(buffer);
    }
  );
}

// ==================================================
// HOME
// ==================================================

app.get(
  "/",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "index.html"
      )
    );
  }
);

// ==================================================
// ADMIN
// ==================================================

app.get(
  "/admin",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "admin.html"
      )
    );
  }
);

// ==================================================
// HEALTH
// ==================================================

app.get(
  "/api/health",
  async (req, res) => {
    let database =
      "not configured";

    if (pool) {
      try {
        await pool.query(
          "SELECT 1"
        );

        database =
          "connected";
      } catch (error) {
        database = "error";
      }
    }

    res.json({
      status: "ok",
      service:
        "स्वरAJ Music",
      environment:
        process.env.NODE_ENV ||
        "development",
      node:
        process.version,
      database,
      cloudinary:
        cloudinaryReady,
      timestamp:
        new Date().toISOString()
    });
  }
);

// ==================================================
// CATEGORIES
// ==================================================

app.get(
  "/api/categories",
  async (req, res) => {
    if (!pool) {
      return res.json([]);
    }

    try {
      const result =
        await pool.query(`
          SELECT
            category,
            COUNT(*)::int AS song_count
          FROM songs
          WHERE published = TRUE
          GROUP BY category
          ORDER BY category
        `);

      res.json(
        result.rows
      );
    } catch (error) {
      console.error(
        "CATEGORY ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Unable to load categories",
        details:
          error.message
      });
    }
  }
);

// ==================================================
// SONGS
// ==================================================

app.get(
  "/api/songs",
  async (req, res) => {
    if (!pool) {
      return res.json([]);
    }

    try {
      const result =
        await pool.query(`
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

      res.json(
        result.rows
      );
    } catch (error) {
      console.error(
        "SONGS ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Unable to load songs",
        details:
          error.message
      });
    }
  }
);

// ==================================================
// SINGLE SONG
// ==================================================

app.get(
  "/api/songs/:id",
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
          SELECT *
          FROM songs
          WHERE id = $1
          `,
          [req.params.id]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          error:
            "Song not found"
        });
      }

      res.json(
        result.rows[0]
      );
    } catch (error) {
      res.status(500).json({
        error:
          error.message
      });
    }
  }
);

// ==================================================
// ADD SONG
// ==================================================

app.post(
  "/api/admin/upload-song",
  upload.single("audio"),
  async (req, res) => {
    console.log(
      "================================"
    );

    console.log(
      "ADD SONG REQUEST"
    );

    console.log(
      "================================"
    );

    if (!pool) {
      return res.status(503).json({
        success: false,
        error:
          "Database not configured"
      });
    }

    try {
      const title =
        clean(
          req.body.title
        );

      const artist =
        clean(
          req.body.artist
        );

      const album =
        clean(
          req.body.album
        );

      const category =
        clean(
          req.body.category
        ) ||
        "All Songs";

      const language =
        clean(
          req.body.language
        );

      const genre =
        clean(
          req.body.genre
        );

      const audioUrl =
        nullable(
          req.body.audio_url
        );

      const youtubeUrl =
        nullable(
          req.body.youtube_url
        );

      const coverUrl =
        nullable(
          req.body.cover_url
        );

      const lyrics =
        clean(
          req.body.lyrics
        );

      const featured =
        req.body.featured ===
        "true";

      const published =
        req.body.published !==
        "false";

      console.log({
        title,
        artist,
        album,
        category,
        audioUrl,
        youtubeUrl,
        hasFile:
          Boolean(req.file)
      });

      // ------------------------------------------
      // TITLE
      // ------------------------------------------

      if (!title) {
        return res.status(400).json({
          success: false,
          error:
            "Song title is required."
        });
      }

      // ------------------------------------------
      // YOUTUBE URL
      // ------------------------------------------

      if (
        youtubeUrl &&
        !isValidYouTubeUrl(
          youtubeUrl
        )
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid YouTube URL.",
          details:
            "Use https://youtube.com/... or https://youtu.be/..."
        });
      }

      // ------------------------------------------
      // FINAL AUDIO URL
      // ------------------------------------------

      let finalAudioUrl =
        audioUrl;

      // ------------------------------------------
      // CLOUDINARY UPLOAD
      // ------------------------------------------

      if (req.file) {
        if (!cloudinaryReady) {
          return res.status(500).json({
            success: false,
            error:
              "CLOUDINARY_URL is not configured."
          });
        }

        console.log(
          "Uploading audio to Cloudinary..."
        );

        const uploaded =
          await uploadAudio(
            req.file.buffer,
            req.file.originalname
          );

        finalAudioUrl =
          uploaded.secure_url;

        console.log(
          "Cloudinary URL:",
          finalAudioUrl
        );
      }

      // ------------------------------------------
      // MUST HAVE AUDIO OR YOUTUBE
      // ------------------------------------------

      if (
        !finalAudioUrl &&
        !youtubeUrl
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Add an MP3 URL, YouTube URL, or upload an MP3 file."
        });
      }

      // ------------------------------------------
      // INSERT
      // ------------------------------------------

      console.log(
        "Saving song to PostgreSQL..."
      );

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

      console.log(
        "Song successfully inserted."
      );

      console.log(
        "Song ID:",
        result.rows[0].id
      );

      res.status(201).json({
        success: true,
        message:
          "Song added successfully.",
        song:
          result.rows[0]
      });
    } catch (error) {
      console.error(
        "================================"
      );

      console.error(
        "ADD SONG ERROR"
      );

      console.error(
        "MESSAGE:",
        error.message
      );

      console.error(
        "CODE:",
        error.code
      );

      console.error(
        "DETAIL:",
        error.detail
      );

      console.error(
        "HINT:",
        error.hint
      );

      console.error(
        "STACK:",
        error.stack
      );

      console.error(
        "================================"
      );

      res.status(500).json({
        success: false,
        error:
          "Failed to add song.",
        details:
          error.message,
        code:
          error.code || null,
        detail:
          error.detail || null,
        hint:
          error.hint || null
      });
    }
  }
);

// ==================================================
// DELETE SONG
// ==================================================

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

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          error:
            "Song not found"
        });
      }

      res.json({
        success: true,
        message:
          "Song deleted successfully."
      });
    } catch (error) {
      console.error(
        "DELETE ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to delete song.",
        details:
          error.message
      });
    }
  }
);

// ==================================================
// 404 API
// ==================================================

app.use(
  "/api",
  (req, res) => {
    res.status(404).json({
      error:
        "API endpoint not found",
      path:
        req.originalUrl
    });
  }
);

// ==================================================
// GENERAL ERROR
// ==================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "SERVER ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      error:
        error.message ||
        "Server error"
    });
  }
);

// ==================================================
// START
// ==================================================

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
            cloudinaryReady
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