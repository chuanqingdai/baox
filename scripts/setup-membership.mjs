import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { database, transaction } from "../server/db.mjs";
import { PAGES, DEFAULT_PUBLIC } from "../server/catalog.mjs";
const db = database();
try {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(hash || ""))
    throw new Error(
      "ADMIN_PASSWORD_HASH must contain a scrypt hash. Run npm run admin:hash.",
    );
  if (!process.argv.includes("--seed-only"))
    await db.query(
      await readFile(new URL("../server/schema.sql", import.meta.url), "utf8"),
    );
  await transaction(db, async (client) => {
    for (const page of Object.keys(PAGES))
      await client.query(
        "INSERT INTO baox_page_rules(page,public,tiers) VALUES($1,$2,$3) ON CONFLICT(page) DO NOTHING",
        [page, DEFAULT_PUBLIC.includes(page), ["member", "angel", "team"]],
      );
    // Idempotent: rerunning never resets a changed admin password.
    await client.query(
      `INSERT INTO baox_users(id,username,nickname,password_hash,tier,is_admin) VALUES($1,$2,$3,$4,'team',true) ON CONFLICT(username) DO NOTHING`,
      [
        randomUUID(),
        (process.env.ADMIN_USERNAME || "jaydenkong").toLowerCase(),
        process.env.ADMIN_NICKNAME || "公子",
        hash,
      ],
    );
    const user = (
      await client.query("SELECT is_admin FROM baox_users WHERE username=$1", [
        (process.env.ADMIN_USERNAME || "jaydenkong").toLowerCase(),
      ])
    ).rows[0];
    if (!user?.is_admin)
      throw new Error(
        "Reserved admin account already belongs to a non-administrator; inspect manually.",
      );
  });
  console.log("Membership database and administrator initialized.");
} finally {
  await db.end();
}
