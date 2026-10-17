import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, access, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { Membership } from "../server/membership.mjs";
import { createHandler } from "../api/account.mjs";
import { createPageHandler } from "../api/page.mjs";
import {
  hashPassword,
  hashToken,
  sessionCookie,
  validateAvatar,
} from "../server/security.mjs";
import { PAGES, DEFAULT_PUBLIC, safeNext } from "../server/catalog.mjs";
let db, service, server, origin, adminCookie, memberCookie, memberId;
const password = "Testing-password-73";
async function request(action, body, cookie = "", extra = {}) {
  const headers = {
    ...(body ? { "Content-Type": "application/json", Origin: origin } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
    ...extra,
  };
  const response = await fetch(`${origin}/api/account?action=${action}`, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    body: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
    headers: response.headers,
  };
}
before(async () => {
  db = new PGlite();
  await db.exec(
    await readFile(new URL("../server/schema.sql", import.meta.url), "utf8"),
  );
  for (const page of Object.keys(PAGES))
    await db.query(
      "INSERT INTO baox_page_rules(page,public,tiers) VALUES($1,$2,$3)",
      [page, DEFAULT_PUBLIC.includes(page), ["member", "angel", "team"]],
    );
  await db.query(
    "INSERT INTO baox_users(id,username,nickname,password_hash,tier,is_admin) VALUES($1,'jaydenkong','公子',$2,'team',true)",
    [randomUUID(), await hashPassword(password)],
  );
  service = new Membership(db);
  const api = createHandler(() => db),
    page = createPageHandler(() => db);
  server = createServer((req, res) =>
    req.url.startsWith("/api/page") ? page(req, res) : api(req, res),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  process.env.SITE_ORIGIN = origin;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.close();
});
test("unauthenticated profile and admin access denied; collection HTML never disclosed", async () => {
  assert.equal((await request("me")).body.user, null);
  assert.equal((await request("users")).status, 401);
  assert.equal((await request("profile", { nickname: "Guest" })).status, 401);
  for (const path of [
    "/api/page?slug=collection",
    "/api/page?slug=..%2Fcollection",
  ]) {
    const r = await fetch(origin + path),
      html = await r.text();
    assert.equal(r.status, path.includes("..") ? 404 : 401);
    assert.ok(!html.includes("amber-composition"));
  }
  assert.equal(
    (await request("access", undefined, "", {})).body.allowed,
    false,
  );
});
test("register ignores client privilege escalation, creates secure session and hashes password", async () => {
  const r = await request("register", {
    username: "TestMember",
    nickname: "测试会员",
    password,
    tier: "team",
    is_admin: true,
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.tier, "member");
  assert.equal(r.body.user.is_admin, false);
  assert.ok(!r.body.user.password_hash);
  memberCookie = r.cookie;
  memberId = r.body.user.id;
  assert.match(r.headers.get("set-cookie"), /HttpOnly/);
  assert.match(r.headers.get("set-cookie"), /SameSite=Lax/);
  const stored = (
    await db.query("SELECT password_hash FROM baox_users WHERE id=$1", [
      memberId,
    ])
  ).rows[0];
  assert.notEqual(stored.password_hash, password);
  assert.ok(stored.password_hash.startsWith("scrypt$"));
  const raw = memberCookie.split("=")[1],
    sessions = await db.query(
      "SELECT token_hash FROM baox_sessions WHERE user_id=$1",
      [memberId],
    );
  assert.equal(sessions.rows[0].token_hash, hashToken(raw));
  assert.equal(
    (
      await request("register", {
        username: "testmember",
        nickname: "重复",
        password,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("register", {
        username: "jaydenkong",
        nickname: "伪管理员",
        password,
      })
    ).status,
    409,
  );
  assert.equal((await request("users", undefined, memberCookie)).status, 403);
  assert.equal(
    (
      await request(
        "user",
        { id: memberId, tier: "team", tags: [], status: "active" },
        memberCookie,
      )
    ).status,
    403,
  );
  const page = await fetch(origin + "/api/page?slug=collection", {
    headers: { Cookie: memberCookie },
  });
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes("amber-composition"));
  assert.match(page.headers.get("cache-control"), /no-store/);
});
test("CSRF, wrong methods, weak passwords, invalid avatars and SQL-like input rejected", async () => {
  assert.equal(
    (
      await request("profile", { nickname: "attack" }, memberCookie, {
        Origin: "https://evil.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("profile", { nickname: "attack" }, memberCookie, {
        Origin: "",
      })
    ).status,
    403,
  );
  assert.equal((await request("profile", undefined, memberCookie)).status, 405);
  assert.equal(
    (
      await request("register", {
        username: "weakuser",
        nickname: "弱密码",
        password: "123456",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "profile",
        { nickname: "测试", avatar: "data:image/svg+xml;base64,PHN2Zz4=" },
        memberCookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (await request("login", { username: "' OR 1=1 --", password })).status,
    400,
  );
  assert.equal(
    (
      await request("login", {
        username: "testmember",
        password: "not-correct-987",
      })
    ).status,
    401,
  );
});
test("avatar format and dimensions are validated without decoding untrusted images", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZUcAAAAASUVORK5CYII=",
    "base64",
  );
  const valid = "data:image/png;base64," + png.toString("base64");
  assert.equal(validateAvatar(valid), valid);
  const huge = Buffer.from(png);
  huge.writeUInt32BE(100000, 16);
  assert.throws(
    () => validateAvatar("data:image/png;base64," + huge.toString("base64")),
    (e) => e.status === 400,
  );
  assert.throws(
    () =>
      validateAvatar(
        "data:image/png;base64," + Buffer.alloc(100000).toString("base64"),
      ),
    (e) => e.status === 400,
  );
});
test("profile changes remain scoped to authenticated user", async () => {
  const r = await request(
    "profile",
    {
      id: "another-user",
      nickname: "新的昵称",
      avatar: "",
      tier: "team",
      is_admin: true,
    },
    memberCookie,
  );
  assert.equal(r.status, 200);
  assert.equal(r.body.user.id, memberId);
  assert.equal(r.body.user.tier, "member");
  assert.equal(r.body.user.is_admin, false);
  assert.equal(r.body.user.nickname, "新的昵称");
});
test("admin manages tags, role rules and disabled accounts with immediate effect", async () => {
  const login = await request("login", { username: "jaydenkong", password });
  assert.equal(login.status, 200);
  adminCookie = login.cookie;
  const users = await request("users", undefined, adminCookie);
  assert.equal(users.status, 200);
  assert.equal(users.body.total, 2);
  assert.equal(users.body.users.length, 2);
  const updated = await request(
    "user",
    { id: memberId, tier: "angel", status: "active", tags: ["天使群", "上海"] },
    adminCookie,
  );
  assert.equal(updated.status, 200);
  assert.equal(
    (await request("me", undefined, memberCookie)).body.user.tier,
    "angel",
  );
  const config = (await request("rules", undefined, adminCookie)).body.rules;
  const collection = config.find((rule) => rule.page === "collection");
  collection.tiers = ["team"];
  assert.equal(
    (await request("save-rules", { rules: config }, adminCookie)).status,
    200,
  );
  assert.equal(
    (
      await fetch(origin + "/api/page?slug=collection", {
        headers: { Cookie: memberCookie },
      })
    ).status,
    403,
  );
  const adminPage = await fetch(origin + "/api/page?slug=collection", {
    headers: { Cookie: adminCookie },
  });
  assert.equal(adminPage.status, 200);
  collection.public = true;
  assert.equal(
    (await request("save-rules", { rules: config }, adminCookie)).status,
    400,
  );
  collection.public = false;
  assert.equal(
    (await request("save-rules", { rules: config.slice(1) }, adminCookie))
      .status,
    400,
  );
  await request(
    "user",
    { id: memberId, tier: "team", status: "active", tags: [] },
    adminCookie,
  );
  assert.equal(
    (
      await fetch(origin + "/api/page?slug=collection", {
        headers: { Cookie: memberCookie },
      })
    ).status,
    200,
  );
  await request(
    "user",
    { id: memberId, tier: "member", status: "disabled", tags: [] },
    adminCookie,
  );
  assert.equal((await request("me", undefined, memberCookie)).body.user, null);
  assert.equal(
    (await request("login", { username: "testmember", password })).status,
    401,
  );
  assert.ok((await db.query("SELECT id FROM baox_audit")).rows.length >= 4);
  await request(
    "user",
    { id: memberId, tier: "member", status: "active", tags: [] },
    adminCookie,
  );
  memberCookie = (await request("login", { username: "testmember", password }))
    .cookie;
});
test("password change verifies existing secret, rotates sessions and rejects old password", async () => {
  const otherSession = (
    await request("login", { username: "testmember", password })
  ).cookie;
  assert.equal(
    (
      await request(
        "password",
        { currentPassword: "wrong", password: "Changed-password-99" },
        memberCookie,
      )
    ).status,
    400,
  );
  const changed = await request(
    "password",
    { currentPassword: password, password: "Changed-password-99" },
    memberCookie,
  );
  assert.equal(changed.status, 200);
  assert.equal((await request("me", undefined, otherSession)).body.user, null);
  assert.equal((await request("me", undefined, memberCookie)).body.user, null);
  assert.ok((await request("me", undefined, changed.cookie)).body.user);
  assert.equal(
    (await request("login", { username: "testmember", password })).status,
    401,
  );
  const fresh = await request("login", {
    username: "testmember",
    password: "Changed-password-99",
  });
  assert.equal(fresh.status, 200);
  await request("logout", {}, fresh.cookie);
  assert.equal((await request("me", undefined, fresh.cookie)).body.user, null);
});
test("expired session, admin self-disable and rate limit checks", async () => {
  const admin = (await request("me", undefined, adminCookie)).body.user;
  assert.equal(
    (
      await request(
        "user",
        { id: admin.id, tier: "member", status: "disabled", tags: [] },
        adminCookie,
      )
    ).status,
    400,
  );
  await db.query(
    "UPDATE baox_sessions SET expires_at=now()-interval '1 minute' WHERE user_id=$1",
    [admin.id],
  );
  assert.equal((await request("users", undefined, adminCookie)).status, 401);
  for (let i = 0; i < 3; i++) await service.limit("test-counter", 3);
  await assert.rejects(
    () => service.limit("test-counter", 3),
    (e) => e.status === 429,
  );
  assert.equal(safeNext("//evil.example"), "/account/");
  assert.equal(safeNext("/api/account"), "/account/");
  process.env.NODE_ENV = "production";
  assert.match(sessionCookie("test"), /Secure/);
  delete process.env.NODE_ENV;
});
test("build output contains no controlled HTML or server secrets; all index aliases route through auth", async () => {
  const config = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  );
  for (const page of Object.keys(PAGES)) {
    await assert.rejects(() =>
      access(new URL(`../dist/${page}/index.html`, import.meta.url)),
    );
    const descendants = await readdir(
      new URL(`../dist/${page}/`, import.meta.url),
      { recursive: true },
    );
    assert.ok(
      !descendants.some((file) => file.endsWith(".html")),
      "No historical HTML bypass",
    );
    for (const suffix of ["", "/", "/index", "/index.html"])
      assert.ok(
        config.rewrites.find(
          (r) =>
            r.source === `/${page}${suffix}` &&
            r.destination === `/api/page?slug=${page}`,
        ),
      );
  }
  for (const path of ["server/schema.sql", ".env.local", "api/account.mjs"])
    await assert.rejects(() =>
      access(new URL("../dist/" + path, import.meta.url)),
    );
});
