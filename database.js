const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL is not configured.");
}

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
    })
  : null;

async function initDatabase() {
  if (!pool) {
    console.warn("Database initialization skipped.");
    return;
  }

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

  // Fix existing SwarAJ databases
  const columns = [
    ["audio_url", "TEXT"],
    ["youtube_url", "TEXT"],
    ["cover_url", "TEXT"],
    ["lyrics", "TEXT DEFAULT ''"],
    ["featured", "BOOLEAN DEFAULT FALSE"],
    ["published", "BOOLEAN DEFAULT TRUE"],
  ];

  for (const [column, type] of columns) {
    await pool.query(`
      ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS ${column} ${type}
    `);
  }

  console.log("PostgreSQL database initialized.");
}

module.exports = {
  pool,
  initDatabase,
};