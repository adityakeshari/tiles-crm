import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 20),
  min: Number(process.env.PG_POOL_MIN || 2),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 10000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 5000),
  keepAlive: true,
  maxUses: Number(process.env.PG_MAX_USES || 7500),
});

export async function query(text, params = []) {
  return pool.query(text, params);
}
