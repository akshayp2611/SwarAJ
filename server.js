const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();

const PORT = Number(process.env.PORT) || 10000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL
        ? { rejectUnauthorized: false }
        : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

// ---------------------------------------------------------
// Error handlers
// ---------------------------------------------------------

process.on("uncaughtException", (error) => {
    console.error("UNCAUGHT EXCEPTION:");
    console.error(error);
});

process.on("unhandledRejection", (reason) => {
    console.error("UNHANDLED REJECTION:");
    console.error(reason);
});

// ---------------------------------------------------------
// Middleware
// ---------------------------------------------------------

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({
    extended: true,
    limit: "100mb"
}));

// ---------------------------------------------------------
// PostgreSQL initialization
// ---------------------------------------------------------

async function initializeDatabase() {
    console.log("Initializing PostgreSQL database...");

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Create table if it doesn't exist
        await client.query(`
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

        // Upgrade old database automatically
        const columns = [
            `title VARCHAR(255)`,
            `artist VARCHAR(255) DEFAULT 'SwarAJ'`,
            `album VARCHAR(255) DEFAULT 'Singles'`,
            `category VARCHAR(100) DEFAULT 'Other'`,
            `cover_url TEXT`,
            `source_type VARCHAR(30) DEFAULT 'mp3_url'`,
            `audio_url TEXT`,
            `youtube_url TEXT`,
            `youtube_video_id VARCHAR(50)`,
            `file_data BYTEA`,
            `file_name TEXT`,
            `mime_type VARCHAR(100)`,
            `file_size BIGINT`,
            `created_at TIMESTAMPTZ DEFAULT NOW()`,
            `updated_at TIMESTAMPTZ DEFAULT NOW()`
        ];

        for (const column of columns) {
            const [name, ...rest] = column.split(" ");
            await client.query(`
                ALTER TABLE songs
                ADD COLUMN IF NOT EXISTS ${name} ${rest.join(" ")}
            `);
        }

        // Repair old NULL records
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
            UPDATE songs
            SET created_at = NOW()
            WHERE created_at IS NULL
        `);

        await client.query(`
            UPDATE songs
            SET updated_at = NOW()
            WHERE updated_at IS NULL
        `);

        // Indexes are created AFTER columns
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

        const result = await client.query(`
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
            `Songs in database: ${result.rows[0].total}`
        );

        console.log(
            `YouTube songs: ${result.rows[0].youtube}`
        );

        console.log(
            `MP3 songs: ${result.rows[0].mp3}`
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

// ---------------------------------------------------------
// Health API
// ---------------------------------------------------------

app.get("/api/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        res.json({
            ok: true,
            status: "healthy",
            database: "connected",
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("Health check failed:", error);

        res.status(500).json({
            ok: false,
            status: "unhealthy",
            database: "disconnected",
            error: error.message
        });
    }
});

// ---------------------------------------------------------
// Songs API
// ---------------------------------------------------------

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
                mime_type,
                file_size,
                created_at,
                updated_at
            FROM songs
            ORDER BY created_at DESC
        `);

        res.json({
            success: true,
            songs: result.rows
        });

    } catch (error) {
        console.error("Songs API error:", error);

        res.status(500).json({
            success: false,
            error: error.message,
            songs: []
        });
    }
});

// ---------------------------------------------------------
// Categories API
// ---------------------------------------------------------

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
            categories: result.rows
        });

    } catch (error) {
        console.error("Categories error:", error);

        res.status(500).json({
            success: false,
            categories: []
        });
    }
});

// ---------------------------------------------------------
// Serve frontend
// ---------------------------------------------------------

const publicDir = __dirname;

app.use(express.static(publicDir));

// IMPORTANT:
// Do NOT use:
// app.get("*", ...)
// because Express 5 / path-to-regexp rejects "*".

app.use((req, res, next) => {
    if (
        req.method === "GET" &&
        !req.path.startsWith("/api/")
    ) {
        return res.sendFile(
            path.join(publicDir, "index.html")
        );
    }

    next();
});

// ---------------------------------------------------------
// 404
// ---------------------------------------------------------

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: "Not found"
    });
});

// ---------------------------------------------------------
// START SERVER
// ---------------------------------------------------------

async function startServer() {
    try {
        console.log("====================================");
        console.log("        SwarAJ Music Server");
        console.log("====================================");

        if (!process.env.DATABASE_URL) {
            throw new Error(
                "DATABASE_URL environment variable is missing"
            );
        }

        await initializeDatabase();

        const server = app.listen(
            PORT,
            "0.0.0.0",
            () => {
                console.log("------------------------------------");
                console.log(
                    `Server: http://0.0.0.0:${PORT}`
                );
                console.log(
                    `Environment: ${
                        process.env.NODE_ENV || "production"
                    }`
                );
                console.log(
                    "SwarAJ server started successfully"
                );
                console.log("====================================");
            }
        );

        server.on("error", (error) => {
            console.error(
                "HTTP server error:",
                error
            );
        });

    } catch (error) {
        console.error(
            "Unable to start server:"
        );

        console.error(error);

        // Keep the real error visible in Render
        process.exitCode = 1;
    }
}

startServer();