import { randomUUID } from "node:crypto";
import { transaction } from "./db.mjs";
import { ROLES, PAGES } from "./catalog.mjs";
import {
  fail,
  hashPassword,
  verifyPassword,
  validatePassword,
  hashToken,
  newToken,
  cookieToken,
  validateAvatar,
  SESSION_SECONDS,
} from "./security.mjs";
const fields =
  "id,username,nickname,avatar,tier,is_admin,status,tags,created_at,last_login_at";
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
let dummyHash;
function nickname(value) {
  if (
    typeof value !== "string" ||
    value.trim().length < 1 ||
    value.trim().length > 32
  )
    fail(400, "昵称需为1–32个字。");
  return value.trim();
}
function username(value) {
  if (typeof value !== "string" || !/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(value))
    fail(400, "账号需为4–32位字母、数字或下划线，以字母开头。");
  return value.toLowerCase();
}
export class Membership {
  constructor(db) {
    this.db = db;
  }
  async limit(key, max = 20, minutes = 15) {
    // Atomic database counter works across serverless instances.
    const { rows } = await this.db.query(
      `INSERT INTO baox_limits(key,hits,expires_at) VALUES($1,1,now()+$2*interval '1 minute')
      ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN baox_limits.expires_at<now() THEN 1 ELSE baox_limits.hits+1 END,
      expires_at=CASE WHEN baox_limits.expires_at<now() THEN EXCLUDED.expires_at ELSE baox_limits.expires_at END RETURNING hits`,
      [hashToken(key), minutes],
    );
    if (rows[0].hits > max) fail(429, "操作过于频繁，请15分钟后再试。");
  }
  async current(req) {
    const token = cookieToken(req);
    if (!token) return null;
    const { rows } = await this.db.query(
      `SELECT ${fields
        .split(",")
        .map((f) => "u." + f)
        .join(",")} FROM baox_sessions s
      JOIN baox_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.status='active'`,
      [hashToken(token)],
    );
    return rows[0] || null;
  }
  async requireUser(req) {
    const user = await this.current(req);
    if (!user) fail(401, "请先登录。");
    return user;
  }
  async requireAdmin(req) {
    const user = await this.requireUser(req);
    if (!user.is_admin) fail(403, "仅管理员可访问。");
    return user;
  }
  async rules() {
    return (
      await this.db.query(
        "SELECT page,public,tiers FROM baox_page_rules ORDER BY page",
      )
    ).rows;
  }
  async permitted(user, page) {
    if (!Object.hasOwn(PAGES, page)) return false;
    if (user && (user.is_admin || user.tier === "team")) return true;
    const { rows } = await this.db.query(
      "SELECT public,tiers FROM baox_page_rules WHERE page=$1",
      [page],
    );
    const rule = rows[0];
    if (page === "collection" && !user) return false;
    return (
      !!rule && (rule.public || (!!user && rule.tiers.includes(user.tier)))
    );
  }
  async access(user) {
    const rules = await this.rules();
    return Object.entries(PAGES).map(([page, title]) => ({
      page,
      title,
      url: `/${page}/`,
      allowed:
        (!!user && (user.is_admin || user.tier === "team")) ||
        !!rules.find(
          (r) =>
            r.page === page &&
            ((r.public && (page !== "collection" || user)) ||
              (user && r.tiers.includes(user.tier))),
        ),
    }));
  }
  async createSession(client, userId) {
    const token = newToken();
    await client.query(
      `INSERT INTO baox_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+$3*interval '1 second')`,
      [hashToken(token), userId, SESSION_SECONDS],
    );
    return token;
  }
  async register(body) {
    const account = username(body.username),
      name = nickname(body.nickname);
    validatePassword(body.password);
    if (account === (process.env.ADMIN_USERNAME || "jaydenkong").toLowerCase())
      fail(409, "该账号不可注册，请更换账号。");
    const avatar = validateAvatar(body.avatar || "");
    const hash = await hashPassword(body.password);
    try {
      return await transaction(this.db, async (client) => {
        const { rows } = await client.query(
          `INSERT INTO baox_users(id,username,nickname,password_hash,avatar) VALUES($1,$2,$3,$4,$5) RETURNING ${fields}`,
          [randomUUID(), account, name, hash, avatar],
        );
        return {
          user: rows[0],
          token: await this.createSession(client, rows[0].id),
        };
      });
    } catch (error) {
      if (error.code === "23505") fail(409, "这个账号已被注册。");
      throw error;
    }
  }
  async login(body) {
    const account = username(body.username);
    if (typeof body.password !== "string" || body.password.length > 128)
      fail(401, "账号或密码不正确。");
    const { rows } = await this.db.query(
      `SELECT ${fields},password_hash FROM baox_users WHERE username=$1`,
      [account],
    );
    dummyHash ||= hashPassword(newToken());
    const user = rows[0];
    if (
      !(await verifyPassword(
        body.password,
        user?.password_hash || (await dummyHash),
      )) ||
      !user ||
      user.status !== "active"
    )
      fail(401, "账号或密码不正确，或账户已停用。");
    const verifiedHash = user.password_hash;
    delete user.password_hash;
    return transaction(this.db, async (client) => {
      // Lock/recheck status so a simultaneous disable cannot create a new session.
      const active = await client.query(
        "SELECT status,password_hash FROM baox_users WHERE id=$1 FOR UPDATE",
        [user.id],
      );
      if (
        active.rows[0].status !== "active" ||
        active.rows[0].password_hash !== verifiedHash
      )
        fail(401, "账户已停用。");
      await client.query(
        "UPDATE baox_users SET last_login_at=now() WHERE id=$1",
        [user.id],
      );
      return { user, token: await this.createSession(client, user.id) };
    });
  }
  async logout(req) {
    const token = cookieToken(req);
    if (token)
      await this.db.query("DELETE FROM baox_sessions WHERE token_hash=$1", [
        hashToken(token),
      ]);
  }
  async profile(user, body) {
    const name = nickname(body.nickname),
      avatar = validateAvatar(body.avatar || "");
    const { rows } = await this.db.query(
      `UPDATE baox_users SET nickname=$1,avatar=$2,updated_at=now() WHERE id=$3 RETURNING ${fields}`,
      [name, avatar, user.id],
    );
    return rows[0];
  }
  async password(user, body) {
    validatePassword(body.password);
    if (
      typeof body.currentPassword !== "string" ||
      body.currentPassword.length > 128
    )
      fail(400, "请输入当前密码。");
    const row = (
      await this.db.query("SELECT password_hash FROM baox_users WHERE id=$1", [
        user.id,
      ])
    ).rows[0];
    if (!(await verifyPassword(body.currentPassword, row.password_hash)))
      fail(400, "当前密码不正确。");
    const hash = await hashPassword(body.password);
    return transaction(this.db, async (client) => {
      const changed = await client.query(
        "UPDATE baox_users SET password_hash=$1,updated_at=now() WHERE id=$2 AND password_hash=$3 RETURNING id",
        [hash, user.id, row.password_hash],
      );
      if (!changed.rows.length) fail(409, "密码已被更新，请重新登录。");
      await client.query("DELETE FROM baox_sessions WHERE user_id=$1", [
        user.id,
      ]);
      return this.createSession(client, user.id);
    });
  }
  async listUsers(search = "", tier = "", page = 1) {
    const term = String(search || "").slice(0, 100),
      level = Object.hasOwn(ROLES, tier) ? tier : "";
    const current = Math.max(1, Math.min(100000, Number.parseInt(page) || 1)),
      offset = (current - 1) * 20;
    const where =
      "WHERE (username ILIKE $1 OR nickname ILIKE $1 OR array_to_string(tags,',') ILIKE $1) AND ($2='' OR tier=$2)";
    const [users, count, stats] = await Promise.all([
      this.db.query(
        `SELECT ${fields} FROM baox_users ${where} ORDER BY created_at DESC LIMIT 20 OFFSET $3`,
        ["%" + term + "%", level, offset],
      ),
      this.db.query(`SELECT count(*)::int AS total FROM baox_users ${where}`, [
        "%" + term + "%",
        level,
      ]),
      this.db.query(
        "SELECT tier,count(*)::int AS total FROM baox_users GROUP BY tier",
      ),
    ]);
    return {
      users: users.rows,
      total: count.rows[0].total,
      page: current,
      stats: stats.rows,
    };
  }
  async updateUser(admin, body) {
    if (
      !UUID.test(body.id || "") ||
      !Object.hasOwn(ROLES, body.tier) ||
      !["active", "disabled"].includes(body.status)
    )
      fail(400, "会员参数不正确。");
    if (
      !Array.isArray(body.tags) ||
      body.tags.length > 10 ||
      body.tags.some((t) => typeof t !== "string" || !t.trim() || t.length > 20)
    )
      fail(400, "最多设置10个标签，每个不超过20个字。");
    return transaction(this.db, async (client) => {
      const found = await client.query(
        "SELECT is_admin FROM baox_users WHERE id=$1 FOR UPDATE",
        [body.id],
      );
      if (!found.rows.length) fail(404, "会员不存在。");
      if (
        found.rows[0].is_admin &&
        (body.status !== "active" || body.tier !== "team")
      )
        fail(400, "不能停用管理员或修改管理员的内部成员级别。");
      await client.query(
        "UPDATE baox_users SET tier=$1,status=$2,tags=$3,updated_at=now() WHERE id=$4",
        [
          body.tier,
          body.status,
          [...new Set(body.tags.map((t) => t.trim()))],
          body.id,
        ],
      );
      if (body.status === "disabled")
        await client.query("DELETE FROM baox_sessions WHERE user_id=$1", [
          body.id,
        ]);
      await client.query(
        "INSERT INTO baox_audit(id,actor_id,action,target,details) VALUES($1,$2,$3,$4,$5)",
        [
          randomUUID(),
          admin.id,
          "update_user",
          body.id,
          JSON.stringify({
            tier: body.tier,
            status: body.status,
            tags: body.tags,
          }),
        ],
      );
      return { ok: true };
    });
  }
  async saveRules(admin, body) {
    if (
      !Array.isArray(body.rules) ||
      body.rules.length !== Object.keys(PAGES).length ||
      new Set(body.rules.map((r) => r.page)).size !== body.rules.length
    )
      fail(400, "页面权限清单不完整。");
    for (const rule of body.rules) {
      if (
        !Object.hasOwn(PAGES, rule.page) ||
        typeof rule.public !== "boolean" ||
        !Array.isArray(rule.tiers) ||
        rule.tiers.some((t) => !Object.hasOwn(ROLES, t))
      )
        fail(400, "页面权限格式不正确。");
      if (rule.page === "collection" && rule.public)
        fail(400, "保藏仅允许登录会员访问。");
    }
    return transaction(this.db, async (client) => {
      for (const rule of body.rules)
        await client.query(
          "UPDATE baox_page_rules SET public=$1,tiers=$2,updated_at=now() WHERE page=$3",
          [rule.public, [...new Set([...rule.tiers, "team"])], rule.page],
        );
      await client.query(
        "INSERT INTO baox_audit(id,actor_id,action,target,details) VALUES($1,$2,$3,$4,$5)",
        [
          randomUUID(),
          admin.id,
          "update_rules",
          "pages",
          JSON.stringify(body.rules),
        ],
      );
      return { ok: true };
    });
  }
}
