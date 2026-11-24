# 架构

Chrome MV3 / WXT / React / strict TypeScript，pnpm workspace。由 Side Panel 发起采集与 AI 操作，内容脚本读取小红书、微信公众号和 X 的当前 DOM，扩展页向用户配置的模型端点发送请求。

`extractors` 提供统一 PlatformExtractor 和三种 Adapter，`models` 负责 Zod 数据边界，`research` 负责去重排序，`prompts` 管理各创作任务，`ai` 适配提供商并校验响应，`storage` 使用 Dexie。

BYOK 的文本、视觉和图片请求直达用户指定地址；可选 SaaS 请求只发送素材和任务，用户 BYOK Key 不上传。Worker 仅使用平台服务端 AI_KEY。D1 保存令牌哈希、配额和调用状态，不保存素材正文。

当前范围以 `MVP-SCOPE.md` 为准。扩展其他平台时通过 PlatformExtractor 新增 Adapter。
