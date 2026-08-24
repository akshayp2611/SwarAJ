const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const mm = require("music-metadata");

const { query, pool } = require("./database");

const app = express();

const PORT =
  Number(process.env.PORT) || 3000;

const ROOT = __dirname;

const STORAGE_ROOT =
  process.env.STORAGE_ROOT ||
  path.join(ROOT, "data");

const MUSIC_DIR =
  path.join(
    STORAGE_ROOT,
    "music"
  );

const COVERS_DIR =
  path.join(
    STORAGE_ROOT,
    "covers"
  );

const AUDIO_EXTENSIONS =
  new Set([
    ".mp3",
    ".wav",
    ".ogg",
    ".m4a",
    ".aac",
    ".flac",
    ".webm"
  ]);

for (const dir of [
  STORAGE_ROOT,
  MUSIC_DIR,
  COVERS_DIR
]) {
  fs.mkdirSync(dir, {
    recursive: true
  });
}

app.disable(
  "x-powered-by"
);

app.use(
  express.json({
    limit: "2mb"
  })
);

app.use(
  express.urlencoded({
    extended: true
  })
);

function cleanName(value) {
  return String(value || "")
    .replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .slice(0, 250);
}

function storageRelative(file) {
  return path
    .relative(
      STORAGE_ROOT,
      file
    )
    .split(path.sep)
    .join("/");
}

function mediaUrl(relative) {
  return (
    "/media/" +
    relative
      .split("/")
      .map(
        encodeURIComponent
      )
      .join("/")
  );
}

function mime(file) {
  const ext =
    path.extname(
      file
    ).toLowerCase();

  return {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".flac": "audio/flac",
    ".webm": "audio/webm"
  }[ext] ||
    "application/octet-stream";
}

/* =========================
   DATABASE INITIALIZATION
========================= */

async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS categories (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(150) UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS songs (
      id BIGSERIAL PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      artist VARCHAR(300) DEFAULT 'SwarAJ',
      album VARCHAR(300),
      category_id BIGINT
        REFERENCES categories(id)
        ON DELETE SET NULL,
      filename VARCHAR(1000) NOT NULL,
      storage_path VARCHAR(2000)
        UNIQUE NOT NULL,
      mime_type VARCHAR(150)
        DEFAULT 'audio/mpeg',
      file_size BIGINT DEFAULT 0,
      duration DOUBLE PRECISION DEFAULT 0,
      cover_path VARCHAR(2000),
      play_count BIGINT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS
      idx_songs_title
    ON songs(title);

    CREATE INDEX IF NOT EXISTS
      idx_songs_artist
    ON songs(artist);

    CREATE INDEX IF NOT EXISTS
      idx_songs_category
    ON songs(category_id);

    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(100)
        UNIQUE NOT NULL,
      email VARCHAR(255)
        UNIQUE,
      password_hash TEXT,
      created_at TIMESTAMPTZ
        DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT
        REFERENCES users(id)
        ON DELETE CASCADE,
      name VARCHAR(200)
        NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ
        DEFAULT NOW(),
      updated_at TIMESTAMPTZ
        DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS playlist_songs (
      playlist_id BIGINT
        REFERENCES playlists(id)
        ON DELETE CASCADE,
      song_id BIGINT
        REFERENCES songs(id)
        ON DELETE CASCADE,
      position INTEGER DEFAULT 0,
      added_at TIMESTAMPTZ
        DEFAULT NOW(),
      PRIMARY KEY (
        playlist_id,
        song_id
      )
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id BIGINT
        REFERENCES users(id)
        ON DELETE CASCADE,
      song_id BIGINT
        REFERENCES songs(id)
        ON DELETE CASCADE,
      created_at TIMESTAMPTZ
        DEFAULT NOW(),
      PRIMARY KEY (
        user_id,
        song_id
      )
    );

    CREATE TABLE IF NOT EXISTS play_history (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT
        REFERENCES users(id)
        ON DELETE CASCADE,
      song_id BIGINT
        REFERENCES songs(id)
        ON DELETE CASCADE,
      played_at TIMESTAMPTZ
        DEFAULT NOW()
    );
  `);
}

/* =========================
   CATEGORY
========================= */

async function getCategoryId(name) {
  const category =
    cleanName(
      name ||
      "Uncategorized"
    );

  const result =
    await query(
      `
      INSERT INTO categories(name)
      VALUES($1)
      ON CONFLICT(name)
      DO UPDATE SET name =
        EXCLUDED.name
      RETURNING id
      `,
      [category]
    );

  return result.rows[0].id;
}

/* =========================
   IMPORT SONG
========================= */

async function importSong(
  filePath,
  forcedCategory
) {
  const relative =
    storageRelative(
      filePath
    );

  const exists =
    await query(
      `
      SELECT id
      FROM songs
      WHERE storage_path = $1
      `,
      [relative]
    );

  if (
    exists.rows.length
  ) {
    return;
  }

  const stats =
    fs.statSync(
      filePath
    );

  let metadata = null;

  try {
    metadata =
      await mm.parseFile(
        filePath
      );
  } catch (_) {}

  const extension =
    path.extname(
      filePath
    );

  const title =
    cleanName(
      metadata?.common?.title ||
      path.basename(
        filePath,
        extension
      )
    ) ||
    "Untitled";

  const artist =
    cleanName(
      metadata?.common?.artist ||
      "SwarAJ"
    ) ||
    "SwarAJ";

  const album =
    cleanName(
      metadata?.common?.album ||
      ""
    ) || null;

  const category =
    forcedCategory ||
    relative.split("/")[1] ||
    "Uncategorized";

  const categoryId =
    await getCategoryId(
      category
    );

  await query(
    `
    INSERT INTO songs (
      title,
      artist,
      album,
      category_id,
      filename,
      storage_path,
      mime_type,
      file_size,
      duration
    )
    VALUES (
      $1,$2,$3,$4,$5,
      $6,$7,$8,$9
    )
    ON CONFLICT(storage_path)
    DO NOTHING
    `,
    [
      title,
      artist,
      album,
      categoryId,
      path.basename(
        filePath
      ),
      relative,
      metadata?.format?.mime ||
        mime(filePath),
      stats.size,
      Number(
        metadata?.format?.duration ||
        0
      )
    ]
  );
}

/* =========================
   SCAN MUSIC
========================= */

async function scan(
  directory,
  category = null
) {
  if (
    !fs.existsSync(
      directory
    )
  ) {
    return;
  }

  const entries =
    fs.readdirSync(
      directory,
      {
        withFileTypes: true
      }
    );

  for (
    const entry of entries
  ) {
    const full =
      path.join(
        directory,
        entry.name
      );

    if (
      entry.isDirectory()
    ) {
      await scan(
        full,
        category ||
          entry.name
      );
    } else {
      const ext =
        path.extname(
          entry.name
        ).toLowerCase();

      if (
        AUDIO_EXTENSIONS.has(
          ext
        )
      ) {
        await importSong(
          full,
          category
        );
      }
    }
  }
}

/* =========================
   HEALTH
========================= */

app.get(
  "/api/health",
  async (
    req,
    res
  ) => {
    try {
      const result =
        await query(
          `
          SELECT
            COUNT(*)::int AS count
          FROM songs
          `
        );

      res.json({
        status: "ok",
        database:
          "connected",
        songCount:
          result.rows[0].count,
        storage:
          STORAGE_ROOT
      });
    } catch (error) {
      res.status(500)
        .json({
          status: "error",
          database:
            "disconnected",
          error:
            error.message
        });
    }
  }
);

/* =========================
   SONGS
========================= */

app.get(
  "/api/songs",
  async (
    req,
    res
  ) => {
    try {
      const result =
        await query(
          `
          SELECT
            s.*,
            c.name AS category
          FROM songs s
          LEFT JOIN categories c
            ON c.id =
               s.category_id
          ORDER BY s.title
          `
        );

      res.json({
        success: true,
        count:
          result.rows.length,
        songs:
          result.rows.map(
            row => ({
              id: row.id,
              title: row.title,
              artist:
                row.artist ||
                "SwarAJ",
              album:
                row.album || "",
              category:
                row.category ||
                "Music",
              filename:
                row.filename,
              size:
                Number(
                  row.file_size ||
                  0
                ),
              duration:
                Number(
                  row.duration ||
                  0
                ),
              url:
                mediaUrl(
                  row.storage_path
                ),
              cover:
                row.cover_path
                  ? mediaUrl(
                      row.cover_path
                    )
                  : "/images/default-cover.svg",
              playCount:
                Number(
                  row.play_count ||
                  0
                )
            })
          )
      });
    } catch (error) {
      res.status(500)
        .json({
          success: false,
          songs: [],
          error:
            error.message
        });
    }
  }
);

/* =========================
   CATEGORIES
========================= */

app.get(
  "/api/categories",
  async (
    req,
    res
  ) => {
    try {
      const result =
        await query(
          `
          SELECT
            c.id,
            c.name,
            COUNT(s.id)::int AS count
          FROM categories c
          LEFT JOIN songs s
            ON s.category_id =
               c.id
          GROUP BY
            c.id,
            c.name
          ORDER BY
            c.name
          `
        );

      res.json({
        success: true,
        count:
          result.rows.length,
        categories:
          result.rows
      });
    } catch (error) {
      res.status(500)
        .json({
          success: false,
          categories: [],
          error:
            error.message
        });
    }
  }
);

/* =========================
   SEARCH
========================= */

app.get(
  "/api/search",
  async (
    req,
    res
  ) => {
    try {
      const q =
        `%${String(
          req.query.q || ""
        ).trim()}%`;

      const result =
        await query(
          `
          SELECT
            s.*,
            c.name AS category
          FROM songs s
          LEFT JOIN categories c
            ON c.id =
               s.category_id
          WHERE
            s.title ILIKE $1
            OR s.artist ILIKE $1
            OR COALESCE(
                s.album,''
              ) ILIKE $1
            OR COALESCE(
                c.name,''
              ) ILIKE $1
          ORDER BY
            s.title
          `,
          [q]
        );

      res.json({
        success: true,
        count:
          result.rows.length,
        songs:
          result.rows.map(
            row => ({
              id: row.id,
              title: row.title,
              artist:
                row.artist ||
                "SwarAJ",
              album:
                row.album || "",
              category:
                row.category ||
                "Music",
              url:
                mediaUrl(
                  row.storage_path
                ),
              cover:
                row.cover_path
                  ? mediaUrl(
                      row.cover_path
                    )
                  : "/images/default-cover.svg",
              duration:
                Number(
                  row.duration ||
                  0
                )
            })
          )
      });
    } catch (error) {
      res.status(500)
        .json({
          success: false,
          songs: [],
          error:
            error.message
        });
    }
  }
);

/* =========================
   PLAY COUNT
========================= */

app.post(
  "/api/songs/:id/play",
  async (
    req,
    res
  ) => {
    try {
      await query(
        `
        UPDATE songs
        SET
          play_count =
            play_count + 1,
          updated_at =
            NOW()
        WHERE id = $1
        `,
        [req.params.id]
      );

      res.json({
        success: true
      });
    } catch (error) {
      res.status(500)
        .json({
          success: false,
          error:
            error.message
        });
    }
  }
);

/* =========================
   UPLOAD
========================= */

const upload =
  multer({
    storage:
      multer.diskStorage({
        destination:
          (
            req,
            file,
            callback
          ) => {
            const category =
              cleanName(
                req.body.category ||
                "Uncategorized"
              );

            const directory =
              path.join(
                MUSIC_DIR,
                category
              );

            fs.mkdirSync(
              directory,
              {
                recursive: true
              }
            );

            callback(
              null,
              directory
            );
          },

        filename:
          (
            req,
            file,
            callback
          ) => {
            callback(
              null,
              cleanName(
                file.originalname
              )
            );
          }
      }),

    limits: {
      fileSize:
        500 * 1024 * 1024
    },

    fileFilter:
      (
        req,
        file,
        callback
      ) => {
        const ext =
          path.extname(
            file.originalname
          ).toLowerCase();

        callback(
          null,
          AUDIO_EXTENSIONS.has(
            ext
          )
        );
      }
  });

app.post(
  "/api/admin/upload",
  upload.single("song"),
  async (
    req,
    res
  ) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "No valid audio file"
          });
      }

      await importSong(
        req.file.path,
        req.body.category
      );

      res.json({
        success: true,
        message:
          "Song uploaded successfully",
        path:
          storageRelative(
            req.file.path
          )
      });
    } catch (error) {
      res.status(500)
        .json({
          success: false,
          error:
            error.message
        });
    }
  }
);

/* =========================
   PERSISTENT MEDIA
========================= */

app.get(
  "/media/*splat",
  (
    req,
    res
  ) => {
    try {
      let requested =
        req.params.splat;

      if (
        Array.isArray(
          requested
        )
      ) {
        requested =
          requested.join("/");
      }

      const decoded =
        String(
          requested || ""
        )
          .split("/")
          .map(
            part => {
              try {
                return decodeURIComponent(
                  part
                );
              } catch {
                return part;
              }
            }
          )
          .join("/");

      const root =
        path.resolve(
          STORAGE_ROOT
        );

      const file =
        path.resolve(
          STORAGE_ROOT,
          decoded
        );

      if (
        !file.startsWith(
          root + path.sep
        )
      ) {
        return res
          .status(403)
          .end();
      }

      if (
        !fs.existsSync(
          file
        )
      ) {
        return res
          .status(404)
          .end();
      }

      const stat =
        fs.statSync(
          file
        );

      if (
        !stat.isFile()
      ) {
        return res
          .status(404)
          .end();
      }

      res.setHeader(
        "Content-Type",
        mime(file)
      );

      res.setHeader(
        "Accept-Ranges",
        "bytes"
      );

      const range =
        req.headers.range;

      if (!range) {
        res.setHeader(
          "Content-Length",
          stat.size
        );

        return fs
          .createReadStream(
            file
          )
          .pipe(res);
      }

      const match =
        range.match(
          /bytes=(\d*)-(\d*)/
        );

      if (!match) {
        return res
          .status(416)
          .end();
      }

      const start =
        match[1]
          ? Number(
              match[1]
            )
          : 0;

      const end =
        match[2]
          ? Number(
              match[2]
            )
          : stat.size - 1;

      if (
        start >= stat.size ||
        end >= stat.size ||
        start > end
      ) {
        return res
          .status(416)
          .set(
            "Content-Range",
            `bytes */${stat.size}`
          )
          .end();
      }

      res.status(206);

      res.setHeader(
        "Content-Range",
        `bytes ${start}-${end}/${stat.size}`
      );

      res.setHeader(
        "Content-Length",
        end - start + 1
      );

      fs.createReadStream(
        file,
        {
          start,
          end
        }
      ).pipe(res);

    } catch (error) {
      console.error(error);

      res.status(500)
        .end();
    }
  }
);

/* =========================
   FRONTEND
========================= */

app.use(
  "/images",
  express.static(
    path.join(
      ROOT,
      "images"
    )
  )
);

app.use(
  express.static(
    ROOT,
    {
      index: false
    }
  )
);

/*
 * Express 5:
 * DO NOT use app.get("*", ...)
 *
 * This was the source of:
 * Missing parameter name at index 1: *
 */
app.get(
  /\/.*/,
  (
    req,
    res
  ) => {
    res.sendFile(
      path.join(
        ROOT,
        "index.html"
      )
    );
  }
);

/* =========================
   START
========================= */

async function start() {
  try {
    await initDb();

    await scan(
      MUSIC_DIR
    );

    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          "================================"
        );

        console.log(
          "        SwarAJ Music"
        );

        console.log(
          "================================"
        );

        console.log(
          `Port: ${PORT}`
        );

        console.log(
          `Storage: ${STORAGE_ROOT}`
        );

        console.log(
          "Database: PostgreSQL"
        );

        console.log(
          "================================"
        );
      }
    );
  } catch (error) {
    console.error(
      "STARTUP FAILED:",
      error
    );

    process.exit(1);
  }
}

process.on(
  "SIGTERM",
  async () => {
    await pool.end();
    process.exit(0);
  }
);

start();