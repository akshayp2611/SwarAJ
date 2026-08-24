const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL || "";

let pool = null;
let databaseAvailable = false;

if (databaseUrl) {
  pool = new Pool({
    connectionString: databaseUrl,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  pool.on("error", (err) => {
    console.error("PostgreSQL pool error:", err.message);
  });
} else {
  console.warn("DATABASE_URL is not configured.");
}

async function initializeDatabase() {
  if (!pool) {
    console.warn("Database initialization skipped: DATABASE_URL missing.");
    return false;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS songs (
        id BIGSERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT DEFAULT 'Unknown Artist',
        album TEXT DEFAULT 'Unknown Album',
        category TEXT DEFAULT 'All Songs',
        filename TEXT NOT NULL UNIQUE,
        file_path TEXT NOT NULL,
        cover TEXT,
        duration NUMERIC DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_category
      ON songs(category);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_title
      ON songs(title);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_artist
      ON songs(artist);
    `);

    databaseAvailable = true;

    console.log("PostgreSQL database connected.");
    console.log("Songs table ready.");

    return true;
  } catch (error) {
    databaseAvailable = false;

    console.error(
      "PostgreSQL initialization failed:",
      error.message
    );

    return false;
  }
}

function isDatabaseAvailable() {
  return databaseAvailable && !!pool;
}

async function getSongs() {
  if (!isDatabaseAvailable()) {
    return [];
  }

  const result = await pool.query(`
    SELECT
      id,
      title,
      artist,
      album,
      category,
      filename,
      file_path,
      cover,
      duration,
      created_at,
      updated_at
    FROM songs
    ORDER BY category ASC, title ASC
  `);

  return result.rows;
}

async function getCategories() {
  if (!isDatabaseAvailable()) {
    return [];
  }

  const result = await pool.query(`
    SELECT
      category,
      COUNT(*)::INTEGER AS song_count
    FROM songs
    GROUP BY category
    ORDER BY category ASC
  `);

  return result.rows;
}

async function upsertSong(song) {
  if (!isDatabaseAvailable()) {
    return null;
  }

  const result = await pool.query(
    `
    INSERT INTO songs (
      title,
      artist,
      album,
      category,
      filename,
      file_path,
      cover,
      duration
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (filename)
    DO UPDATE SET
      title = EXCLUDED.title,
      artist = EXCLUDED.artist,
      album = EXCLUDED.album,
      category = EXCLUDED.category,
      file_path = EXCLUDED.file_path,
      cover = EXCLUDED.cover,
      duration = EXCLUDED.duration,
      updated_at = NOW()
    RETURNING *
    `,
    [
      song.title,
      song.artist,
      song.album,
      song.category,
      song.filename,
      song.file_path,
      song.cover,
      song.duration || 0
    ]
  );

  return result.rows[0];
}

async function removeMissingSongs(existingFiles) {
  if (!isDatabaseAvailable()) {
    return;
  }

  if (!existingFiles.length) {
    await pool.query(`DELETE FROM songs`);
    return;
  }

  await pool.query(
    `
    DELETE FROM songs
    WHERE filename <> ALL($1::text[])
    `,
    [existingFiles]
  );
}

async function closeDatabase() {
  if (pool) {
    await pool.end();
  }
}

module.exports = {
  initializeDatabase,
  isDatabaseAvailable,
  getSongs,
  getCategories,
  upsertSong,
  removeMissingSongs,
  closeDatabase
};