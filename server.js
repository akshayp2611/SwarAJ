async function initializeDatabase() {
    console.log("Initializing PostgreSQL database...");

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // ---------------------------------------------------------
        // 1. Create table if it does not already exist
        // ---------------------------------------------------------
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
                    NOT NULL DEFAULT 'mp3_url',

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

        // ---------------------------------------------------------
        // 2. Upgrade OLD existing songs table
        // ---------------------------------------------------------
        await client.query(`
            ALTER TABLE songs
            ADD COLUMN IF NOT EXISTS title VARCHAR(255)
        `);

        await client.query(`
            ALTER TABLE songs
            ADD COLUMN IF NOT EXISTS artist VARCHAR(255)
                DEFAULT 'SwarAJ'
        `);

        await client.query(`
            ALTER TABLE songs
            ADD COLUMN IF NOT EXISTS album VARCHAR(255)
                DEFAULT 'Singles'
        `);

        await client.query(`
            ALTER TABLE songs
            ADD COLUMN IF NOT EXISTS category VARCHAR(100)
                DEFAULT 'Other'
        `);

        await client.query(`
            ALTER TABLE songs
            ADD COLUMN IF NOT EXISTS cover_url TEXT
        `);

        await client.query(`
            ALTER TABLE songs
            ADD COLUMN IF NOT EXISTS source_type VARCHAR(30)
                DEFAULT 'mp3_url'
        `);

        await client.query(`
            ALTER TABLE songs
            ADD COLUMN IF NOT EXISTS audio_url TEXT
        `);

        await client.query(`
            ALTER TABLE songs
            ADD COLUMN IF NOT EXISTS youtube_url TEXT
        `);

        // THIS IS THE COLUMN YOUR DATABASE IS MISSING
        await client.query(`
            ALTER TABLE songs
            ADD COLUMN IF NOT EXISTS youtube_video_id VARCHAR(50)
        `);

        await client.query(`
            ALTER TABLE songs
            ADD COLUMN IF NOT EXISTS file_data BYTEA
        `);

        await client.query(`
            ALTER TABLE songs
            ADD COLUMN IF NOT EXISTS file_name TEXT
        `);

        await client.query(`
            ALTER TABLE songs
            ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100)
        `);

        await client.query(`
            ALTER TABLE songs
            ADD COLUMN IF NOT EXISTS file_size BIGINT
        `);

        await client.query(`
            ALTER TABLE songs
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
                DEFAULT NOW()
        `);

        await client.query(`
            ALTER TABLE songs
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
                DEFAULT NOW()
        `);

        // ---------------------------------------------------------
        // 3. Fix NULL values in old records
        // ---------------------------------------------------------
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

        // ---------------------------------------------------------
        // 4. Create indexes AFTER columns exist
        // ---------------------------------------------------------
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

        console.log("PostgreSQL database initialized successfully.");

        // ---------------------------------------------------------
        // 5. Verify schema
        // ---------------------------------------------------------
        const result = await client.query(`
            SELECT
                COUNT(*)::INTEGER AS total,
                COUNT(*) FILTER (
                    WHERE source_type = 'youtube'
                )::INTEGER AS youtube,
                COUNT(*) FILTER (
                    WHERE source_type IN ('mp3', 'mp3_file', 'mp3_url')
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

    } catch (error) {
        await client.query("ROLLBACK");

        console.error(
            "PostgreSQL initialization failed:"
        );

        console.error(error);

        throw error;

    } finally {
        client.release();
    }
}