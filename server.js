const express = require("express");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { pool, initDatabase } = require("./database");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(express.static(__dirname));

let cloudinaryReady = false;

if (process.env.CLOUDINARY_URL) {
  try {
    cloudinary.config();
    cloudinaryReady = true;
    console.log("Cloudinary configured");
  } catch (err) {
    console.error("Cloudinary error:", err.message);
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024
  },
  fileFilter(req, file, cb) {
    const valid =
      file.mimetype.startsWith("audio/") ||
      /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(
        file.originalname
      );

    if (!valid) {
      return cb(
        new Error("Only audio files are allowed.")
      );
    }

    cb(null, true);
  }
});

function clean(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function nullable(value) {
  const value = clean(value);
  return value || null;
}

/* =====================================================
   YOUTUBE
===================================================== */

function cleanYouTubeId(id) {
  if (!id) return null;

  const value = String(id)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "");

  if (value.length < 5 || value.length > 20) {
    return null;
  }

  return value;
}

function extractYouTubeVideoId(value) {
  if (!value) return null;

  try {
    const url = new URL(String(value).trim());

    const host = url.hostname
      .toLowerCase()
      .replace(/^www\./, "");

    if (host === "youtu.be") {
      return cleanYouTubeId(
        url.pathname
          .replace(/^\/+/, "")
          .split("/")[0]
      );
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com"
    ) {
      const v = url.searchParams.get("v");

      if (v) {
        return cleanYouTubeId(v);
      }

      const patterns = [
        /^\/shorts\/([^/?]+)/,
        /^\/embed\/([^/?]+)/,
        /^\/live\/([^/?]+)/
      ];

      for (const pattern of patterns) {
        const match =
          url.pathname.match(pattern);

        if (match) {
          return cleanYouTubeId(match[1]);
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

/* =====================================================
   CLOUDINARY MP3
===================================================== */

function uploadAudio(buffer, filename) {
  return new Promise((resolve, reject) => {
    const safeName = filename
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_");

    const stream =
      cloudinary.uploader.upload_stream(
        {
          resource_type: "video",
          folder: "swaraj/songs",
          public_id: safeName,
          overwrite: true
        },
        (error, result) => {
          if (error) {
            return reject(error);
          }

          resolve(result);
        }
      );

    stream.end(buffer);
  });
}

/* =====================================================
   PAGES
===================================================== */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

app.get("/admin", (req, res) => {
  res.sendFile(
    path.join(__dirname, "admin.html")
  );
});

/* =====================================================
   HEALTH
===================================================== */

app.get("/api/health", async (req, res) => {
  let database = "not configured";

  if (pool) {
    try {
      await pool.query("SELECT 1");
      database = "connected";
    } catch {
      database = "error";
    }
  }

  res.json({
    status: "ok",
    service: "स्वरAJ Music",
    database,
    cloudinary: cloudinaryReady,
    youtube: true,
    timestamp: new Date().toISOString()
  });
});

/* =====================================================
   CATEGORIES
===================================================== */

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
        error: "Unable to load categories",
        details: error.message
      });
    }
  }
);

/* =====================================================
   ALL SONGS
===================================================== */

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
        file_path,
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

    const songs = result.rows.map(song => ({
      ...song,

      source:
        song.audio_url
          ? "mp3"
          : song.youtube_url
            ? "youtube"
            : "unknown"
    }));

    res.json(songs);

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

/* =====================================================
   ADD SONG
===================================================== */

app.post(
  "/api/admin/upload-song",
  upload.single("audio"),
  async (req, res) => {

    if (!pool) {
      return res.status(503).json({
        success: false,
        error: "Database not configured"
      });
    }

    try {

      const title =
        clean(req.body.title);

      const artist =
        clean(req.body.artist);

      const album =
        clean(req.body.album);

      const category =
        clean(req.body.category) ||
        "All Songs";

      const language =
        clean(req.body.language);

      const genre =
        clean(req.body.genre);

      const audioUrl =
        nullable(req.body.audio_url);

      const youtubeUrl =
        nullable(req.body.youtube_url);

      const coverUrl =
        nullable(req.body.cover_url);

      const lyrics =
        clean(req.body.lyrics);

      const featured =
        req.body.featured === "true";

      const published =
        req.body.published !== "false";

      if (!title) {
        return res.status(400).json({
          success: false,
          error: "Song title is required."
        });
      }

      if (youtubeUrl) {
        const youtubeId =
          extractYouTubeVideoId(
            youtubeUrl
          );

        if (!youtubeId) {
          return res.status(400).json({
            success: false,
            error:
              "Invalid YouTube URL."
          });
        }
      }

      /*
       * Do not allow ambiguous
       * MP3 + YouTube source.
       */
      if (audioUrl && youtubeUrl) {
        return res.status(400).json({
          success: false,
          error:
            "Use either MP3 URL/upload OR YouTube URL, not both."
        });
      }

      let finalAudioUrl =
        audioUrl;

      /*
       * Uploaded MP3
       */
      if (req.file) {

        if (!cloudinaryReady) {
          return res.status(500).json({
            success: false,
            error:
              "CLOUDINARY_URL is not configured."
          });
        }

        const uploaded =
          await uploadAudio(
            req.file.buffer,
            req.file.originalname
          );

        finalAudioUrl =
          uploaded.secure_url;
      }

      if (
        finalAudioUrl &&
        youtubeUrl
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Only one playback source is allowed."
        });
      }

      if (
        !finalAudioUrl &&
        !youtubeUrl
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Add an MP3 URL, upload an MP3, or add a YouTube URL."
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
            file_path,
            audio_url,
            youtube_url,
            cover_url,
            lyrics,
            featured,
            published
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,
            NULL,$7,$8,$9,$10,$11,$12
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

      const song =
        result.rows[0];

      res.status(201).json({
        success: true,
        message:
          "Song added successfully.",
        song: {
          ...song,
          source:
            song.audio_url
              ? "mp3"
              : "youtube"
        }
      });

    } catch (error) {

      console.error(
        "ADD SONG ERROR:",
        error
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
          error.detail || null
      });
    }
  }
);

/* =====================================================
   DELETE
===================================================== */

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
          RETURNING id
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
          "Song deleted successfully."
      });

    } catch (error) {

      console.error(
        "DELETE ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Failed to delete song.",
        details:
          error.message
      });
    }
  }
);

/* =====================================================
   API 404
===================================================== */

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error:
      "API endpoint not found",
    path:
      req.originalUrl
  });
});

/* =====================================================
   ERROR HANDLER
===================================================== */

app.use(
  (error, req, res, next) => {

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

/* =====================================================
   START
===================================================== */

async function startServer() {

  try {

    await initDatabase();

    app.listen(
      PORT,
      "0.0.0.0",
      () => {

        console.log(
          "================================"
        );

        console.log(
          "स्वरAJ Music Server"
        );

        console.log(
          `PORT: ${PORT}`
        );

        console.log(
          `DATABASE: ${
            pool
              ? "READY"
              : "NOT CONFIGURED"
          }`
        );

        console.log(
          `CLOUDINARY: ${
            cloudinaryReady
              ? "READY"
              : "NOT CONFIGURED"
          }`
        );

        console.log(
          "MP3: ENABLED"
        );

        console.log(
          "YOUTUBE: ENABLED"
        );

        console.log(
          "================================"
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