# API

扩展内部消息：`PAGE_CONTEXT` 返回当前页面 URL 和标题；`EXTRACT_PAGE` 返回 `{ok:true,data:ExtractResult}` 或 `{ok:false,error:string}`。只接受相同扩展 id，提取结果在面板使用 Zod 校验。

Worker 接口：

| 方法与路径 | 认证 | 返回 |
| --- | --- | --- |
| GET /health | 无 | 服务存活状态 |
| GET /v1/account | Bearer token | id、credits、订阅基础状态 |
| POST /v1/generate | Bearer token | text、usageId |

生成请求为 `{task,input,images:[]}`。task 为 prompts.ts 中定义的任务，不接受任意属性。素材大小上限约 200000 字符。没有 SaaS 图片、支付或充值 API。

状态码：401 未认证，400 无效输入/服务不可用，413 请求过大，429 配额不足或触发限流，502 提供商失败并退款，503 平台密钥未配置。当前错误正文用于部署诊断，扩展主要展示 HTTP 状态。
