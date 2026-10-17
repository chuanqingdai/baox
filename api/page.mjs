import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { database } from "../server/db.mjs";
import { Membership } from "../server/membership.mjs";
import { PAGES } from "../server/catalog.mjs";
import {membershipRequest} from '../server/remote-membership.mjs';
const root = process.cwd();
export function createPageHandler(getDatabase = database) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Vary", "Cookie");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    try {
      if (!["GET", "HEAD"].includes(req.method)) {
        res.statusCode = 405;
        return res.end();
      }
      const url = new URL(req.url, "https://baox.ai"),
        slug =
          typeof req.query?.slug === "string"
            ? req.query.slug
            : url.searchParams.get("slug");
      if (!Object.hasOwn(PAGES, slug || "")) {
        res.statusCode = 404;
        return res.end("页面不存在");
      }
      let allowed = false,
        user = null;
      if (process.env.DATABASE_URL || getDatabase !== database) {
        const service = new Membership(getDatabase());
        user = await service.current(req);
        allowed = await service.permitted(user, slug);
      } else {
        const response=await membershipRequest({url:req.url,headers:req.headers,method:'GET'},'access',{page:slug});
        if(!response.ok)throw new Error('Remote membership authorization unavailable');
        const access=await response.json();allowed=access.allowed;user=access.authenticated?{authenticated:true}:null;
      }
      if (!allowed) {
        res.statusCode = user ? 403 : 401;
        if (user)
          return res.end(
            await readFile(join(root, "account/denied.html"), "utf8"),
          );
        return res.end(await readFile(join(root, "login/index.html"), "utf8"));
      }
      res.statusCode = 200;
      return res.end(
        req.method === "HEAD"
          ? ""
          : await readFile(join(root, slug, "index.html"), "utf8"),
      );
    } catch (error) {
      console.error("Page authorization failed:", error.code || error.name);
      res.statusCode = 503;
      res.end("会员服务暂时不可用，请稍后重试。");
    }
  };
}
export default createPageHandler();
