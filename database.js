const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("DATABASE_URL is not configured.");
}

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      }
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
      title TEXT NOT NULL,
      artist TEXT DEFAULT 'Unknown Artist',
      album TEXT DEFAULT 'Unknown Album',
      category TEXT DEFAULT 'Other',
      audio_url TEXT NOT NULL,
      cover_url TEXT,
      duration INTEGER DEFAULT 0,
      liked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("PostgreSQL database initialized.");
}

async function getSongs() {
  if (!pool) return [];

  const result = await pool.query(`
    SELECT
      id,
      title,
      artist,
      album,
      category,
      audio_url,
      cover_url,
      duration,
      liked,
      created_at
    FROM songs
    ORDER BY created_at DESC
  `);

  return result.rows;
}

async function getCategories() {
  if (!pool) return [];

  const result = await pool.query(`
    SELECT
      category,
      COUNT(*)::INTEGER AS song_count
    FROM songs
    WHERE category IS NOT NULL
      AND category <> ''
    GROUP BY category
    ORDER BY category
  `);

  return result.rows;
}

async function createSong(song) {
  if (!pool) {
    throw new Error("Database is not configured");
  }

  const result = await pool.query(
    `
    INSERT INTO songs
    (
      title,
      artist,
      album,
      category,
      audio_url,
      cover_url,
      duration
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *
    `,
    [
      song.title,
      song.artist || "Unknown Artist",
      song.album || "Unknown Album",
      song.category || "Other",
      song.audio_url,
      song.cover_url || null,
      Number(song.duration || 0)
    ]
  );

  return result.rows[0];
}

async function deleteSong(id) {
  if (!pool) {
    throw new Error("Database is not configured");
  }

  await pool.query(
    `DELETE FROM songs WHERE id = $1`,
    [id]
  );
}

async function toggleLike(id) {
  if (!pool) {
    throw new Error("Database is not configured");
  }

  const result = await pool.query(
    `
    UPDATE songs
    SET liked = NOT liked
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return result.rows[0];
}

module.exports = {
  pool,
  initDatabase,
  getSongs,
  getCategories,
  createSong,
  deleteSong,
  toggleLike
};