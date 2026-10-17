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
生产使用 Supabase Edge Function `membership` 连接数据库，Vercel `/api/account` 转发会话请求，`/api/page` 先查询权限再返回受控 HTML。数据库凭据由 Supabase 自动注入，Vercel 无需额外配置数据库环境变量。服务地址是公开 URL，不是密钥；每个敏感操作仍验证用户会话、权限和请求来源。

1. 共享会员服务代码修改后，运行 `node scripts/bundle-membership-edge.mjs`，将 `.local-data/edge-bundle.json` 中的文件部署到 Supabase 的 membership 函数，入口 index.ts，import map deno.json。该服务自行验证会员会话，因此平台 verify_jwt=false。
2. 函数使用平台 SUPABASE_DB_URL，事务内 SET LOCAL ROLE baox_backend。数据库拥有者需授予 postgres 切换到该角色的权限；实际 DML 由受限角色执行。不要将数据库凭据放入函数源码。
3. `npm run build && npm test`。通过 GitHub 推送 main 触发原 Vercel 项目自动部署；Framework 为 Other，输出 dist，保留 Node Functions。
4. 验证游客直接访问 /collection/ 及 index 别名无法获得受控 HTML，注册/登录后才可访问；普通用户不能查询客户 API。
5. 验证个人资料、密码轮换、退出、后台标签/级别/停用与页面权限。会话和受控 HTML 禁止缓存，云端服务不可用时拒绝访问。
6. 请求来源严格限定 https://baox.ai；公开预览域名不能执行生产账号的写操作。生产数据不用于公开预览。

仍支持自托管 Node 的 DATABASE_URL 模式；只有明确设置该变量时才由网站进程直连数据库。网站依赖服务端鉴权，不能仅复制 dist 到纯静态托管。

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
