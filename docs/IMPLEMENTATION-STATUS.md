# 会员系统交付状态

2026-10-17：实现与云端后端验证完成，正在准备 GitHub 自动部署。

- 源码：/Users/jaydenkong/Documents/WEB/baox-site，分支 feature/membership。
- Supabase：BAOX.AI / baox-membership / nophpwifppexocoxwati，新加坡。
- 管理员 jaydenkong / 公子已初始化，密码仅保存 scrypt 散列。
- Supabase Edge Function membership 已部署。事务切换 baox_backend，仅可操作会员表，TLS 证书验证开启。
- Vercel API 转发到云端服务，不依赖修改原 Vercel 团队的环境变量；通过原 GitHub 集成部署。
- 已实测云端注册、权限防伪、资料、密码轮换、管理员查询、标签与级别、立即停用，以及网站网关的会话转发、页面保护、CSRF 和禁止缓存。
- 云端测试账号已清理；本地浏览器已验证桌面和手机的登录、个人中心和管理后台。
- 部署完成后需核验生产域名的页面路由、资源、登录 Cookie 和权限。

维护说明见 MEMBERSHIP.md。凭据均保存在忽略的本地文件中，不进入静态产物或 Git。
