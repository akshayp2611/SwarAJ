const express = require("express");
const multer = require("multer");
const { Pool } = require("pg");
const path = require("path");

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

const ROOT = __dirname;
const IMAGES_DIR = path.join(ROOT, "images");

const DATABASE_URL = process.env.DATABASE_URL || "";
const ADMIN_KEY = process.env.ADMIN_KEY || "change-this-admin-key";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

if (!DATABASE_URL) {
  console.error("====================================");
  console.error("ERROR: DATABASE_URL is not configured");
  console.error("====================================");
  process.exit(1);
}

/* =========================================================
   POSTGRESQL
========================================================= */

const pool = new Pool({
  connectionString: DATABASE_URL,

  ssl: {
    rejectUnauthorized: false
  },

  max: 5,

  idleTimeoutMillis: 30000,

  connectionTimeoutMillis: 10000
});

pool.on("error", (error) => {
  console.error("PostgreSQL pool error:", error);
});

/* =========================================================
   EXPRESS
========================================================= */

app.disable("x-powered-by");

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

app.use(
  "/images",
  express.static(IMAGES_DIR, {
    maxAge: "1d"
  })
);

/* =========================================================
   MULTER
========================================================= */

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_FILE_SIZE
  },

  fileFilter: (req, file, callback) => {
    const allowedMimeTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/mp4",
      "audio/x-m4a",
      "audio/wav",
      "audio/x-wav",
      "audio/ogg",
      "audio/aac"
    ];

    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    const allowedExtensions = [
      ".mp3",
      ".m4a",
      ".wav",
      ".ogg",
      ".aac"
    ];

    if (
      allowedMimeTypes.includes(file.mimetype) ||
      allowedExtensions.includes(extension)
    ) {
      callback(null, true);
    } else {
      callback(
        new Error(
          "Only MP3, M4A, WAV, OGG and AAC files are allowed."
        )
      );
    }
  }
});

/* =========================================================
   DATABASE INITIALIZATION
========================================================= */

async function initializeDatabase() {
  const client = await pool.connect();

  try {
    console.log("Initializing PostgreSQL database...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS songs (
        id BIGSERIAL PRIMARY KEY,

        title VARCHAR(255) NOT NULL,

        artist VARCHAR(255)
          NOT NULL DEFAULT 'SwarAJ',

        album VARCHAR(255)
          NOT NULL DEFAULT 'Singles',

        category VARCHAR(100)
          NOT NULL DEFAULT 'Other',

        cover_url TEXT,

        source_type VARCHAR(30)
          NOT NULL,

        audio_url TEXT,

        youtube_url TEXT,

        youtube_video_id VARCHAR(50),

        file_data BYTEA,

        file_name TEXT,

        mime_type VARCHAR(100),

        file_size BIGINT,

        created_at TIMESTAMPTZ
          NOT NULL DEFAULT NOW(),

        updated_at TIMESTAMPTZ
          NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_title
      ON songs(title)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_artist
      ON songs(artist)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_category
      ON songs(category)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_source_type
      ON songs(source_type)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_youtube_video_id
      ON songs(youtube_video_id)
    `);

    console.log("PostgreSQL database initialized successfully.");
  } finally {
    client.release();
  }
}

/* =========================================================
   HELPERS
========================================================= */

function cleanText(value, fallback = "") {
  return String(value ?? fallback)
    .trim()
    .replace(/\s+/g, " ");
}

function getYouTubeId(value) {
  if (!value) {
    return null;
  }

  const input = String(value).trim();

  if (/^[A-Za-z0-9_-]{11}$/.test(input)) {
    return input;
  }

  try {
    const url = new URL(input);

    const host = url.hostname
      .toLowerCase()
      .replace(/^www\./, "");

    if (host === "youtu.be") {
      return (
        url.pathname
          .replace(/^\/+/, "")
          .split("/")[0] || null
      );
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com"
    ) {
      const videoId = url.searchParams.get("v");

      if (videoId) {
        return videoId;
      }

      const match = url.pathname.match(
        /^\/(?:shorts|embed|live)\/([^/?]+)/
      );

      if (match) {
        return match[1];
      }
    }
  } catch (error) {
    return null;
  }

  return null;
}

function youtubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(
    videoId
  )}`;
}

function youtubeEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${encodeURIComponent(
    videoId
  )}?enablejsapi=1&rel=0&playsinline=1`;
}

function defaultCover(row) {
  if (
    row.source_type === "youtube" &&
    row.youtube_video_id
  ) {
    return `https://i.ytimg.com/vi/${encodeURIComponent(
      row.youtube_video_id
    )}/hqdefault.jpg`;
  }

  return row.cover_url || "/images/ganpati.jpg";
}

function mapSong(row) {
  return {
    id: String(row.id),

    title: row.title,

    artist: row.artist,

    album: row.album,

    category: row.category,

    cover_url: defaultCover(row),

    source_type: row.source_type,

    audio_url:
      row.source_type === "upload"
        ? `/api/songs/${row.id}/audio`
        : row.source_type === "mp3_url"
          ? row.audio_url
          : null,

    youtube_url:
      row.youtube_url || null,

    youtube_video_id:
      row.youtube_video_id || null,

    youtube_embed_url:
      row.youtube_video_id
        ? youtubeEmbedUrl(row.youtube_video_id)
        : null,

    file_name:
      row.file_name || null,

    file_size:
      row.file_size
        ? Number(row.file_size)
        : null,

    created_at: row.created_at
  };
}

function requireAdmin(req, res, next) {
  const key =
    req.headers["x-admin-key"] ||
    req.body?.adminKey ||
    req.query?.adminKey;

  if (!key || key !== ADMIN_KEY) {
    return res.status(401).json({
      success: false,
      error: "Invalid admin key"
    });
  }

  next();
}

/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)::int AS total,

        COUNT(*) FILTER (
          WHERE source_type = 'upload'
        )::int AS uploads,

        COUNT(*) FILTER (
          WHERE source_type = 'mp3_url'
        )::int AS mp3_urls,

        COUNT(*) FILTER (
          WHERE source_type = 'youtube'
        )::int AS youtube

      FROM songs
    `);

    const stats = result.rows[0];

    res.json({
      success: true,

      status: "ok",

      server: "SwarAJ Music Server",

      database: "PostgreSQL",

      totalSongs: stats.total,

      uploadedMp3: stats.uploads,

      mp3Urls: stats.mp3_urls,

      youtubeSongs: stats.youtube,

      adminConfigured:
        Boolean(process.env.ADMIN_KEY),

      node: process.version,

      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Health error:", error);

    res.status(500).json({
      success: false,
      status: "error",
      error: error.message
    });
  }
});

/* =========================================================
   GET ALL SONGS
========================================================= */

app.get("/api/songs", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        title,
        artist,
        album,
        category,
        cover_url,
        source_type,
        audio_url,
        youtube_url,
        youtube_video_id,
        file_name,
        file_size,
        created_at
      FROM songs
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      songs: result.rows.map(mapSong)
    });
  } catch (error) {
    console.error("GET /api/songs error:", error);

    res.status(500).json({
      success: false,
      songs: [],
      error: error.message
    });
  }
});

/* =========================================================
   SEARCH
========================================================= */

app.get("/api/search", async (req, res) => {
  const query = cleanText(req.query.q);

  if (!query) {
    return res.json({
      success: true,
      count: 0,
      songs: []
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        title,
        artist,
        album,
        category,
        cover_url,
        source_type,
        audio_url,
        youtube_url,
        youtube_video_id,
        file_name,
        file_size,
        created_at
      FROM songs
      WHERE
        title ILIKE $1
        OR artist ILIKE $1
        OR album ILIKE $1
        OR category ILIKE $1
      ORDER BY
        CASE
          WHEN title ILIKE $2 THEN 0
          ELSE 1
        END,
        title
      LIMIT 100
      `,
      [`%${query}%`, `${query}%`]
    );

    res.json({
      success: true,
      count: result.rows.length,
      songs: result.rows.map(mapSong)
    });
  } catch (error) {
    console.error("Search error:", error);

    res.status(500).json({
      success: false,
      songs: [],
      error: error.message
    });
  }
});

/* =========================================================
   CATEGORIES
========================================================= */

app.get("/api/categories", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        category AS name,
        COUNT(*)::int AS count
      FROM songs
      GROUP BY category
      ORDER BY category
    `);

    res.json({
      success: true,
      categories: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      categories: [],
      error: error.message
    });
  }
});

/* =========================================================
   CATEGORY SONGS
========================================================= */

app.get(
  "/api/categories/:category",
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          id,
          title,
          artist,
          album,
          category,
          cover_url,
          source_type,
          audio_url,
          youtube_url,
          youtube_video_id,
          file_name,
          file_size,
          created_at
        FROM songs
        WHERE category ILIKE $1
        ORDER BY title
        `,
        [req.params.category]
      );

      res.json({
        success: true,
        count: result.rows.length,
        songs: result.rows.map(mapSong)
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        songs: [],
        error: error.message
      });
    }
  }
);

/* =========================================================
   STREAM UPLOADED FILE
========================================================= */

app.get(
  "/api/songs/:id/audio",
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          file_data,
          mime_type,
          file_size,
          file_name
        FROM songs
        WHERE id = $1
          AND source_type = 'upload'
        `,
        [req.params.id]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          success: false,
          error: "Audio file not found"
        });
      }

      const song = result.rows[0];

      if (!song.file_data) {
        return res.status(404).json({
          success: false,
          error: "Audio data is empty"
        });
      }

      const buffer = song.file_data;

      const totalSize = buffer.length;

      const mimeType =
        song.mime_type || "audio/mpeg";

      res.setHeader(
        "Content-Type",
        mimeType
      );

      res.setHeader(
        "Accept-Ranges",
        "bytes"
      );

      res.setHeader(
        "Cache-Control",
        "public, max-age=3600"
      );

      const range = req.headers.range;

      if (!range) {
        res.setHeader(
          "Content-Length",
          totalSize
        );

        return res.status(200).send(buffer);
      }

      const match = range.match(
        /bytes=(\d*)-(\d*)/
      );

      if (!match) {
        return res.status(416).end();
      }

      const start = match[1]
        ? Number(match[1])
        : 0;

      const end = match[2]
        ? Number(match[2])
        : totalSize - 1;

      if (
        start >= totalSize ||
        end >= totalSize ||
        start > end
      ) {
        res.setHeader(
          "Content-Range",
          `bytes */${totalSize}`
        );

        return res.status(416).end();
      }

      const chunk = buffer.subarray(
        start,
        end + 1
      );

      res.status(206);

      res.setHeader(
        "Content-Range",
        `bytes ${start}-${end}/${totalSize}`
      );

      res.setHeader(
        "Content-Length",
        chunk.length
      );

      return res.send(chunk);
    } catch (error) {
      console.error(
        "Audio streaming error:",
        error
      );

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/* =========================================================
   ADMIN VERIFY
========================================================= */

app.post(
  "/api/admin/verify",
  requireAdmin,
  (req, res) => {
    res.json({
      success: true,
      message: "Admin authentication successful"
    });
  }
);

/* =========================================================
   ADMIN SONG LIST
========================================================= */

app.get(
  "/api/admin/songs",
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          title,
          artist,
          album,
          category,
          cover_url,
          source_type,
          audio_url,
          youtube_url,
          youtube_video_id,
          file_name,
          file_size,
          created_at
        FROM songs
        ORDER BY created_at DESC
      `);

      res.json({
        success: true,
        songs: result.rows.map(mapSong)
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        songs: [],
        error: error.message
      });
    }
  }
);

/* =========================================================
   ADMIN UPLOAD MP3
========================================================= */

app.post(
  "/api/admin/upload",
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Please select an audio file."
        });
      }

      const title = cleanText(
        req.body.title,
        path.basename(
          req.file.originalname,
          path.extname(
            req.file.originalname
          )
        )
      );

      const artist = cleanText(
        req.body.artist,
        "SwarAJ"
      );

      const album = cleanText(
        req.body.album,
        "Singles"
      );

      const category = cleanText(
        req.body.category,
        "Other"
      );

      const coverUrl =
        cleanText(req.body.coverUrl) ||
        null;

      const result = await pool.query(
        `
        INSERT INTO songs (
          title,
          artist,
          album,
          category,
          cover_url,
          source_type,
          file_data,
          file_name,
          mime_type,
          file_size
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          'upload',
          $6,
          $7,
          $8,
          $9
        )
        RETURNING
          id,
          title,
          artist,
          album,
          category,
          cover_url,
          source_type,
          file_name,
          file_size,
          created_at
        `,
        [
          title,
          artist,
          album,
          category,
          coverUrl,
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype || "audio/mpeg",
          req.file.size
        ]
      );

      res.status(201).json({
        success: true,
        message: "MP3 uploaded successfully",
        song: mapSong(result.rows[0])
      });
    } catch (error) {
      console.error(
        "MP3 upload error:",
        error
      );

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/* =========================================================
   ADMIN ADD MP3 URL
========================================================= */

app.post(
  "/api/admin/mp3-url",
  requireAdmin,
  async (req, res) => {
    try {
      const title = cleanText(req.body.title);

      const audioUrl = cleanText(
        req.body.audioUrl
      );

      if (!title) {
        return res.status(400).json({
          success: false,
          error: "Title is required."
        });
      }

      if (!audioUrl) {
        return res.status(400).json({
          success: false,
          error: "MP3 URL is required."
        });
      }

      let parsed;

      try {
        parsed = new URL(audioUrl);

        if (
          !["http:", "https:"].includes(
            parsed.protocol
          )
        ) {
          throw new Error();
        }
      } catch (_) {
        return res.status(400).json({
          success: false,
          error: "Invalid audio URL."
        });
      }

      const result = await pool.query(
        `
        INSERT INTO songs (
          title,
          artist,
          album,
          category,
          cover_url,
          source_type,
          audio_url
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          'mp3_url',
          $6
        )
        RETURNING
          id,
          title,
          artist,
          album,
          category,
          cover_url,
          source_type,
          audio_url,
          created_at
        `,
        [
          title,
          cleanText(
            req.body.artist,
            "SwarAJ"
          ),
          cleanText(
            req.body.album,
            "Singles"
          ),
          cleanText(
            req.body.category,
            "Other"
          ),
          cleanText(
            req.body.coverUrl
          ) || null,
          audioUrl
        ]
      );

      res.status(201).json({
        success: true,
        message: "MP3 URL added successfully",
        song: mapSong(result.rows[0])
      });
    } catch (error) {
      console.error(
        "MP3 URL error:",
        error
      );

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/* =========================================================
   ADMIN ADD YOUTUBE
========================================================= */

app.post(
  "/api/admin/youtube",
  requireAdmin,
  async (req, res) => {
    try {
      const title = cleanText(req.body.title);

      const youtubeUrl = cleanText(
        req.body.youtubeUrl
      );

      if (!title) {
        return res.status(400).json({
          success: false,
          error: "Title is required."
        });
      }

      if (!youtubeUrl) {
        return res.status(400).json({
          success: false,
          error: "YouTube URL is required."
        });
      }

      const videoId =
        getYouTubeId(youtubeUrl);

      if (!videoId) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid YouTube URL. Please use a YouTube watch, shorts, youtu.be, embed or live URL."
        });
      }

      const result = await pool.query(
        `
        INSERT INTO songs (
          title,
          artist,
          album,
          category,
          cover_url,
          source_type,
          youtube_url,
          youtube_video_id
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          'youtube',
          $6,
          $7
        )
        RETURNING
          id,
          title,
          artist,
          album,
          category,
          cover_url,
          source_type,
          youtube_url,
          youtube_video_id,
          created_at
        `,
        [
          title,
          cleanText(
            req.body.artist,
            "SwarAJ"
          ),
          cleanText(
            req.body.album,
            "Singles"
          ),
          cleanText(
            req.body.category,
            "Other"
          ),
          cleanText(
            req.body.coverUrl
          ) || null,
          youtubeWatchUrl(videoId),
          videoId
        ]
      );

      res.status(201).json({
        success: true,
        message:
          "YouTube song added successfully",
        song: mapSong(result.rows[0])
      });
    } catch (error) {
      console.error(
        "YouTube error:",
        error
      );

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/* =========================================================
   ADMIN DELETE
========================================================= */

app.delete(
  "/api/admin/songs/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        DELETE FROM songs
        WHERE id = $1
        RETURNING id, title
        `,
        [req.params.id]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          success: false,
          error: "Song not found."
        });
      }

      res.json({
        success: true,
        message: "Song deleted successfully",
        id: String(result.rows[0].id),
        title: result.rows[0].title
      });
    } catch (error) {
      console.error(
        "Delete error:",
        error
      );

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/* =========================================================
   FRONTEND
========================================================= */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(ROOT, "index.html")
  );
});

app.get("/index.html", (req, res) => {
  res.sendFile(
    path.join(ROOT, "index.html")
  );
});

app.get("/script.js", (req, res) => {
  res.sendFile(
    path.join(ROOT, "script.js")
  );
});

app.get("/styles.css", (req, res) => {
  res.sendFile(
    path.join(ROOT, "styles.css")
  );
});

/* =========================================================
   404
========================================================= */

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      success: false,
      error: "API endpoint not found"
    });
  }

  res.status(404).send("Page not found");
});

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use((error, req, res, next) => {
  console.error("Server error:", error);

  if (
    error.code === "LIMIT_FILE_SIZE"
  ) {
    return res.status(413).json({
      success: false,
      error:
        "File is too large. Maximum size is 100 MB."
    });
  }

  res.status(500).json({
    success: false,
    error:
      error.message ||
      "Internal server error"
  });
});

/* =========================================================
   START SERVER
========================================================= */

async function startServer() {
  try {
    await initializeDatabase();

    const result = await pool.query(`
      SELECT
        COUNT(*)::int AS total,

        COUNT(*) FILTER (
          WHERE source_type = 'upload'
        )::int AS uploads,

        COUNT(*) FILTER (
          WHERE source_type = 'mp3_url'
        )::int AS mp3_urls,

        COUNT(*) FILTER (
          WHERE source_type = 'youtube'
        )::int AS youtube

      FROM songs
    `);

    const stats = result.rows[0];

    app.listen(
      PORT,
      HOST,
      () => {
        console.log("");
        console.log(
          "===================================="
        );
        console.log(
          "        SwarAJ Music Server"
        );
        console.log(
          "===================================="
        );
        console.log(
          `Server: http://${HOST}:${PORT}`
        );
        console.log(
          `Database: PostgreSQL`
        );
        console.log(
          `Total songs: ${stats.total}`
        );
        console.log(
          `Uploaded MP3: ${stats.uploads}`
        );
        console.log(
          `MP3 URLs: ${stats.mp3_urls}`
        );
        console.log(
          `YouTube: ${stats.youtube}`
        );
        console.log(
          `Admin: ${
            process.env.ADMIN_KEY
              ? "CONFIGURED"
              : "DEFAULT KEY"
          }`
        );
        console.log(
          `Node: ${process.version}`
        );
        console.log(
          "===================================="
        );
        console.log("");
      }
    );
  } catch (error) {
    console.error(
      "Unable to start server:"
    );

    console.error(error);

    process.exit(1);
  }
}

startServer();