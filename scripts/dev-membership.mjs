import { createServer } from "node:http";
import { readFile, stat, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { PAGES } from "../server/catalog.mjs";
import { createHandler } from "../api/account.mjs";
import { createPageHandler } from "../api/page.mjs";
const root = process.cwd(),
  port = Number(process.env.PORT || 8887);
process.env.SITE_ORIGIN = `http://127.0.0.1:${port}`;
let database;
if (process.env.LOCAL_MEMBERSHIP === "1") {
  // Explicit development-only PostgreSQL engine. Never used on Vercel.
  if (process.env.VERCEL || process.env.NODE_ENV === "production")
    throw new Error("Local development database is forbidden in production");
  const { PGlite } = await import("@electric-sql/pglite");
  const { randomUUID } = await import("node:crypto");
  const { hashPassword } = await import("../server/security.mjs");
  const { DEFAULT_PUBLIC } = await import("../server/catalog.mjs");
  await mkdir(resolve(root, ".local-data"), { recursive: true });
  const db = new PGlite(resolve(root, ".local-data/membership"));
  await db.exec(await readFile(resolve(root, "server/schema.sql"), "utf8"));
  for (const page of Object.keys(PAGES))
    await db.query(
      "INSERT INTO baox_page_rules(page,public,tiers) VALUES($1,$2,$3) ON CONFLICT(page) DO NOTHING",
      [page, DEFAULT_PUBLIC.includes(page), ["member", "angel", "team"]],
    );
  if (!process.env.ADMIN_PASSWORD_HASH)
    throw new Error(
      "Set local ADMIN_PASSWORD_HASH to initialize administrator",
    );
  await db.query(
    "INSERT INTO baox_users(id,username,nickname,password_hash,tier,is_admin) VALUES($1,'jaydenkong','公子',$2,'team',true) ON CONFLICT(username) DO NOTHING",
    [randomUUID(), process.env.ADMIN_PASSWORD_HASH],
  );
  database = () => db;
  console.log("Development-only PostgreSQL database ready");
}
const account = createHandler(database),
  page = createPageHandler(database);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".otf": "font/otf",
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, process.env.SITE_ORIGIN);
    if (url.pathname === "/api/account" || url.pathname === "/api/account/")
      return account(req, res);
    if (url.pathname === "/api/page" || url.pathname === "/api/page/")
      return page(req, res);
    const slug = url.pathname.split("/")[1];
    if (
      Object.hasOwn(PAGES, slug) &&
      new RegExp(`^/${slug}(?:/|/index(?:\\.html)?)?$`).test(url.pathname)
    ) {
      if (!url.pathname.endsWith("/")) {
        res.writeHead(308, { Location: `/${slug}/` });
        return res.end();
      }
      req.url = `/api/page?slug=${slug}`;
      return page(req, res);
    }
    let path = resolve(root, "dist", "." + decodeURIComponent(url.pathname));
    if (
      !path.startsWith(resolve(root, "dist") + "/") &&
      path !== resolve(root, "dist")
    ) {
      res.statusCode = 404;
      return res.end();
    }
    if ((await stat(path)).isDirectory()) path = resolve(path, "index.html");
    const data = await readFile(path);
    res.setHeader(
      "Content-Type",
      mime[extname(path)] || "application/octet-stream",
    );
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end("页面不存在");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`Membership preview: ${process.env.SITE_ORIGIN}`),
);
