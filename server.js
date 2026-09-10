const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { Pool } = require("pg");

const app = express();

const PORT = Number(process.env.PORT) || 10000;
const HOST = "0.0.0.0";

const ADMIN_KEY = process.env.ADMIN_KEY || "";
const DATABASE_URL = process.env.DATABASE_URL || "";

const SONGS_DIR = path.join(__dirname, "songs");

const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
  ".mp4"
]);

let pool = null;
let dbReady = false;

/*
|--------------------------------------------------------------------------
| DATABASE
|--------------------------------------------------------------------------
| PostgreSQL is optional.
|
| If DATABASE_URL exists:
|   PostgreSQL + filesystem songs are used.
|
| If DATABASE_URL does not exist:
|   SwarAJ still starts and uses songs/ folder.
|--------------------------------------------------------------------------
*/

if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });
} else {
  console.warn(
    "DATABASE_URL is not configured. SwarAJ will use filesystem song mode."
  );
}

/*
|--------------------------------------------------------------------------
| EXPRESS
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| MULTER
|--------------------------------------------------------------------------
*/

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 100 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = String(file.mimetype || "").toLowerCase();

    const allowedMime = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/ogg",
      "audio/mp4",
      "audio/aac",
      "audio/x-m4a",
      "video/mp4"
    ];

    if (AUDIO_EXTENSIONS.has(ext) || allowedMime.includes(mime)) {
      return cb(null, true);
    }

    cb(
      new Error(
        "Only MP3, WAV, OGG, M4A, AAC and MP4 files are allowed."
      )
    );
  }
});

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function encodePath(filePath) {
  return filePath
    .split(path.sep)
    .map(encodeURIComponent)
    .join("/");
}

function cleanTitle(filename) {
  return (
    path
      .basename(filename, path.extname(filename))
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Untitled"
  );
}

/*
|--------------------------------------------------------------------------
| FILESYSTEM SONG SCANNER
|--------------------------------------------------------------------------
|
| Example:
|
| songs/
|   Bhakti/
|      ganpati.mp3
|
|   Love/
|      love-song.mp3
|
|   Marathi/
|      lavani.mp3
|
|   Energetic/
|      party.mp3
|
| The first folder becomes the category.
|--------------------------------------------------------------------------
*/

function scanSongs() {
  const songs = [];

  if (!fs.existsSync(SONGS_DIR)) {
    return songs;
  }

  function walk(directory, relativeBase = "") {
    let entries = [];

    try {
      entries = fs.readdirSync(directory, {
        withFileTypes: true
      });
    } catch (error) {
      console.error("Unable to read directory:", directory);
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }

      const fullPath = path.join(directory, entry.name);
      const relativePath = path.join(
        relativeBase,
        entry.name
      );

      if (entry.isDirectory()) {
        walk(fullPath, relativePath);
        continue;
      }

      const extension = path
        .extname(entry.name)
        .toLowerCase();

      if (!AUDIO_EXTENSIONS.has(extension)) {
        continue;
      }

      const parts = relativePath.split(path.sep);

      let stat = null;

      try {
        stat = fs.statSync(fullPath);
      } catch (error) {
        console.error(
          "Unable to read file information:",
          fullPath
        );
      }

      const category =
        parts.length > 1
          ? parts[0]
          : "Other";

      songs.push({
        id: "file:" + encodePath(relativePath),

        title: cleanTitle(entry.name),

        artist: "SwarAJ",

        album: "Singles",

        category,

        cover_url:
          "/images/default-cover.jpg",

        source_type: "filesystem",

        audio_url:
          "/songs/" +
          encodePath(relativePath),

        youtube_url: null,

        youtube_video_id: null,

        file_name: entry.name,

        file_size: stat ? stat.size : null,

        created_at: stat
          ? stat.mtime.toISOString()
          : null,

        updated_at: stat
          ? stat.mtime.toISOString()
          : null
      });
    }
  }

  walk(SONGS_DIR);

  return songs.sort((a, b) =>
    String(b.created_at || "").localeCompare(
      String(a.created_at || "")
    )
  );
}

/*
|--------------------------------------------------------------------------
| NORMALIZE DATABASE SONG
|--------------------------------------------------------------------------
*/

function normalizeSong(song) {
  return {
    id: song.id,

    title:
      song.title ||
      "Untitled",

    artist:
      song.artist ||
      "SwarAJ",

    album:
      song.album ||
      "Singles",

    category:
      song.category ||
      "Other",

    cover_url:
      song.cover_url ||
      "/images/default-cover.jpg",

    source_type:
      song.source_type ||
      "mp3_url",

    audio_url:
      song.source_type === "mp3_file" &&
      song.id
        ? `/api/songs/${song.id}/audio`
        : song.audio_url || null,

    youtube_url:
      song.youtube_url ||
      null,

    youtube_video_id:
      song.youtube_video_id ||
      null,

    file_name:
      song.file_name ||
      null,

    file_size:
      song.file_size
        ? Number(song.file_size)
        : null,

    created_at:
      song.created_at ||
      null,

    updated_at:
      song.updated_at ||
      null
  };
}

/*
|--------------------------------------------------------------------------
| DATABASE INITIALIZATION
|--------------------------------------------------------------------------
*/

async function initializeDatabase() {
  if (!pool) {
    return;
  }

  const connection = await pool.connect();

  try {
    await connection.query("BEGIN");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS songs (
        id BIGSERIAL PRIMARY KEY,

        title VARCHAR(255),

        artist VARCHAR(255)
          DEFAULT 'SwarAJ',

        album VARCHAR(255)
          DEFAULT 'Singles',

        category VARCHAR(100)
          DEFAULT 'Other',

        cover_url TEXT,

        source_type VARCHAR(30)
          DEFAULT 'mp3_url',

        audio_url TEXT,

        youtube_url TEXT,

        youtube_video_id VARCHAR(50),

        file_data BYTEA,

        file_name TEXT,

        mime_type VARCHAR(100),

        file_size BIGINT,

        created_at TIMESTAMPTZ
          DEFAULT NOW(),

        updated_at TIMESTAMPTZ
          DEFAULT NOW()
      )
    `);

    const columns = [
      ["title", "VARCHAR(255)"],
      ["artist", "VARCHAR(255)"],
      ["album", "VARCHAR(255)"],
      ["category", "VARCHAR(100)"],
      ["cover_url", "TEXT"],
      ["source_type", "VARCHAR(30)"],
      ["audio_url", "TEXT"],
      ["youtube_url", "TEXT"],
      ["youtube_video_id", "VARCHAR(50)"],
      ["file_data", "BYTEA"],
      ["file_name", "TEXT"],
      ["mime_type", "VARCHAR(100)"],
      ["file_size", "BIGINT"],
      ["created_at", "TIMESTAMPTZ DEFAULT NOW()"],
      ["updated_at", "TIMESTAMPTZ DEFAULT NOW()"]
    ];

    for (const [name, type] of columns) {
      await connection.query(
        `ALTER TABLE songs
         ADD COLUMN IF NOT EXISTS ${name} ${type}`
      );
    }

    await connection.query(`
      CREATE INDEX IF NOT EXISTS
      idx_songs_title
      ON songs(title)
    `);

    await connection.query(`
      CREATE INDEX IF NOT EXISTS
      idx_songs_artist
      ON songs(artist)
    `);

    await connection.query(`
      CREATE INDEX IF NOT EXISTS
      idx_songs_category
      ON songs(category)
    `);

    await connection.query(`
      CREATE INDEX IF NOT EXISTS
      idx_songs_source_type
      ON songs(source_type)
    `);

    await connection.query("COMMIT");

    dbReady = true;

    console.log("PostgreSQL database connected.");
  } catch (error) {
    await connection
      .query("ROLLBACK")
      .catch(() => {});

    dbReady = false;

    console.error(
      "Database initialization failed."
    );

    console.error(error.message);

    console.warn(
      "Continuing with filesystem song mode."
    );
  } finally {
    connection.release();
  }
}

/*
|--------------------------------------------------------------------------
| GET ALL SONGS
|--------------------------------------------------------------------------
*/

async function getAllSongs() {
  if (pool && dbReady) {
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
        created_at,
        updated_at
      FROM songs
      ORDER BY created_at DESC
    `);

    const databaseSongs =
      result.rows.map(normalizeSong);

    const filesystemSongs =
      scanSongs();

    return [
      ...databaseSongs,
      ...filesystemSongs
    ];
  }

  return scanSongs();
}

/*
|--------------------------------------------------------------------------
| ADMIN AUTH
|--------------------------------------------------------------------------
*/

function adminRequired(req, res, next) {
  if (!ADMIN_KEY) {
    return res.status(503).json({
      success: false,
      error:
        "ADMIN_KEY is not configured on the server."
    });
  }

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

/*
|--------------------------------------------------------------------------
| HEALTH
|--------------------------------------------------------------------------
*/

app.get("/api/health", async (req, res) => {
  const filesystemSongs =
    scanSongs();

  if (pool && dbReady) {
    try {
      const result = await pool.query(`
        SELECT COUNT(*)::INTEGER AS count
        FROM songs
      `);

      return res.json({
        success: true,
        ok: true,
        status: "healthy",

        database: "connected",

        mode:
          "database+filesystem",

        songs:
          result.rows[0].count +
          filesystemSongs.length,

        filesystemSongs:
          filesystemSongs.length
      });
    } catch (error) {
      dbReady = false;
    }
  }

  res.json({
    success: true,
    ok: true,
    status: "healthy",

    database:
      "not-configured",

    mode:
      "filesystem",

    songs:
      filesystemSongs.length,

    filesystemSongs:
      filesystemSongs.length
  });
});

/*
|--------------------------------------------------------------------------
| ALL SONGS
|--------------------------------------------------------------------------
*/

app.get("/api/songs", async (req, res) => {
  try {
    const songs =
      await getAllSongs();

    res.json({
      success: true,
      count: songs.length,
      songs
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

/*
|--------------------------------------------------------------------------
| SEARCH
|--------------------------------------------------------------------------
*/

app.get("/api/search", async (req, res) => {
  try {
    const query =
      String(req.query.q || "")
        .trim()
        .toLowerCase();

    const songs =
      await getAllSongs();

    const filtered =
      !query
        ? songs
        : songs.filter(song =>
            [
              song.title,
              song.artist,
              song.album,
              song.category
            ].some(value =>
              String(value || "")
                .toLowerCase()
                .includes(query)
            )
          );

    res.json({
      success: true,
      count: filtered.length,
      songs: filtered
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      count: 0,
      songs: [],
      error: error.message
    });
  }
});

/*
|--------------------------------------------------------------------------
| CATEGORIES
|--------------------------------------------------------------------------
*/

app.get(
  "/api/categories",
  async (req, res) => {
    try {
      const songs =
        await getAllSongs();

      const categoryMap =
        new Map();

      for (const song of songs) {
        const category =
          String(
            song.category || "Other"
          ).trim() || "Other";

        categoryMap.set(
          category,
          (categoryMap.get(category) || 0) + 1
        );
      }

      const categories =
        [...categoryMap.entries()]
          .sort((a, b) =>
            a[0].localeCompare(b[0])
          )
          .map(([name, count]) => ({
            name,
            category: name,
            count
          }));

      res.json({
        success: true,
        categories
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

/*
|--------------------------------------------------------------------------
| CATEGORY SONGS
|--------------------------------------------------------------------------
*/

app.get(
  "/api/categories/:category",
  async (req, res) => {
    try {
      const category =
        decodeURIComponent(
          req.params.category
        );

      const songs =
        (
          await getAllSongs()
        ).filter(song =>
          String(
            song.category || ""
          ).toLowerCase() ===
          category.toLowerCase()
        );

      res.json({
        success: true,
        category,
        count: songs.length,
        songs
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

/*
|--------------------------------------------------------------------------
| DATABASE AUDIO STREAM
|--------------------------------------------------------------------------
*/

app.get(
  "/api/songs/:id/audio",
  async (req, res) => {
    if (!pool || !dbReady) {
      return res
        .status(404)
        .send("Audio file not found");
    }

    try {
      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res
          .status(400)
          .send("Invalid song ID");
      }

      const result =
        await pool.query(
          `
          SELECT
            file_data,
            mime_type
          FROM songs
          WHERE id = $1
            AND source_type = 'mp3_file'
            AND file_data IS NOT NULL
          `,
          [id]
        );

      if (!result.rows.length) {
        return res
          .status(404)
          .send("Audio file not found");
      }

      const buffer =
        result.rows[0].file_data;

      const mime =
        result.rows[0].mime_type ||
        "audio/mpeg";

      const total =
        buffer.length;

      res.setHeader(
        "Accept-Ranges",
        "bytes"
      );

      const range =
        req.headers.range;

      if (!range) {
        res.setHeader(
          "Content-Type",
          mime
        );

        res.setHeader(
          "Content-Length",
          total
        );

        return res.end(buffer);
      }

      const match =
        /bytes=(\d*)-(\d*)/.exec(
          range
        );

      if (!match) {
        return res
          .status(416)
          .end();
      }

      let start =
        match[1]
          ? Number(match[1])
          : 0;

      let end =
        match[2]
          ? Number(match[2])
          : total - 1;

      if (!match[1]) {
        start =
          Math.max(
            0,
            total -
              Number(match[2])
          );

        end =
          total - 1;
      }

      if (
        start >= total ||
        end >= total ||
        start > end
      ) {
        res.setHeader(
          "Content-Range",
          `bytes */${total}`
        );

        return res
          .status(416)
          .end();
      }

      const chunk =
        buffer.subarray(
          start,
          end + 1
        );

      res.status(206);

      res.setHeader(
        "Content-Type",
        mime
      );

      res.setHeader(
        "Content-Range",
        `bytes ${start}-${end}/${total}`
      );

      res.setHeader(
        "Content-Length",
        chunk.length
      );

      res.end(chunk);
    } catch (error) {
      console.error(error);

      res
        .status(500)
        .send("Unable to load audio");
    }
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN LOGIN
|--------------------------------------------------------------------------
*/

app.post(
  "/api/admin/login",
  (req, res) => {
    if (!ADMIN_KEY) {
      return res.status(503).json({
        success: false,
        error:
          "ADMIN_KEY is not configured on Render."
      });
    }

    const key =
      req.body?.adminKey ||
      req.headers["x-admin-key"];

    if (key !== ADMIN_KEY) {
      return res.status(401).json({
        success: false,
        error: "Invalid admin key"
      });
    }

    res.json({
      success: true,
      message:
        "Admin login successful"
    });
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN SONG LIST
|--------------------------------------------------------------------------
*/

app.get(
  "/api/admin/songs",
  adminRequired,
  async (req, res) => {
    if (!pool || !dbReady) {
      return res.status(503).json({
        success: false,
        error:
          "DATABASE_URL is required for database admin features."
      });
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
            cover_url,
            source_type,
            audio_url,
            youtube_url,
            youtube_video_id,
            file_name,
            file_size,
            created_at,
            updated_at
          FROM songs
          ORDER BY created_at DESC
        `);

      res.json({
        success: true,
        songs:
          result.rows.map(
            normalizeSong
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

/*
|--------------------------------------------------------------------------
| ADMIN UPLOAD
|--------------------------------------------------------------------------
*/

app.post(
  "/api/admin/songs/upload",
  adminRequired,
  upload.single("file"),
  async (req, res) => {
    if (!pool || !dbReady) {
      return res.status(503).json({
        success: false,
        error:
          "DATABASE_URL is required for uploads."
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error:
            "Audio file is required."
        });
      }

      const title =
        String(
          req.body.title || ""
        ).trim();

      if (!title) {
        return res.status(400).json({
          success: false,
          error: "Title is required."
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
            'mp3_file',
            $6,
            $7,
            $8,
            $9
          )
          RETURNING *
          `,
          [
            title,

            String(
              req.body.artist ||
                "SwarAJ"
            ).trim(),

            String(
              req.body.album ||
                "Singles"
            ).trim(),

            String(
              req.body.category ||
                "Other"
            ).trim(),

            String(
              req.body.coverUrl ||
                ""
            ).trim() || null,

            req.file.buffer,

            req.file.originalname,

            req.file.mimetype ||
              "audio/mpeg",

            req.file.size
          ]
        );

      res.json({
        success: true,
        message:
          "MP3 uploaded successfully.",

        song:
          normalizeSong(
            result.rows[0]
          )
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN MP3 URL
|--------------------------------------------------------------------------
*/

app.post(
  "/api/admin/songs/mp3-url",
  adminRequired,
  async (req, res) => {
    if (!pool || !dbReady) {
      return res.status(503).json({
        success: false,
        error:
          "DATABASE_URL is required."
      });
    }

    try {
      const title =
        String(
          req.body.title || ""
        ).trim();

      const audioUrl =
        String(
          req.body.audioUrl || ""
        ).trim();

      if (!title || !audioUrl) {
        return res.status(400).json({
          success: false,
          error:
            "Title and MP3 URL are required."
        });
      }

      new URL(audioUrl);

      const result =
        await pool.query(
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
          RETURNING *
          `,
          [
            title,

            String(
              req.body.artist ||
                "SwarAJ"
            ).trim(),

            String(
              req.body.album ||
                "Singles"
            ).trim(),

            String(
              req.body.category ||
                "Other"
            ).trim(),

            String(
              req.body.coverUrl ||
                ""
            ).trim() || null,

            audioUrl
          ]
        );

      res.json({
        success: true,
        message:
          "MP3 URL added successfully.",

        song:
          normalizeSong(
            result.rows[0]
          )
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN YOUTUBE
|--------------------------------------------------------------------------
*/

app.post(
  "/api/admin/songs/youtube",
  adminRequired,
  async (req, res) => {
    if (!pool || !dbReady) {
      return res.status(503).json({
        success: false,
        error:
          "DATABASE_URL is required."
      });
    }

    try {
      const title =
        String(
          req.body.title || ""
        ).trim();

      const youtubeUrl =
        String(
          req.body.youtubeUrl || ""
        ).trim();

      if (!title || !youtubeUrl) {
        return res.status(400).json({
          success: false,
          error:
            "Title and YouTube URL are required."
        });
      }

      let videoId =
        String(
          req.body.youtubeVideoId ||
            ""
        ).trim();

      if (!videoId) {
        try {
          const parsed =
            new URL(youtubeUrl);

          if (
            parsed.hostname.includes(
              "youtu.be"
            )
          ) {
            videoId =
              parsed.pathname
                .replace("/", "")
                .trim();
          }

          if (
            parsed.hostname.includes(
              "youtube.com"
            )
          ) {
            videoId =
              parsed.searchParams.get(
                "v"
              ) || "";
          }
        } catch (_) {}
      }

      const result =
        await pool.query(
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
          RETURNING *
          `,
          [
            title,

            String(
              req.body.artist ||
                "SwarAJ"
            ).trim(),

            String(
              req.body.album ||
                "Singles"
            ).trim(),

            String(
              req.body.category ||
                "Other"
            ).trim(),

            String(
              req.body.coverUrl ||
                ""
            ).trim() || null,

            youtubeUrl,

            videoId || null
          ]
        );

      res.json({
        success: true,
        message:
          "YouTube song added successfully.",

        song:
          normalizeSong(
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

/*
|--------------------------------------------------------------------------
| ADMIN DELETE
|--------------------------------------------------------------------------
*/

app.delete(
  "/api/admin/songs/:id",
  adminRequired,
  async (req, res) => {
    if (!pool || !dbReady) {
      return res.status(503).json({
        success: false,
        error:
          "DATABASE_URL is required."
      });
    }

    try {
      const id =
        Number(req.params.id);

      const result =
        await pool.query(
          `
          DELETE FROM songs
          WHERE id = $1
          RETURNING id, title
          `,
          [id]
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
          "Song deleted successfully.",

        song:
          result.rows[0]
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| STATIC FILES
|--------------------------------------------------------------------------
*/

app.use(
  "/songs",
  express.static(SONGS_DIR, {
    acceptRanges: true,
    maxAge: "1h"
  })
);

app.use(
  "/images",
  express.static(
    path.join(__dirname, "images"),
    {
      maxAge: "1d"
    }
  )
);

app.use(
  express.static(__dirname, {
    index: "index.html"
  })
);

/*
|--------------------------------------------------------------------------
| SPA FALLBACK
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "index.html"
    )
  );
});

app.use((req, res, next) => {
  if (
    req.method === "GET" &&
    !req.path.startsWith("/api/")
  ) {
    return res.sendFile(
      path.join(
        __dirname,
        "index.html"
      )
    );
  }

  next();
});

/*
|--------------------------------------------------------------------------
| 404
|--------------------------------------------------------------------------
*/

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Not found"
  });
});

/*
|--------------------------------------------------------------------------
| ERROR HANDLER
|--------------------------------------------------------------------------
*/

app.use(
  (error, req, res, next) => {
    console.error(error);

    res.status(500).json({
      success: false,
      error:
        error.message ||
        "Internal server error"
    });
  }
);

/*
|--------------------------------------------------------------------------
| START
|--------------------------------------------------------------------------
*/

async function start() {
  await initializeDatabase();

  app.listen(
    PORT,
    HOST,
    () => {
      console.log(
        `SwarAJ running on ${HOST}:${PORT}`
      );

      console.log(
        `Database mode: ${
          dbReady
            ? "connected"
            : "filesystem"
        }`
      );

      console.log(
        `Songs directory: ${SONGS_DIR}`
      );
    }
  );
}

/*
|--------------------------------------------------------------------------
| SHUTDOWN
|--------------------------------------------------------------------------
*/

async function shutdown() {
  console.log(
    "Shutting down SwarAJ..."
  );

  if (pool) {
    await pool
      .end()
      .catch(() => {});
  }

  process.exit(0);
}

process.on(
  "SIGTERM",
  shutdown
);

process.on(
  "SIGINT",
  shutdown
);

start().catch(error => {
  console.error(
    "Unable to start SwarAJ:",
    error
  );

  process.exit(1);
});