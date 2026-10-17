import pg from "pg";
import { readFileSync } from "node:fs";
let pool;
export function database() {
  if (!process.env.DATABASE_URL)
    throw Object.assign(new Error("会员服务尚未配置完成，请稍后再试。"), {
      status: 503,
    });
  if (!pool) {
    // TLS validation remains enabled. Supabase pooler URL is recommended on Vercel.
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      ssl: {
        ca:
          process.env.DATABASE_CA_CERT ||
          readFileSync(new URL("./supabase-ca.crt", import.meta.url), "utf8"),
        rejectUnauthorized: true,
      },
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 10000,
    });
    pool.on("error", () => console.error("Database connection interrupted"));
  }
  return pool;
}
export async function transaction(db, fn) {
  if (typeof db.transaction === "function") return db.transaction(fn);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
