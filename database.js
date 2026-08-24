const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL;

let pool = null;

if (databaseUrl) {
  pool = new Pool({
    connectionString: databaseUrl,

    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,

    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  pool.on("error", (err) => {
    console.error("PostgreSQL pool error:", err);
  });
} else {
  console.warn("DATABASE_URL is not configured.");
}

async function initDatabase() {
  if (!pool) {
    console.warn("Database initialization skipped.");
    return;
  }

  try {
    // ==================================================
    // CREATE SONGS TABLE IF IT DOES NOT EXIST
    // ==================================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS songs (
        id SERIAL PRIMARY KEY,

        title VARCHAR(255) NOT NULL,

        artist VARCHAR(255) DEFAULT '',

        album VARCHAR(255) DEFAULT '',

        category VARCHAR(100) DEFAULT 'All Songs',

        language VARCHAR(100) DEFAULT '',

        genre VARCHAR(100) DEFAULT '',

        file_path TEXT,

        audio_url TEXT,

        youtube_url TEXT,

        cover_url TEXT,

        lyrics TEXT DEFAULT '',

        featured BOOLEAN DEFAULT FALSE,

        published BOOLEAN DEFAULT TRUE,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ==================================================
    // ADD / UPDATE COLUMNS FOR OLD DATABASES
    // ==================================================

    await pool.query(`
      ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS file_path TEXT
    `);

    await pool.query(`
      ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS title VARCHAR(255)
    `);

    await pool.query(`
      ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS artist VARCHAR(255) DEFAULT ''
    `);

    await pool.query(`
      ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS album VARCHAR(255) DEFAULT ''
    `);

    await pool.query(`
      ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'All Songs'
    `);

    await pool.query(`
      ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS language VARCHAR(100) DEFAULT ''
    `);

    await pool.query(`
      ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS genre VARCHAR(100) DEFAULT ''
    `);

    await pool.query(`
      ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS audio_url TEXT
    `);

    await pool.query(`
      ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS youtube_url TEXT
    `);

    await pool.query(`
      ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS cover_url TEXT
    `);

    await pool.query(`
      ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS lyrics TEXT DEFAULT ''
    `);

    await pool.query(`
      ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE
    `);

    await pool.query(`
      ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT TRUE
    `);

    await pool.query(`
      ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    // ==================================================
    // IMPORTANT FIX
    // ==================================================
    // Old SwarAJ database had:
    //
    // file_path TEXT NOT NULL
    //
    // That prevents YouTube-only songs from being inserted.
    //
    // YouTube song:
    // file_path = NULL
    // youtube_url = actual YouTube URL
    //
    // MP3/Cloudinary song:
    // audio_url = actual audio URL
    //
    // Therefore file_path must be optional.
    // ==================================================

    await pool.query(`
      ALTER TABLE songs
      ALTER COLUMN file_path DROP NOT NULL
    `);

    // ==================================================
    // SAFE DEFAULTS FOR OLD ROWS
    // ==================================================

    await pool.query(`
      UPDATE songs
      SET artist = ''
      WHERE artist IS NULL
    `);

    await pool.query(`
      UPDATE songs
      SET album = ''
      WHERE album IS NULL
    `);

    await pool.query(`
      UPDATE songs
      SET category = 'All Songs'
      WHERE category IS NULL
    `);

    await pool.query(`
      UPDATE songs
      SET language = ''
      WHERE language IS NULL
    `);

    await pool.query(`
      UPDATE songs
      SET genre = ''
      WHERE genre IS NULL
    `);

    await pool.query(`
      UPDATE songs
      SET lyrics = ''
      WHERE lyrics IS NULL
    `);

    await pool.query(`
      UPDATE songs
      SET featured = FALSE
      WHERE featured IS NULL
    `);

    await pool.query(`
      UPDATE songs
      SET published = TRUE
      WHERE published IS NULL
    `);

    // ==================================================
    // INDEXES
    // ==================================================

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_category
      ON songs(category)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_artist
      ON songs(artist)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_title
      ON songs(title)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_created_at
      ON songs(created_at DESC)
    `);

    // ==================================================
    // SUCCESS
    // ==================================================

    console.log("==========================================");
    console.log("PostgreSQL database initialized.");
    console.log("Songs table ready.");
    console.log("file_path: OPTIONAL");
    console.log("audio_url: ENABLED");
    console.log("youtube_url: ENABLED");
    console.log("cover_url: ENABLED");
    console.log("==========================================");

  } catch (error) {
    console.error("==========================================");
    console.error("DATABASE INITIALIZATION ERROR");
    console.error("MESSAGE:", error.message);
    console.error("CODE:", error.code);
    console.error("DETAIL:", error.detail);
    console.error("HINT:", error.hint);
    console.error("==========================================");

    throw error;
  }
}

module.exports = {
  pool,
  initDatabase
};