const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const ROOT = __dirname;
const SONGS_DIR = path.join(ROOT, "songs");
const UPLOADS_DIR = path.join(ROOT, "uploads");

fs.mkdirSync(SONGS_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    })
  : null;

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

function clean(value, fallback = "") {
  if (value === undefined || value === null) {
    return fallback;
  }

  const rawValue = String(value).trim();

  return rawValue || fallback;
}

function youtubeIdFromUrl(rawUrl) {
  const input = clean(rawUrl);

  if (!input) return null;

  let url;

  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const host = url.hostname
    .toLowerCase()
    .replace(/^www\./, "");

  if (host === "youtu.be") {
    const videoId = url.pathname.slice(1);

    return /^[A-Za-z0-9_-]{11}$/.test(videoId)
      ? videoId
      : null;
  }

  if (
    host === "youtube.com" ||
    host === "m.youtube.com"
  ) {
    if (url.pathname === "/watch") {
      const videoId = url.searchParams.get("v");

      return /^[A-Za-z0-9_-]{11}$/.test(videoId || "")
        ? videoId
        : null;
    }

    const match = url.pathname.match(
      /^\/(shorts|embed|live)\/([A-Za-z0-9_-]{11})/
    );

    return match ? match[2] : null;
  }

  return null;
}

function normalizeSong(row) {
  const isYouTube =
    String(row.source_type || "").toLowerCase() === "youtube" ||
    Boolean(row.youtube_id);

  return {
    id: row.id,

    title: clean(row.title, "Untitled"),

    artist: clean(row.artist, "SwarAJ"),

    album: clean(row.album, "SwarAJ"),

    category: clean(row.category, "All Songs"),

    language: clean(row.language, "Marathi"),

    source_type: isYouTube
      ? "youtube"
      : "mp3",

    audio_url: isYouTube
      ? null
      : row.audio_url || (
          row.file_path
            ? `/songs/${encodeURI(
                String(row.file_path)
                  .replace(/^songs[\\/]/, "")
                  .replaceAll("\\", "/")
              )}`
            : null
        ),

    file_path: isYouTube
      ? null
      : row.file_path || null,

    youtube_url: isYouTube
      ? row.youtube_url || (
          row.youtube_id
            ? `https://www.youtube.com/watch?v=${row.youtube_id}`
            : null
        )
      : null,

    youtube_id: isYouTube
      ? row.youtube_id || null
      : null,

    cover_url: row.cover_url || null,

    duration: Number(row.duration || 0),

    is_active:
      row.is_active === undefined
        ? true
        : Boolean(row.is_active),

    created_at: row.created_at || null
  };
}

/* -------------------------------------------------------
   DATABASE MIGRATION
------------------------------------------------------- */

async function ensureDatabase() {
  if (!pool) {
    console.log(
      "DATABASE_URL not configured. Running without PostgreSQL."
    );
    return;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS songs (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT DEFAULT 'SwarAJ',
        album TEXT DEFAULT 'SwarAJ',
        category TEXT DEFAULT 'All Songs',
        language TEXT DEFAULT 'Marathi',
        file_path TEXT NULL,
        audio_url TEXT NULL,
        youtube_url TEXT NULL,
        youtube_id TEXT NULL,
        source_type TEXT NOT NULL DEFAULT 'mp3',
        cover_url TEXT NULL,
        duration INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const columns = [
      ["artist", "TEXT"],
      ["album", "TEXT"],
      ["category", "TEXT"],
      ["language", "TEXT"],
      ["file_path", "TEXT"],
      ["audio_url", "TEXT"],
      ["youtube_url", "TEXT"],
      ["youtube_id", "TEXT"],
      ["source_type", "TEXT"],
      ["cover_url", "TEXT"],
      ["duration", "INTEGER"],
      ["is_active", "BOOLEAN"],
      ["created_at", "TIMESTAMP"],
      ["updated_at", "TIMESTAMP"]
    ];

    for (const [columnName, columnType] of columns) {
      const check = await client.query(
        `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'songs'
          AND column_name = $1
        `,
        [columnName]
      );

      if (check.rowCount === 0) {
        await client.query(
          `ALTER TABLE songs ADD COLUMN "${columnName}" ${columnType}`
        );
      }
    }

    await client.query(`
      ALTER TABLE songs
      ALTER COLUMN file_path DROP NOT NULL
    `);

    await client.query(`
      ALTER TABLE songs
      ALTER COLUMN audio_url DROP NOT NULL
    `);

    await client.query(`
      UPDATE songs
      SET source_type =
        CASE
          WHEN youtube_id IS NOT NULL
            OR youtube_url IS NOT NULL
          THEN 'youtube'
          ELSE 'mp3'
        END
      WHERE source_type IS NULL
         OR TRIM(source_type) = ''
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_source_type
      ON songs(source_type)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_category
      ON songs(category)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_youtube_id
      ON songs(youtube_id)
    `);

    await client.query("COMMIT");

    console.log("PostgreSQL migration completed.");
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "DATABASE MIGRATION ERROR:",
      error
    );

    throw error;
  } finally {
    client.release();
  }
}

/* -------------------------------------------------------
   MP3 SCANNER
------------------------------------------------------- */

const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".m4a",
  ".ogg"
]);

function scanSongsDirectory() {
  const songs = [];

  function walk(directory, category) {
    if (!fs.existsSync(directory)) {
      return;
    }

    const entries = fs.readdirSync(
      directory,
      { withFileTypes: true }
    );

    for (const entry of entries) {
      const absolutePath =
        path.join(directory, entry.name);

      if (entry.isDirectory()) {
        walk(absolutePath, category);
        continue;
      }

      const extension =
        path.extname(entry.name).toLowerCase();

      if (!AUDIO_EXTENSIONS.has(extension)) {
        continue;
      }

      const relativePath =
        path.relative(
          SONGS_DIR,
          absolutePath
        ).replaceAll("\\", "/");

      const parsedName =
        path.basename(
          entry.name,
          extension
        );

      songs.push({
        id: `local-${relativePath}`,

        title: parsedName,

        artist: "SwarAJ",

        album: category,

        category,

        language: "Marathi",

        source_type: "mp3",

        audio_url:
          `/songs/${relativePath
            .split("/")
            .map(encodeURIComponent)
            .join("/")}`,

        file_path: relativePath,

        youtube_url: null,

        youtube_id: null,

        cover_url: null,

        duration: 0,

        is_active: true
      });
    }
  }

  const categoryFolders =
    fs.readdirSync(
      SONGS_DIR,
      { withFileTypes: true }
    );

  for (const folder of categoryFolders) {
    if (folder.isDirectory()) {
      walk(
        path.join(
          SONGS_DIR,
          folder.name
        ),
        folder.name
      );
    }
  }

  return songs;
}

/* -------------------------------------------------------
   DATABASE SONGS
------------------------------------------------------- */

async function getDatabaseSongs() {
  if (!pool) {
    return [];
  }

  const result = await pool.query(`
    SELECT *
    FROM songs
    WHERE COALESCE(is_active, TRUE) = TRUE
    ORDER BY
      created_at DESC NULLS LAST,
      id DESC
  `);

  return result.rows.map(normalizeSong);
}

async function getAllSongs() {
  const localSongs =
    scanSongsDirectory();

  const databaseSongs =
    await getDatabaseSongs();

  return [
    ...databaseSongs,
    ...localSongs
  ];
}

/* -------------------------------------------------------
   STATIC FILES
------------------------------------------------------- */

app.use(
  "/songs",
  express.static(SONGS_DIR)
);

app.use(
  "/uploads",
  express.static(UPLOADS_DIR)
);

app.use(
  "/images",
  express.static(
    path.join(ROOT, "images")
  )
);

app.use(
  express.static(ROOT)
);

/* -------------------------------------------------------
   HEALTH
------------------------------------------------------- */

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
    success: true,
    service: "SwarAJ",
    database,
    time: new Date().toISOString()
  });
});

/* -------------------------------------------------------
   ALL SONGS
------------------------------------------------------- */

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
    console.error(
      "GET SONGS ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      count: 0,
      songs: [],
      error: error.message
    });
  }
});

/* -------------------------------------------------------
   YOUTUBE SONGS
------------------------------------------------------- */

app.get("/api/youtube", async (req, res) => {
  try {
    const songs =
      (await getAllSongs()).filter(
        song =>
          song.source_type === "youtube"
      );

    res.json({
      success: true,
      count: songs.length,
      songs
    });
  } catch (error) {
    console.error(
      "GET YOUTUBE ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      count: 0,
      songs: [],
      error: error.message
    });
  }
});

/* -------------------------------------------------------
   CATEGORIES
------------------------------------------------------- */

app.get(
  "/api/categories",
  async (req, res) => {
    try {
      const songs =
        await getAllSongs();

      const categories =
        [
          ...new Set(
            songs
              .map(song => song.category)
              .filter(Boolean)
          )
        ];

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

/* -------------------------------------------------------
   ADMIN UPLOAD
------------------------------------------------------- */

const storage =
  multer.diskStorage({
    destination: (
      req,
      file,
      callback
    ) => {
      callback(
        null,
        UPLOADS_DIR
      );
    },

    filename: (
      req,
      file,
      callback
    ) => {
      const extension =
        path.extname(
          file.originalname
        ).toLowerCase();

      const safeName =
        path
          .basename(
            file.originalname,
            extension
          )
          .replace(
            /[^a-zA-Z0-9_-]/g,
            "_"
          );

      callback(
        null,
        `${Date.now()}-${safeName}${extension}`
      );
    }
  });

const upload =
  multer({
    storage,

    limits: {
      fileSize:
        100 * 1024 * 1024
    },

    fileFilter: (
      req,
      file,
      callback
    ) => {
      const extension =
        path
          .extname(
            file.originalname
          )
          .toLowerCase();

      if (
        file.fieldname === "audio" &&
        !AUDIO_EXTENSIONS.has(
          extension
        )
      ) {
        return callback(
          new Error(
            "Unsupported audio format."
          )
        );
      }

      callback(null, true);
    }
  });

/*
  Replace this middleware with your existing
  admin authentication middleware if your
  current project already has one.
*/

function authAdmin(req, res, next) {
  if (
    process.env.ADMIN_SECRET &&
    req.headers["x-admin-secret"] !==
      process.env.ADMIN_SECRET
  ) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized"
    });
  }

  next();
}

/* -------------------------------------------------------
   ADD MP3 / YOUTUBE
------------------------------------------------------- */

app.post(
  "/api/admin/songs",
  authAdmin,
  upload.fields([
    {
      name: "audio",
      maxCount: 1
    },
    {
      name: "cover",
      maxCount: 1
    }
  ]),
  async (req, res) => {
    const files =
      req.files || {};

    const audioFile =
      files.audio?.[0] || null;

    const coverFile =
      files.cover?.[0] || null;

    try {
      if (!pool) {
        throw new Error(
          "DATABASE_URL is not configured."
        );
      }

      const sourceType =
        clean(
          req.body.source_type ||
          "mp3"
        ).toLowerCase();

      const title =
        clean(
          req.body.title,
          "Untitled"
        );

      const artist =
        clean(
          req.body.artist,
          "SwarAJ"
        );

      const album =
        clean(
          req.body.album,
          "SwarAJ"
        );

      const category =
        clean(
          req.body.category,
          "All Songs"
        );

      const language =
        clean(
          req.body.language,
          "Marathi"
        );

      let filePath = null;
      let audioUrl = null;
      let youtubeUrl = null;
      let youtubeId = null;

      /* YOUTUBE */

      if (
        sourceType === "youtube"
      ) {
        youtubeUrl =
          clean(
            req.body.youtube_url
          );

        youtubeId =
          youtubeIdFromUrl(
            youtubeUrl
          );

        if (!youtubeId) {
          throw new Error(
            "Enter a valid YouTube URL."
          );
        }
      }

      /* MP3 */

      else if (
        sourceType === "mp3"
      ) {
        if (!audioFile) {
          throw new Error(
            "Audio file is required."
          );
        }

        const extension =
          path
            .extname(
              audioFile.originalname
            )
            .toLowerCase();

        if (
          !AUDIO_EXTENSIONS.has(
            extension
          )
        ) {
          throw new Error(
            "Unsupported audio file."
          );
        }

        filePath =
          path
            .join(
              "uploads",
              audioFile.filename
            )
            .replaceAll("\\", "/");

        audioUrl =
          `/${filePath}`;
      }

      else {
        throw new Error(
          "source_type must be mp3 or youtube."
        );
      }

      let coverUrl =
        clean(
          req.body.cover_url
        ) || null;

      if (coverFile) {
        coverUrl =
          `/uploads/${encodeURIComponent(
            coverFile.filename
          )}`;
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
            file_path,
            audio_url,
            youtube_url,
            youtube_id,
            source_type,
            cover_url,
            duration,
            is_active,
            created_at,
            updated_at
          )
          VALUES (
            $1,$2,$3,$4,$5,
            $6,$7,$8,$9,$10,
            $11,$12,TRUE,NOW(),NOW()
          )
          RETURNING *
          `,
          [
            title,
            artist,
            album,
            category,
            language,
            filePath,
            audioUrl,
            youtubeUrl,
            youtubeId,
            sourceType,
            coverUrl,
            0
          ]
        );

      res.status(201).json({
        success: true,
        song: normalizeSong(
          result.rows[0]
        )
      });
    } catch (error) {
      console.error(
        "ADD SONG ERROR:",
        error
      );

      if (audioFile?.path) {
        try {
          fs.unlinkSync(
            audioFile.path
          );
        } catch {}
      }

      if (coverFile?.path) {
        try {
          fs.unlinkSync(
            coverFile.path
          );
        } catch {}
      }

      res.status(400).json({
        success: false,
        error:
          error.message ||
          "Failed to add song"
      });
    }
  }
);

/* -------------------------------------------------------
   DELETE SONG
------------------------------------------------------- */

app.delete(
  "/api/admin/songs/:id",
  authAdmin,
  async (req, res) => {
    try {
      if (!pool) {
        throw new Error(
          "DATABASE_URL is not configured."
        );
      }

      const id =
        Number(req.params.id);

      if (!Number.isInteger(id)) {
        throw new Error(
          "Invalid song ID."
        );
      }

      const result =
        await pool.query(
          `
          DELETE FROM songs
          WHERE id = $1
          RETURNING *
          `,
          [id]
        );

      if (!result.rowCount) {
        return res.status(404).json({
          success: false,
          error: "Song not found."
        });
      }

      res.json({
        success: true,
        song: normalizeSong(
          result.rows[0]
        )
      });
    } catch (error) {
      console.error(
        "DELETE SONG ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/* -------------------------------------------------------
   ADMIN DB CHECK
------------------------------------------------------- */

app.get(
  "/api/admin/db-check",
  authAdmin,
  async (req, res) => {
    try {
      if (!pool) {
        throw new Error(
          "DATABASE_URL is not configured."
        );
      }

      const result =
        await pool.query(`
          SELECT
            id,
            title,
            artist,
            category,
            source_type,
            youtube_url,
            youtube_id,
            file_path,
            audio_url,
            cover_url,
            is_active,
            created_at
          FROM songs
          ORDER BY id DESC
        `);

      res.json({
        success: true,
        count: result.rowCount,
        songs:
          result.rows.map(
            normalizeSong
          )
      });
    } catch (error) {
      console.error(
        "DB CHECK ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/* -------------------------------------------------------
   START
------------------------------------------------------- */

async function start() {
  try {
    await ensureDatabase();

    app.listen(
      PORT,
      HOST,
      () => {
        console.log(
          `SwarAJ running on ${HOST}:${PORT}`
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

start();