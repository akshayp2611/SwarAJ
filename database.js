const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL;

let pool = null;

if (databaseUrl) {
  pool = new Pool({
    connectionString: databaseUrl,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false
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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS songs (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        artist VARCHAR(255) DEFAULT '',
        album VARCHAR(255) DEFAULT '',
        category VARCHAR(100) DEFAULT 'All Songs',
        language VARCHAR(100) DEFAULT '',
        genre VARCHAR(100) DEFAULT '',
        audio_url TEXT,
        youtube_url TEXT,
        cover_url TEXT,
        lyrics TEXT DEFAULT '',
        featured BOOLEAN DEFAULT FALSE,
        published BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
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

    console.log("PostgreSQL database initialized.");
  } catch (error) {
    console.error(
      "DATABASE INITIALIZATION ERROR:",
      error
    );

    throw error;
  }
}

module.exports = {
  pool,
  initDatabase
};