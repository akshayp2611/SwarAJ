const { Pool } = require("pg");

const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_HOST = process.env.DB_HOST;
const DB_NAME = process.env.DB_NAME;
const DB_PORT = Number(process.env.DB_PORT || 5432);

if (!DB_USER) {
  throw new Error("DB_USER is required");
}

if (!DB_PASSWORD) {
  throw new Error("DB_PASSWORD is required");
}

if (!DB_HOST) {
  throw new Error("DB_HOST is required");
}

if (!DB_NAME) {
  throw new Error("DB_NAME is required");
}

const pool = new Pool({
  user: DB_USER,
  password: DB_PASSWORD,
  host: DB_HOST,
  database: DB_NAME,
  port: DB_PORT,

  max: Number(process.env.DB_POOL_MAX || 10),

  idleTimeoutMillis: 30000,

  connectionTimeoutMillis: 10000,

  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false
        }
      : false
});

pool.on("connect", () => {
  console.log("✅ PostgreSQL connected");
});

pool.on("error", (error) => {
  console.error("❌ PostgreSQL pool error:", error.message);
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function testDatabase() {
  const result = await pool.query(
    "SELECT NOW() AS database_time"
  );

  return result.rows[0];
}

async function closeDatabase() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  testDatabase,
  closeDatabase
};