const express = require("express");
const path = require("path");
const multer = require("multer");
const { Pool } = require("pg");

const app = express();

const PORT = Number(process.env.PORT) || 10000;
const HOST = "0.0.0.0";

const ADMIN_KEY = process.env.ADMIN_KEY;

if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing");
    process.exit(1);
}

if (!ADMIN_KEY) {
    console.warn(
        "WARNING: ADMIN_KEY is not configured in Render Environment."
    );
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

/* =========================================================
   MIDDLEWARE
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

/* =========================================================
   MULTER
========================================================= */

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 100 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {
        const ext = path
            .extname(file.originalname)
            .toLowerCase();

        const allowedExtensions = [
            ".mp3",
            ".wav",
            ".ogg",
            ".m4a",
            ".aac",
            ".mp4"
        ];

        const allowedMimeTypes = [
            "audio/mpeg",
            "audio/mp3",
            "audio/wav",
            "audio/x-wav",
            "audio/ogg",
            "audio/mp4",
            "audio/aac",
            "audio/x-m4a"
        ];

        if (
            allowedExtensions.includes(ext) ||
            allowedMimeTypes.includes(file.mimetype)
        ) {
            cb(null, true);
        } else {
            cb(
                new Error(
                    "Only MP3, WAV, OGG, M4A and AAC files are allowed."
                )
            );
        }
    }
});

/* =========================================================
   DATABASE
========================================================= */

async function initializeDatabase() {
    const client = await pool.connect();

    try {
        console.log("Initializing PostgreSQL database...");

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

        const columns = [
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

        for (const [name, type] of columns) {
            await client.query(`
                ALTER TABLE songs
                ADD COLUMN IF NOT EXISTS ${name} ${type}
            `);
        }

        await client.query(`
            UPDATE songs
            SET artist = 'SwarAJ'
            WHERE artist IS NULL OR artist = ''
        `);

        await client.query(`
            UPDATE songs
            SET album = 'Singles'
            WHERE album IS NULL OR album = ''
        `);

        await client.query(`
            UPDATE songs
            SET category = 'Other'
            WHERE category IS NULL OR category = ''
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

        await client.query("COMMIT");

        const count = await client.query(`
            SELECT
                COUNT(*)::INTEGER AS total,
                COUNT(*) FILTER (
                    WHERE source_type = 'youtube'
                )::INTEGER AS youtube,
                COUNT(*) FILTER (
                    WHERE source_type IN (
                        'mp3',
                        'mp3_file',
                        'mp3_url'
                    )
                )::INTEGER AS mp3
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

function normalizeSong(row) {
    let audioUrl = row.audio_url || null;

    if (
        row.source_type === "mp3_file" &&
        row.id
    ) {
        audioUrl =
            `/api/songs/${row.id}/audio`;
    }

    return {
        id: Number(row.id),

        title:
            row.title ||
            "Untitled",

        artist:
            row.artist ||
            "SwarAJ",

        album:
            row.album ||
            "Singles",

        category:
            row.category ||
            "Other",

        cover_url:
            row.cover_url ||
            "/images/ganpati.jpg",

        source_type:
            row.source_type ||
            "mp3_url",

        audio_url:
            audioUrl,

        youtube_url:
            row.youtube_url ||
            null,

        youtube_video_id:
            row.youtube_video_id ||
            null,

        file_name:
            row.file_name ||
            null,

        file_size:
            row.file_size
                ? Number(row.file_size)
                : null,

        created_at:
            row.created_at,

        updated_at:
            row.updated_at
    };
}

function getYouTubeVideoId(value) {
    if (!value) {
        return null;
    }

    const text = String(value).trim();

    if (
        /^[A-Za-z0-9_-]{11}$/.test(text)
    ) {
        return text;
    }

    try {
        const url = new URL(text);

        const hostname =
            url.hostname.toLowerCase();

        if (
            hostname === "youtu.be"
        ) {
            return (
                url.pathname
                    .split("/")
                    .filter(Boolean)[0] ||
                null
            );
        }

        if (
            hostname === "youtube.com" ||
            hostname === "www.youtube.com" ||
            hostname.endsWith(".youtube.com")
        ) {
            const v =
                url.searchParams.get("v");

            if (v) {
                return v;
            }

            const parts =
                url.pathname
                    .split("/")
                    .filter(Boolean);

            const index =
                parts.findIndex(part =>
                    [
                        "embed",
                        "shorts",
                        "live"
                    ].includes(part)
                );

            if (
                index >= 0 &&
                parts[index + 1]
            ) {
                return parts[index + 1];
            }
        }

    } catch {
        return null;
    }

    return null;
}

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

    if (
        !key ||
        key !== ADMIN_KEY
    ) {
        return res.status(401).json({
            success: false,
            error: "Invalid admin key"
        });
    }

    next();
}

async function getSongs(
    where = "",
    params = []
) {
    const result =
        await pool.query(
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
                created_at,
                updated_at
            FROM songs
            ${where}
            ORDER BY created_at DESC
            `,
            params
        );

    return result.rows.map(
        normalizeSong
    );
}

/* =========================================================
   HEALTH
========================================================= */

app.get(
    "/api/health",
    async (req, res) => {
        try {
            await pool.query(
                "SELECT 1"
            );

            const result =
                await pool.query(`
                    SELECT COUNT(*)::INTEGER AS count
                    FROM songs
                `);

            res.json({
                success: true,
                ok: true,
                status: "healthy",
                database: "connected",
                songs:
                    result.rows[0].count,
                timestamp:
                    new Date().toISOString()
            });

        } catch (error) {
            console.error(
                "Health error:",
                error
            );

            res.status(500).json({
                success: false,
                ok: false,
                status: "unhealthy",
                database: "disconnected",
                error: error.message
            });
        }
    }
);

/* =========================================================
   ALL SONGS
========================================================= */

app.get(
    "/api/songs",
    async (req, res) => {
        try {
            const songs =
                await getSongs();

            res.json({
                success: true,
                count: songs.length,
                songs
            });

        } catch (error) {
            console.error(
                "Songs error:",
                error
            );

            res.status(500).json({
                success: false,
                count: 0,
                songs: [],
                error: error.message
            });
        }
    }
);

/* =========================================================
   SEARCH
========================================================= */

app.get(
    "/api/search",
    async (req, res) => {
        try {
            const q =
                String(
                    req.query.q || ""
                ).trim();

            if (!q) {
                const songs =
                    await getSongs();

                return res.json({
                    success: true,
                    count: songs.length,
                    songs
                });
            }

            const result =
                await pool.query(
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
                        created_at,
                        updated_at
                    FROM songs
                    WHERE
                        title ILIKE $1
                        OR artist ILIKE $1
                        OR album ILIKE $1
                        OR category ILIKE $1
                    ORDER BY created_at DESC
                    `,
                    [`%${q}%`]
                );

            const songs =
                result.rows.map(
                    normalizeSong
                );

            res.json({
                success: true,
                count: songs.length,
                songs
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                count: 0,
                songs: [],
                error: error.message
            });
        }
    }
);

/* =========================================================
   CATEGORIES
========================================================= */

app.get(
    "/api/categories",
    async (req, res) => {
        try {
            const result =
                await pool.query(`
                    SELECT
                        COALESCE(
                            NULLIF(
                                TRIM(category),
                                ''
                            ),
                            'Other'
                        ) AS category,
                        COUNT(*)::INTEGER AS count
                    FROM songs
                    GROUP BY
                        COALESCE(
                            NULLIF(
                                TRIM(category),
                                ''
                            ),
                            'Other'
                        )
                    ORDER BY category
                `);

            const categories =
                result.rows.map(row => ({
                    name: row.category,
                    category: row.category,
                    count: row.count
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

            const songs =
                await getSongs(
                    `
                    WHERE LOWER(category)
                    = LOWER($1)
                    `,
                    [category]
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

/* =========================================================
   MP3 STREAM
   Supports browser Range requests
========================================================= */

app.get(
    "/api/songs/:id/audio",
    async (req, res) => {
        try {
            const id =
                Number(req.params.id);

            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {
                return res.status(400).send(
                    "Invalid song ID"
                );
            }

            const result =
                await pool.query(
                    `
                    SELECT
                        file_data,
                        file_name,
                        mime_type,
                        file_size
                    FROM songs
                    WHERE
                        id = $1
                        AND source_type = 'mp3_file'
                        AND file_data IS NOT NULL
                    `,
                    [id]
                );

            if (
                !result.rows.length
            ) {
                return res.status(404).send(
                    "Audio file not found"
                );
            }

            const song =
                result.rows[0];

            const buffer =
                song.file_data;

            const total =
                buffer.length;

            const mime =
                song.mime_type ||
                "audio/mpeg";

            res.setHeader(
                "Accept-Ranges",
                "bytes"
            );

            res.setHeader(
                "Cache-Control",
                "public, max-age=3600"
            );

            const range =
                req.headers.range;

            if (!range) {
                res.status(200);

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
                return res.status(416).end();
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
                const suffix =
                    Number(match[2]);

                start =
                    Math.max(
                        0,
                        total - suffix
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

                return res.status(416).end();
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
            console.error(
                "Audio stream error:",
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

        if (
            !key ||
            key !== ADMIN_KEY
        ) {
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

/* =========================================================
   ADMIN SONG LIST
========================================================= */

app.get(
    "/api/admin/songs",
    adminRequired,
    async (req, res) => {
        try {
            const songs =
                await getSongs();

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
   ADMIN UPLOAD MP3
========================================================= */

app.post(
    "/api/admin/songs/upload",
    adminRequired,
    upload.single("file"),
    async (req, res) => {
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
                    error:
                        "Title is required."
                });
            }

            const artist =
                String(
                    req.body.artist ||
                    "SwarAJ"
                ).trim();

            const album =
                String(
                    req.body.album ||
                    "Singles"
                ).trim();

            const category =
                String(
                    req.body.category ||
                    "Other"
                ).trim();

            const coverUrl =
                String(
                    req.body.coverUrl ||
                    ""
                ).trim() || null;

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
                        $1,$2,$3,$4,$5,
                        'mp3_file',
                        $6,$7,$8,$9
                    )
                    RETURNING *
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
   ADMIN MP3 URL
========================================================= */

app.post(
    "/api/admin/songs/mp3-url",
    adminRequired,
    async (req, res) => {
        try {
            const title =
                String(
                    req.body.title || ""
                ).trim();

            const audioUrl =
                String(
                    req.body.audioUrl || ""
                ).trim();

            if (!title) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Title is required."
                });
            }

            if (!audioUrl) {
                return res.status(400).json({
                    success: false,
                    error:
                        "MP3 URL is required."
                });
            }

            try {
                new URL(audioUrl);
            } catch {
                return res.status(400).json({
                    success: false,
                    error:
                        "Invalid audio URL."
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
                        audio_url
                    )
                    VALUES (
                        $1,$2,$3,$4,$5,
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
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/* =========================================================
   ADMIN YOUTUBE
========================================================= */

app.post(
    "/api/admin/songs/youtube",
    adminRequired,
    async (req, res) => {
        try {
            const title =
                String(
                    req.body.title || ""
                ).trim();

            const youtubeUrl =
                String(
                    req.body.youtubeUrl || ""
                ).trim();

            if (!title) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Title is required."
                });
            }

            if (!youtubeUrl) {
                return res.status(400).json({
                    success: false,
                    error:
                        "YouTube URL is required."
                });
            }

            const videoId =
                getYouTubeVideoId(
                    youtubeUrl
                );

            if (!videoId) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Invalid YouTube URL."
                });
            }

            const coverUrl =
                String(
                    req.body.coverUrl ||
                    ""
                ).trim() ||
                `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

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
                        $1,$2,$3,$4,$5,
                        'youtube',
                        $6,$7
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
                        coverUrl,
                        youtubeUrl,
                        videoId
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
    adminRequired,
    async (req, res) => {
        try {
            const id =
                Number(req.params.id);

            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Invalid song ID."
                });
            }

            const result =
                await pool.query(
                    `
                    DELETE FROM songs
                    WHERE id = $1
                    RETURNING id,title
                    `,
                    [id]
                );

            if (
                !result.rows.length
            ) {
                return res.status(404).json({
                    success: false,
                    error:
                        "Song not found."
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

/* =========================================================
   STATIC FRONTEND
========================================================= */

const publicDir = __dirname;

app.use(
    express.static(publicDir, {
        index: "index.html"
    })
);

/* =========================================================
   SPA FALLBACK
========================================================= */

app.use(
    (req, res, next) => {
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
    }
);

/* =========================================================
   404
========================================================= */

app.use(
    (req, res) => {
        res.status(404).json({
            success: false,
            error: "Not found"
        });
    }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
    (error, req, res, next) => {
        console.error(
            "SERVER ERROR:",
            error
        );

        if (
            error instanceof
            multer.MulterError
        ) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error:
                error.message ||
                "Internal server error"
        });
    }
);

/* =========================================================
   START
========================================================= */

async function startServer() {
    try {
        console.log(
            "===================================="
        );

        console.log(
            "        SwarAJ Music Server"
        );

        console.log(
            "===================================="
        );

        await initializeDatabase();

        app.listen(
            PORT,
            HOST,
            () => {
                console.log(
                    "------------------------------------"
                );

                console.log(
                    `Server: http://${HOST}:${PORT}`
                );

                console.log(
                    `Admin: ${
                        ADMIN_KEY
                            ? "configured"
                            : "NOT CONFIGURED"
                    }`
                );

                console.log(
                    "SwarAJ server started successfully"
                );

                console.log(
                    "===================================="
                );
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

process.on(
    "SIGTERM",
    async () => {
        await pool.end();
        process.exit(0);
    }
);

process.on(
    "SIGINT",
    async () => {
        await pool.end();
        process.exit(0);
    }
);

startServer();