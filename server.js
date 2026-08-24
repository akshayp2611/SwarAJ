const express = require("express");
const path = require("path");
const multer = require("multer");
const { Pool } = require("pg");

const app = express();
const PORT = Number(process.env.PORT) || 10000;

const ADMIN_KEY = process.env.ADMIN_KEY || "swaraj-admin";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL
        ? { rejectUnauthorized: false }
        : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

/* =========================================================
   MULTER
========================================================= */

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowed = [
            "audio/mpeg",
            "audio/mp3",
            "audio/wav",
            "audio/x-wav",
            "audio/ogg",
            "audio/mp4",
            "audio/aac",
            "audio/x-m4a"
        ];

        const ext = path.extname(file.originalname).toLowerCase();

        if (
            allowed.includes(file.mimetype) ||
            [".mp3", ".wav", ".ogg", ".m4a", ".aac"].includes(ext)
        ) {
            cb(null, true);
        } else {
            cb(new Error("Only audio files are allowed."));
        }
    }
});

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({
    extended: true,
    limit: "10mb"
}));

/* =========================================================
   DATABASE
========================================================= */

async function initializeDatabase() {
    console.log("Initializing PostgreSQL database...");

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        await client.query(`
            CREATE TABLE IF NOT EXISTS songs (
                id BIGSERIAL PRIMARY KEY,
                title VARCHAR(255),
                artist VARCHAR(255) DEFAULT 'SwarAJ',
                album VARCHAR(255) DEFAULT 'Singles',
                category VARCHAR(100) DEFAULT 'Other',
                cover_url TEXT,
                source_type VARCHAR(30) DEFAULT 'mp3_url',
                audio_url TEXT,
                youtube_url TEXT,
                youtube_video_id VARCHAR(50),
                file_data BYTEA,
                file_name TEXT,
                mime_type VARCHAR(100),
                file_size BIGINT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        const migrations = [
            ["title", "VARCHAR(255)"],
            ["artist", "VARCHAR(255) DEFAULT 'SwarAJ'"],
            ["album", "VARCHAR(255) DEFAULT 'Singles'"],
            ["category", "VARCHAR(100) DEFAULT 'Other'"],
            ["cover_url", "TEXT"],
            ["source_type", "VARCHAR(30) DEFAULT 'mp3_url'"],
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

        for (const [column, type] of migrations) {
            await client.query(`
                ALTER TABLE songs
                ADD COLUMN IF NOT EXISTS ${column} ${type}
            `);
        }

        await client.query(`
            UPDATE songs
            SET artist = 'SwarAJ'
            WHERE artist IS NULL
        `);

        await client.query(`
            UPDATE songs
            SET album = 'Singles'
            WHERE album IS NULL
        `);

        await client.query(`
            UPDATE songs
            SET category = 'Other'
            WHERE category IS NULL
        `);

        await client.query(`
            UPDATE songs
            SET source_type = 'mp3_url'
            WHERE source_type IS NULL
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

        await client.query("COMMIT");

        const count = await client.query(`
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (
                    WHERE source_type = 'youtube'
                )::int AS youtube,
                COUNT(*) FILTER (
                    WHERE source_type IN (
                        'mp3',
                        'mp3_file',
                        'mp3_url'
                    )
                )::int AS mp3
            FROM songs
        `);

        console.log(
            `Songs in database: ${count.rows[0].total}`
        );

        console.log(
            `YouTube songs: ${count.rows[0].youtube}`
        );

        console.log(
            `MP3 songs: ${count.rows[0].mp3}`
        );

        console.log(
            "PostgreSQL database initialized successfully."
        );

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

/* =========================================================
   HELPERS
========================================================= */

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

function getYouTubeVideoId(value) {
    if (!value) return null;

    const text = String(value).trim();

    if (/^[a-zA-Z0-9_-]{11}$/.test(text)) {
        return text;
    }

    try {
        const url = new URL(text);

        if (
            url.hostname === "youtu.be" ||
            url.hostname.endsWith("youtube.com")
        ) {
            if (url.hostname === "youtu.be") {
                return url.pathname
                    .split("/")
                    .filter(Boolean)[0] || null;
            }

            const v = url.searchParams.get("v");

            if (v) {
                return v;
            }

            const parts = url.pathname
                .split("/")
                .filter(Boolean);

            const index = parts.findIndex(
                p =>
                    p === "embed" ||
                    p === "shorts" ||
                    p === "live"
            );

            if (index !== -1 && parts[index + 1]) {
                return parts[index + 1];
            }
        }
    } catch (_) {
        return null;
    }

    return null;
}

function normalizeSong(row) {
    let audioUrl = row.audio_url;

    if (
        row.source_type === "mp3_file" &&
        row.id
    ) {
        audioUrl = `/api/songs/${row.id}/audio`;
    }

    return {
        id: row.id,
        title: row.title || "Untitled",
        artist: row.artist || "SwarAJ",
        album: row.album || "Singles",
        category: row.category || "Other",
        cover_url: row.cover_url || "/images/ganpati.jpg",
        source_type: row.source_type,
        audio_url: audioUrl,
        youtube_url: row.youtube_url,
        youtube_video_id: row.youtube_video_id,
        file_name: row.file_name,
        file_size: row.file_size,
        created_at: row.created_at,
        updated_at: row.updated_at
    };
}

async function getSongs(where = "", params = []) {
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
        ${where}
        ORDER BY created_at DESC
    `, params);

    return result.rows.map(normalizeSong);
}

/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        res.json({
            success: true,
            ok: true,
            status: "healthy",
            database: "connected",
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            ok: false,
            status: "unhealthy",
            database: "disconnected",
            error: error.message
        });
    }
});

/* =========================================================
   SONGS
========================================================= */

app.get("/api/songs", async (req, res) => {
    try {
        const songs = await getSongs();

        res.json({
            success: true,
            songs
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            error: error.message,
            songs: []
        });
    }
});

/* =========================================================
   SEARCH
========================================================= */

app.get("/api/search", async (req, res) => {
    try {
        const q = String(req.query.q || "").trim();

        if (!q) {
            return res.json({
                success: true,
                songs: await getSongs()
            });
        }

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
            WHERE
                title ILIKE $1
                OR artist ILIKE $1
                OR album ILIKE $1
                OR category ILIKE $1
            ORDER BY created_at DESC
        `, [`%${q}%`]);

        res.json({
            success: true,
            songs: result.rows.map(normalizeSong)
        });

    } catch (error) {
        console.error("Search error:", error);

        res.status(500).json({
            success: false,
            error: error.message,
            songs: []
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
                category,
                COUNT(*)::INTEGER AS count
            FROM songs
            GROUP BY category
            ORDER BY category
        `);

        res.json({
            success: true,

            // Keep both names for compatibility
            categories: result.rows.map(row => ({
                name: row.category,
                category: row.category,
                count: row.count
            }))
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            categories: []
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
            const category =
                decodeURIComponent(
                    req.params.category
                );

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
                WHERE LOWER(category) = LOWER($1)
                ORDER BY created_at DESC
            `, [category]);

            res.json({
                success: true,
                category,
                songs: result.rows.map(
                    normalizeSong
                )
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                success: false,
                error: error.message,
                songs: []
            });
        }
    }
);

/* =========================================================
   STORED MP3 FILE
========================================================= */

app.get(
    "/api/songs/:id/audio",
    async (req, res) => {
        try {
            const id = Number(req.params.id);

            if (!Number.isInteger(id)) {
                return res.status(400).send(
                    "Invalid song ID"
                );
            }

            const result = await pool.query(`
                SELECT
                    file_data,
                    file_name,
                    mime_type,
                    file_size
                FROM songs
                WHERE id = $1
                  AND source_type = 'mp3_file'
                  AND file_data IS NOT NULL
            `, [id]);

            if (!result.rows.length) {
                return res.status(404).send(
                    "Audio file not found"
                );
            }

            const song = result.rows[0];

            res.setHeader(
                "Content-Type",
                song.mime_type || "audio/mpeg"
            );

            if (song.file_size) {
                res.setHeader(
                    "Content-Length",
                    song.file_size
                );
            }

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
                "Audio error:",
                error
            );

            res.status(500).send(
                "Unable to load audio"
            );
        }
    }
);

/* =========================================================
   ADMIN LOGIN
========================================================= */

app.post("/api/admin/login", (req, res) => {
    const key =
        req.body?.adminKey ||
        req.headers["x-admin-key"];

    if (!key || key !== ADMIN_KEY) {
        return res.status(401).json({
            success: false,
            error: "Invalid admin key"
        });
    }

    res.json({
        success: true,
        message: "Admin login successful"
    });
});

/* =========================================================
   ADMIN SONG LIST
========================================================= */

app.get(
    "/api/admin/songs",
    requireAdmin,
    async (req, res) => {
        try {
            const songs = await getSongs();

            res.json({
                success: true,
                songs
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/* =========================================================
   ADMIN UPLOAD MP3 FILE
========================================================= */

app.post(
    "/api/admin/songs/upload",
    requireAdmin,
    upload.single("file"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: "MP3 file is required"
                });
            }

            const {
                title,
                artist,
                album,
                category,
                coverUrl
            } = req.body;

            if (!title?.trim()) {
                return res.status(400).json({
                    success: false,
                    error: "Title is required"
                });
            }

            const result = await pool.query(`
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
                    'mp3_file',
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
            `, [
                title.trim(),
                artist?.trim() || "SwarAJ",
                album?.trim() || "Singles",
                category?.trim() || "Other",
                coverUrl?.trim() || null,
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype || "audio/mpeg",
                req.file.size
            ]);

            res.json({
                success: true,
                message: "MP3 uploaded successfully",
                song: normalizeSong(
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

/* =========================================================
   ADMIN ADD MP3 URL
========================================================= */

app.post(
    "/api/admin/songs/mp3-url",
    requireAdmin,
    async (req, res) => {
        try {
            const {
                title,
                artist,
                album,
                category,
                audioUrl,
                coverUrl
            } = req.body;

            if (!title?.trim()) {
                return res.status(400).json({
                    success: false,
                    error: "Title is required"
                });
            }

            if (!audioUrl?.trim()) {
                return res.status(400).json({
                    success: false,
                    error: "MP3 URL is required"
                });
            }

            try {
                new URL(audioUrl);
            } catch {
                return res.status(400).json({
                    success: false,
                    error: "Invalid audio URL"
                });
            }

            const result = await pool.query(`
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
                RETURNING *
            `, [
                title.trim(),
                artist?.trim() || "SwarAJ",
                album?.trim() || "Singles",
                category?.trim() || "Other",
                coverUrl?.trim() || null,
                audioUrl.trim()
            ]);

            res.json({
                success: true,
                message: "MP3 URL added successfully",
                song: normalizeSong(
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

/* =========================================================
   ADMIN ADD YOUTUBE
========================================================= */

app.post(
    "/api/admin/songs/youtube",
    requireAdmin,
    async (req, res) => {
        try {
            const {
                title,
                artist,
                album,
                category,
                youtubeUrl,
                coverUrl
            } = req.body;

            if (!title?.trim()) {
                return res.status(400).json({
                    success: false,
                    error: "Title is required"
                });
            }

            if (!youtubeUrl?.trim()) {
                return res.status(400).json({
                    success: false,
                    error: "YouTube URL is required"
                });
            }

            const videoId =
                getYouTubeVideoId(
                    youtubeUrl
                );

            if (!videoId) {
                return res.status(400).json({
                    success: false,
                    error: "Invalid YouTube URL"
                });
            }

            const result = await pool.query(`
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
                RETURNING *
            `, [
                title.trim(),
                artist?.trim() || "SwarAJ",
                album?.trim() || "Singles",
                category?.trim() || "Other",
                coverUrl?.trim() ||
                    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                youtubeUrl.trim(),
                videoId
            ]);

            res.json({
                success: true,
                message: "YouTube song added successfully",
                song: normalizeSong(
                    result.rows[0]
                )
            });

        } catch (error) {
            console.error(
                "YouTube insert error:",
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
            const id = Number(
                req.params.id
            );

            if (!Number.isInteger(id)) {
                return res.status(400).json({
                    success: false,
                    error: "Invalid song ID"
                });
            }

            const result = await pool.query(`
                DELETE FROM songs
                WHERE id = $1
                RETURNING id, title
            `, [id]);

            if (!result.rows.length) {
                return res.status(404).json({
                    success: false,
                    error: "Song not found"
                });
            }

            res.json({
                success: true,
                message: "Song deleted successfully",
                song: result.rows[0]
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
   STATIC FILES
========================================================= */

const publicDir = __dirname;

app.use(express.static(publicDir));

/*
   Express 5 compatible SPA fallback.
   NEVER use app.get("*", ...)
*/

app.use((req, res, next) => {
    if (
        req.method === "GET" &&
        !req.path.startsWith("/api/")
    ) {
        return res.sendFile(
            path.join(
                publicDir,
                "index.html"
            )
        );
    }

    next();
});

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use((error, req, res, next) => {
    console.error(error);

    if (error instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }

    res.status(500).json({
        success: false,
        error: error.message ||
            "Internal server error"
    });
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: "Not found"
    });
});

/* =========================================================
   START
========================================================= */

async function startServer() {
    try {
        console.log("====================================");
        console.log("        SwarAJ Music Server");
        console.log("====================================");

        if (!process.env.DATABASE_URL) {
            throw new Error(
                "DATABASE_URL is not configured"
            );
        }

        await initializeDatabase();

        app.listen(
            PORT,
            "0.0.0.0",
            () => {
                console.log("------------------------------------");
                console.log(
                    `Server: http://0.0.0.0:${PORT}`
                );
                console.log(
                    `Admin: ${
                        process.env.ADMIN_KEY
                            ? "configured"
                            : "DEFAULT - CHANGE IT"
                    }`
                );
                console.log(
                    "SwarAJ server started successfully"
                );
                console.log("====================================");
            }
        );

    } catch (error) {
        console.error(
            "Unable to start server:"
        );
        console.error(error);
        process.exitCode = 1;
    }
}

process.on(
    "uncaughtException",
    error => {
        console.error(
            "UNCAUGHT EXCEPTION:",
            error
        );
    }
);

process.on(
    "unhandledRejection",
    reason => {
        console.error(
            "UNHANDLED REJECTION:",
            reason
        );
    }
);

startServer();