# 会员系统交付状态

2026-10-17：代码、Supabase 数据库和本地交互已完成，尚未发布生产。

- 源码目录：/Users/jaydenkong/Documents/WEB/baox-site
- 分支：feature/membership
- Supabase 项目：nophpwifppexocoxwati / baox-membership，新加坡，BAOX.AI 组织。
- 生产管理员已初始化：jaydenkong，昵称公子，team + is_admin。
- 生产数据库专用角色已配置，仅会员表有权限，TLS 与证书验证已实际通过。
- 数据库密码、生产连接、管理员密码散列都只存在被 Git 忽略的本地文件；发布时仅将 DATABASE_URL 及 SITE_ORIGIN 传入 Vercel 服务端环境。
- 功能测试9组通过；桌面和手机浏览器已验证，Supabase 安全检查无告警。
- 当前 Vercel 集成身份 jaydenkong777-9386；不带 teamId 的项目列表为空，访问其默认团队 team_rGLzQitSvDvzoejqvnstyBKI 返回403 Forbidden。未向线上 main 推送本功能，避免未配置数据库的部署替换现网。

待继续：确认原 baox.ai 项目的 Vercel 团队与项目访问权限；将生产数据库连接配置到该项目，部署预览并验证真实路由/资源/鉴权，再推送 main 和核验生产。

操作说明见 MEMBERSHIP.md。生产数据不包含本地体验账户。
