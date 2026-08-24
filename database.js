const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
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

pool.on("error", (error) => {
  console.error("PostgreSQL pool error:", error);
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS songs (
      id SERIAL PRIMARY KEY,

      title TEXT NOT NULL,

      artist TEXT
        DEFAULT 'Unknown Artist',

      album TEXT
        DEFAULT 'Unknown Album',

      category TEXT
        DEFAULT 'Other',

      audio_url TEXT NOT NULL UNIQUE,

      cover_url TEXT,

      cloudinary_public_id TEXT,

      duration INTEGER DEFAULT 0,

      created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_songs_category
    ON songs(category)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_songs_title
    ON songs(title)
  `);

  console.log("PostgreSQL database initialized.");
}

module.exports = {
  pool,
  initializeDatabase
};