# Cloudflare Workers + D1

后端提供令牌认证、账户状态、服务端配额和调用记录；当前没有登录注册界面、支付、订阅购买、云同步或 SaaS 图片服务。

1. 安装依赖后，在 `apps/worker` 登录 Cloudflare：`pnpm dlx wrangler@4.160.0 login`。
2. 创建数据库：`pnpm dlx wrangler@4.160.0 d1 create virallens`，把返回的 database_id 写入 wrangler.toml。
3. 应用迁移：`pnpm dlx wrangler@4.160.0 d1 migrations apply virallens --remote`。
4. 设置服务端提供商密钥：`pnpm dlx wrangler@4.160.0 secret put AI_KEY`。在 wrangler.toml 配置 AI_ENDPOINT、AI_MODEL。
5. 管理员自行生成高熵访问令牌，计算其 SHA-256 十六进制哈希，将用户 id、token_hash、credits 写入 users。只向该用户提供原始令牌，不存明文令牌。没有开放注册和充值接口，客户端不能修改服务端额度。
6. 部署：`pnpm deploy`。在扩展 AI 设置中填写 Worker URL 和访问令牌，选择 SaaS 并授权该域名。
7. `GET /health` 检查服务；`GET /v1/account` 返回账户余额及订阅基础状态；`POST /v1/generate` 接受 task、input、images（当前 images 必须为空）。后两个接口均要求 Bearer 令牌。

每次生成扣 1 次调用额度，提供商失败时返还。不是按 token 计费；模型费用由平台账户承担。当前限流是每用户近一分钟最多 10 条调用记录。缺少余额或触发限流返回 429。没有支付模拟流程。

尚未部署或以真实账号验证，不应据本地构建宣称线上服务可用。上线前应配置实际域名、备份、监控和令牌管理；这些运维配置不属于当前自动部署结果。
