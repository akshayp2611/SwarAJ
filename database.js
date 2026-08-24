const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is required"
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  max: Number(process.env.DB_POOL_MAX || 10),

  idleTimeoutMillis: 30000,

  connectionTimeoutMillis: 10000,

  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false
});

pool.on("error", (error) => {
  console.error("PostgreSQL pool error:", error);
});

async function query(text, params = []) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  query
};