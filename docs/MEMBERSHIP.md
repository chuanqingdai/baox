# BAOX.AI 会员系统

## 已实现
- 右上角登录 / 注册或头像昵称入口，游客点击保藏弹出登录框。
- 账号密码注册、头像上传并压缩、昵称修改、密码修改、退出登录。
- 个人中心 /account/；后台 /admin/。后台的页面外壳公开，所有客户数据和操作须通过服务端管理员鉴权。
- 普通会员、AI大师天使群、团队内部成员及三个统一的 SVG 徽章。
- 后台搜索、分级筛选、标签、启停、页面权限矩阵，审计记录。
- 服务端保护保藏 HTML，禁止静态 index、历史 HTML 绕过；Cookie HttpOnly / Secure / SameSite，密码 scrypt，限流与会话摘要存数据库。

## Supabase
项目：baox-membership（nophpwifppexocoxwati），组织 BAOX.AI，新加坡。
管理地址：https://supabase.com/dashboard/project/nophpwifppexocoxwati

表结构已初始化，管理员 jaydenkong / 公子已创建，使用用户指定密码的 scrypt 散列。密码和数据库连接均未进入 Git。
专用角色 baox_backend 仅有会员表的 DML 权限，通过该角色的 RLS 策略访问；anon / authenticated 无表权限。

生产环境的连接已保存在本机 `.env.production.local`（Git 忽略、文件权限 600）。其中只有服务端使用的连接和管理员散列，不得公开、上传静态目录或提交 Git。
CA 公钥证书来自 Supabase 官方 Studio 所使用的下载地址：
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
数据库连接启用 TLS 与 CA / 主机名验证，禁止使用 rejectUnauthorized:false。

## 本地预览

```sh
npm ci
npm run build
npm run dev
```

已有 `.env.local` 使用独立本地 PostgreSQL 测试数据库；不向生产写入测试账户。
默认预览地址 http://127.0.0.1:8887/ ，后台 http://127.0.0.1:8887/admin/ 。
本地管理员沿用指定账户，修改密码可在个人中心操作。普通体验账户仅存在本地测试数据库。

## 部署
1. 在持有 baox.ai 的 Vercel 项目中，将 `.env.production.local` 中 DATABASE_URL、SITE_ORIGIN 配到 Production；DATABASE_URL 设为 sensitive。
2. Preview 使用单独数据库时，独立配置它的 DATABASE_URL，并将 SITE_ORIGIN 设置成精确预览域名。不要将真实客户信息用于公开预览。
3. 不需要把 ADMIN_PASSWORD_HASH 配进 Vercel；管理员已初始化，该值仅供一次性初始化脚本使用。
4. `npm run build && npm test`。推送 main 触发 Vercel 发布。保留 Vercel Node Functions 自动识别，Framework Preset 为 Other，输出 dist。
5. 验证游客点击保藏、直接访问 /collection/、/collection/index、/collection/index.html；未登录均不能得到原页面。
6. 验证注册、头像修改、昵称修改、密码更新、退出、管理员权限保存、禁止普通用户查询 /api/account?action=users。
7. 验证各受控页面、图片与脚本资源。请求必须在 Vercel 后端执行，不能只把 dist 复制到纯静态托管。

## 数据库迁移与维护
- `server/schema.sql` 为初始结构。DDL 通过 Supabase SQL Editor / migration 使用数据库拥有者执行；网站的 baox_backend 不具备 DDL 权限。
- 全新数据库首次初始化：使用拥有者连接执行 `npm run db:setup`。已经建好表时，可使用专用连接执行 `node --env-file=.env.production.local scripts/setup-membership.mjs --seed-only`。重复执行不会重置管理员密码。
- 只部署代码不删除数据库，因此注册数据不会被覆盖。
- Supabase 项目应启用适当的数据备份策略。保留业务所需审计，定期清理过期会话和限流项：

```sql
DELETE FROM baox_sessions WHERE expires_at < now();
DELETE FROM baox_limits WHERE expires_at < now();
```

账号注册不包含短信或邮件验证。第一期不提供自动找回密码，身份核实后由管理员通过受控数据库维护重置散列，并删除该用户的所有会话。不要把客户密码明文写入 SQL 或前端文件。

## 权限语义
- 首页始终公开。保藏始终需要登录。
- 其他页面默认维持上线前的公开状态；后台取消“游客”后再按会员级别限制。
- 团队内部成员可以访问所有前台页面；这不等于后台管理员。
- 后台仅 is_admin=true 的活跃账号可查询客户和变更权限。注册和资料更新都不能修改 is_admin 或 tier。
- 权限每次服务端读取，不用前端隐藏按钮冒充鉴权。已经下载到浏览器的数据无法远程收回；新的请求立即执行新权限。

## 验证
测试使用嵌入式真实 PostgreSQL 引擎 PGlite，覆盖账户全流程、服务端会话、越权防护、权限更新、密码轮换、CSRF、限流和构建隔离。桌面1440×960、手机390×844已执行浏览器交互；截图在本机 output/playwright/。

参考：[Vercel Node Functions](https://vercel.com/docs/functions/runtimes/node-js)、[Supabase PostgreSQL 连接](https://supabase.com/docs/guides/database/connecting-to-postgres)、[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)。
