const express = require("express");
const multer = require("multer");
const { Pool } = require("pg");
const path = require("path");

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

const ROOT = __dirname;
const IMAGES_DIR = path.join(ROOT, "images");

const ADMIN_KEY =
  process.env.ADMIN_KEY || "change-this-admin-key";

const DATABASE_URL =
  process.env.DATABASE_URL || "";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

// ============================================================
// PostgreSQL
// ============================================================

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not configured.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// ============================================================
// Middleware
// ============================================================

app.disable("x-powered-by");

app.use(
  express.json({
    limit: "5mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "5mb"
  })
);

app.use(
  "/images",
  express.static(IMAGES_DIR, {
    maxAge: "1d"
  })
);

// ============================================================
// Multer
// Store uploaded MP3 temporarily in memory.
// Then PostgreSQL BYTEA stores the actual file.
// ============================================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_FILE_SIZE
  },

  fileFilter: (req, file, cb) => {
    const allowed = [
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
      allowed.includes(file.mimetype) ||
      allowedExtensions.includes(extension)
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only MP3, M4A, WAV, OGG and AAC files are allowed."
        )
      );
    }
  }
});

// ============================================================
// Database initialization
// ============================================================

async function initializeDatabase() {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS songs (
        id BIGSERIAL PRIMARY KEY,

        title VARCHAR(255) NOT NULL,

        artist VARCHAR(255)
          NOT NULL
          DEFAULT 'SwarAJ',

        album VARCHAR(255)
          NOT NULL
          DEFAULT 'Singles',

        category VARCHAR(100)
          NOT NULL
          DEFAULT 'Other',

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
          NOT NULL
          DEFAULT NOW(),

        updated_at TIMESTAMPTZ
          NOT NULL
          DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_title
      ON songs(title);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_artist
      ON songs(artist);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_category
      ON songs(category);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_source_type
      ON songs(source_type);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_youtube_video_id
      ON songs(youtube_video_id);
    `);

    console.log("PostgreSQL database initialized.");
  } finally {
    client.release();
  }
}

// ============================================================
// Helpers
// ============================================================

function cleanText(value, fallback = "") {
  return String(value || fallback)
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
      const v = url.searchParams.get("v");

      if (v) {
        return v;
      }

      const match = url.pathname.match(
        /^\/(?:shorts|embed|live)\/([^/?]+)/
      );

      return match ? match[1] : null;
    }
  } catch (_) {}

  return null;
}

function getYouTubeUrl(videoId) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(
    videoId
  )}`;
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

function mapSong(row) {
  let coverUrl =
    row.cover_url ||
    "/images/ganpati.jpg";

  if (
    row.source_type === "youtube" &&
    row.youtube_video_id
  ) {
    coverUrl =
      row.cover_url ||
      `https://i.ytimg.com/vi/${encodeURIComponent(
        row.youtube_video_id
      )}/hqdefault.jpg`;
  }

  return {
    id: String(row.id),

    title: row.title,
    artist: row.artist,
    album: row.album,
    category: row.category,

    cover_url: coverUrl,

    source_type: row.source_type,

    audio_url:
      row.source_type === "mp3_url"
        ? row.audio_url
        : row.source_type === "upload"
          ? `/api/songs/${row.id}/audio`
          : null,

    youtube_url:
      row.youtube_url || null,

    youtube_video_id:
      row.youtube_video_id || null,

    file_name:
      row.file_name || null,

    file_size:
      row.file_size || null,

    created_at: row.created_at
  };
}

// ============================================================
// Health
// ============================================================

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
      message: "SwarAJ server is running",

      database: "PostgreSQL",
      databaseConfigured: true,

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
      database: "PostgreSQL",
      error: error.message
    });
  }
});

// ============================================================
// GET ALL SONGS
// ============================================================

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
    console.error("Songs API error:", error);

    res.status(500).json({
      success: false,
      songs: [],
      error: error.message
    });
  }
});

// ============================================================
// SEARCH SONGS
// ============================================================

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
    res.status(500).json({
      success: false,
      songs: [],
      error: error.message
    });
  }
});

// ============================================================
// CATEGORIES
// ============================================================

app.get(
  "/api/categories",
  async (req, res) => {
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
  }
);

// ============================================================
// GET CATEGORY SONGS
// ============================================================

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

// ============================================================
// STREAM UPLOADED MP3 FROM POSTGRES BYTEA
// ============================================================

app.get(
  "/api/songs/:id/audio",
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          file_data,
          mime_type,
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

      const mime =
        song.mime_type ||
        "audio/mpeg";

      res.setHeader(
        "Content-Type",
        mime
      );

      res.setHeader(
        "Accept-Ranges",
        "bytes"
      );

      res.setHeader(
        "Cache-Control",
        "public, max-age=3600"
      );

      res.send(song.file_data);
    } catch (error) {
      console.error(
        "Audio stream error:",
        error
      );

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ============================================================
// ADMIN VERIFY
// ============================================================

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

// ============================================================
// ADMIN LIST
// ============================================================

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
          source_type,
          audio_url,
          youtube_url,
          file_name,
          file_size,
          created_at
        FROM songs
        ORDER BY created_at DESC
      `);

      res.json({
        success: true,
        songs: result.rows
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

// ============================================================
// ADMIN UPLOAD MP3 FILE
// ============================================================

app.post(
  "/api/admin/upload",
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Please select an MP3 file."
        });
      }

      const title =
        cleanText(
          req.body.title,
          path.basename(
            req.file.originalname,
            path.extname(
              req.file.originalname
            )
          )
        );

      const artist =
        cleanText(
          req.body.artist,
          "SwarAJ"
        );

      const album =
        cleanText(
          req.body.album,
          "Singles"
        );

      const category =
        cleanText(
          req.body.category,
          "Other"
        );

      const coverUrl =
        cleanText(
          req.body.coverUrl,
          "/images/ganpati.jpg"
        );

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
          $1,$2,$3,$4,$5,
          'upload',
          $6,$7,$8,$9
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
          req.file.mimetype ||
            "audio/mpeg",
          req.file.size
        ]
      );

      res.status(201).json({
        success: true,
        message:
          "MP3 uploaded and stored in PostgreSQL.",
        song:
          mapSong(
            result.rows[0]
          )
      });
    } catch (error) {
      console.error(
        "Upload error:",
        error
      );

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ============================================================
// ADMIN ADD MP3 URL
// ============================================================

app.post(
  "/api/admin/mp3-url",
  requireAdmin,
  async (req, res) => {
    try {
      const audioUrl =
        cleanText(
          req.body.audioUrl ||
          req.body.audio_url
        );

      if (!audioUrl) {
        return res.status(400).json({
          success: false,
          error: "MP3 URL is required."
        });
      }

      try {
        new URL(audioUrl);
      } catch (_) {
        return res.status(400).json({
          success: false,
          error: "Invalid MP3 URL."
        });
      }

      const title =
        cleanText(
          req.body.title,
          "Online Song"
        );

      const artist =
        cleanText(
          req.body.artist,
          "SwarAJ"
        );

      const album =
        cleanText(
          req.body.album,
          "Singles"
        );

      const category =
        cleanText(
          req.body.category,
          "Other"
        );

      const coverUrl =
        cleanText(
          req.body.coverUrl,
          "/images/ganpati.jpg"
        );

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
          $1,$2,$3,$4,$5,
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
          artist,
          album,
          category,
          coverUrl,
          audioUrl
        ]
      );

      res.status(201).json({
        success: true,
        message:
          "MP3 URL added to PostgreSQL.",
        song:
          mapSong(
            result.rows[0]
          )
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

// ============================================================
// ADMIN ADD YOUTUBE URL
// ============================================================

app.post(
  "/api/admin/youtube",
  requireAdmin,
  async (req, res) => {
    try {
      const youtubeUrl =
        cleanText(
          req.body.youtubeUrl ||
          req.body.youtube_url
        );

      const videoId =
        getYouTubeId(
          youtubeUrl
        );

      if (!videoId) {
        return res.status(400).json({
          success: false,
          error:
            "Enter a valid YouTube URL."
        });
      }

      const duplicate =
        await pool.query(
          `
          SELECT id
          FROM songs
          WHERE
            youtube_video_id = $1
          LIMIT 1
          `,
          [videoId]
        );

      if (duplicate.rows.length) {
        return res.status(409).json({
          success: false,
          error:
            "This YouTube song already exists."
        });
      }

      const title =
        cleanText(
          req.body.title,
          "YouTube Song"
        );

      const artist =
        cleanText(
          req.body.artist,
          "YouTube"
        );

      const album =
        cleanText(
          req.body.album,
          "Singles"
        );

      const category =
        cleanText(
          req.body.category,
          "YouTube"
        );

      const coverUrl =
        cleanText(
          req.body.coverUrl,
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
        );

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
          $1,$2,$3,$4,$5,
          'youtube',
          $6,$7
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
          artist,
          album,
          category,
          coverUrl,
          getYouTubeUrl(videoId),
          videoId
        ]
      );

      res.status(201).json({
        success: true,
        message:
          "YouTube song added to PostgreSQL.",
        song:
          mapSong(
            result.rows[0]
          )
      });
    } catch (error) {
      console.error(
        "YouTube add error:",
        error
      );

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ============================================================
// ADMIN UPDATE SONG
// ============================================================

app.put(
  "/api/admin/songs/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        UPDATE songs
        SET
          title = COALESCE(
            NULLIF($1, ''),
            title
          ),
          artist = COALESCE(
            NULLIF($2, ''),
            artist
          ),
          album = COALESCE(
            NULLIF($3, ''),
            album
          ),
          category = COALESCE(
            NULLIF($4, ''),
            category
          ),
          cover_url = COALESCE(
            NULLIF($5, ''),
            cover_url
          ),
          updated_at = NOW()
        WHERE id = $6
        RETURNING *
        `,
        [
          cleanText(req.body.title),
          cleanText(req.body.artist),
          cleanText(req.body.album),
          cleanText(req.body.category),
          cleanText(req.body.coverUrl),
          req.params.id
        ]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          success: false,
          error: "Song not found."
        });
      }

      res.json({
        success: true,
        song:
          mapSong(
            result.rows[0]
          )
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ============================================================
// ADMIN DELETE SONG
// ============================================================

app.delete(
  "/api/admin/songs/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        DELETE FROM songs
        WHERE id = $1
        RETURNING id, title, source_type
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
        message:
          "Song deleted permanently from PostgreSQL.",
        deleted:
          result.rows[0]
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

// ============================================================
// Static files
// ============================================================

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

// ============================================================
// 404 / fallback
// IMPORTANT: Express 5 compatible.
// DO NOT use app.get("*")
// ============================================================

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      success: false,
      error: "API endpoint not found"
    });
  }

  res.sendFile(
    path.join(ROOT, "index.html")
  );
});

// ============================================================
// Start
// ============================================================

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(
      PORT,
      HOST,
      () => {
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
          "Database: PostgreSQL"
        );

        console.log(
          "MP3 file storage: PostgreSQL BYTEA"
        );

        console.log(
          "YouTube: URL + video ID"
        );

        console.log(
          `Node: ${process.version}`
        );

        console.log(
          "===================================="
        );
      }
    );
  } catch (error) {
    console.error(
      "Failed to start server:",
      error
    );

    process.exit(1);
  }
}

startServer();