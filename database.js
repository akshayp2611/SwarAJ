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
} else {
  console.warn("DATABASE_URL is not configured.");
}

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

  const columns = [
    ["title", "VARCHAR(255)"],
    ["artist", "VARCHAR(255) DEFAULT ''"],
    ["album", "VARCHAR(255) DEFAULT ''"],
    ["category", "VARCHAR(100) DEFAULT 'All Songs'"],
    ["language", "VARCHAR(100) DEFAULT ''"],
    ["genre", "VARCHAR(100) DEFAULT ''"],
    ["audio_url", "TEXT"],
    ["youtube_url", "TEXT"],
    ["cover_url", "TEXT"],
    ["lyrics", "TEXT DEFAULT ''"],
    ["featured", "BOOLEAN DEFAULT FALSE"],
    ["published", "BOOLEAN DEFAULT TRUE"]
  ];

  for (const [name, type] of columns) {
    await pool.query(`
      ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS ${name} ${type}
    `);
  }

  console.log("PostgreSQL database initialized.");
}

module.exports = {
  pool,
  initDatabase
};