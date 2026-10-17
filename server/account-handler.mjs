import { database } from "./db.mjs";
import { Membership } from "./membership.mjs";
import { ROLES, PAGES } from "./catalog.mjs";
import {
  assertSameOrigin,
  readBody,
  fail,
  sessionCookie,
} from "./security.mjs";
export function createHandler(getDatabase = database) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Vary", "Cookie");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    const send = (data, status = 200) => {
      res.statusCode = status;
      res.end(JSON.stringify(data));
    };
    try {
      const url = new URL(req.url, "https://baox.ai"),
        action = url.searchParams.get("action") || "me";
      const methods = {
        me: "GET",
        access: "GET",
        users: "GET",
        rules: "GET",
        register: "POST",
        login: "POST",
        logout: "POST",
        profile: "POST",
        password: "POST",
        user: "POST",
        "save-rules": "POST",
      };
      if (!Object.hasOwn(methods, action)) fail(404, "接口不存在。");
      if (req.method !== methods[action]) {
        res.setHeader("Allow", methods[action]);
        fail(405, "请求方式不正确。");
      }
      let body;
      if (req.method === "POST") {
        assertSameOrigin(req);
        body = await readBody(req);
      }
      const service = new Membership(getDatabase());
      if (action === "login" || action === "register") {
        const ip = String(
          req.headers["x-vercel-forwarded-for"] ||
            req.headers["x-forwarded-for"] ||
            req.socket?.remoteAddress ||
            "unknown",
        )
          .split(",")[0]
          .trim();
        await service.limit(
          `${action}:ip:${ip}`,
          action === "register" ? 10 : 30,
        );
        if (action === "login")
          await service.limit(
            `login:account:${String(body.username).toLowerCase().slice(0, 32)}`,
            20,
          );
        const result = await service[action](body);
        res.setHeader("Set-Cookie", sessionCookie(result.token));
        return send({ user: result.user }, action === "register" ? 201 : 200);
      }
      if (action === "me") {
        const user = await service.current(req);
        return send({ user, access: await service.access(user), roles: ROLES });
      }
      if (action === "access") {
        const page = url.searchParams.get("page"),
          user = await service.current(req);
        return send({
          allowed: await service.permitted(user, page),
          authenticated: !!user,
        });
      }
      if (action === "logout") {
        await service.logout(req);
        res.setHeader("Set-Cookie", sessionCookie("", 0));
        return send({ ok: true });
      }
      if (action === "profile" || action === "password") {
        const user = await service.requireUser(req);
        await service.limit(`${action}:${user.id}`, 20);
        if (action === "profile")
          return send({ user: await service.profile(user, body) });
        res.setHeader(
          "Set-Cookie",
          sessionCookie(await service.password(user, body)),
        );
        return send({ ok: true });
      }
      const admin = await service.requireAdmin(req);
      if (action === "users")
        return send(
          await service.listUsers(
            url.searchParams.get("search"),
            url.searchParams.get("tier"),
            url.searchParams.get("page"),
          ),
        );
      if (action === "rules")
        return send({
          rules: await service.rules(),
          pages: PAGES,
          roles: ROLES,
        });
      if (action === "user") return send(await service.updateUser(admin, body));
      if (action === "save-rules")
        return send(await service.saveRules(admin, body));
    } catch (error) {
      if (!error.status)
        console.error("Membership API failed:", error.code || error.name);
      send(
        {
          error: error.status
            ? error.message
            : "会员服务暂时不可用，请稍后再试。",
        },
        error.status || 503,
      );
    }
  };
}
export default createHandler();
