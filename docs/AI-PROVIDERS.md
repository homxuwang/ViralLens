# AI 接口配置与限制

BYOK 直接从扩展页向配置的地址发送请求，密钥只保存在 Chrome 本地 storage，不发送到 ViralLens Worker 或 D1。请求前必须通过 AI 设置按钮授权目标域名。

| 提供商 | 地址示例 | API 协议 | 视觉能力 |
| --- | --- | --- | --- |
| OpenAI | https://api.openai.com/v1 | chat/completions | 仅在模型确实支持并手动启用后 |
| Claude | https://api.anthropic.com/v1 | messages | 当前适配器仅文本 |
| Gemini | https://generativelanguage.googleapis.com/v1beta | generateContent | 当前适配器仅文本 |
| DeepSeek | https://api.deepseek.com | chat/completions | 不默认支持 |
| 自定义/自有代理 | 用户自行填写 | OpenAI 兼容 | 根据提供商实际能力 |

Chrome 扩展页通过用户授予的主机权限进行跨域请求，参见 [Chrome 网络请求文档](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)。Claude 浏览器直连要求特殊请求头，已按 [Claude 认证文档](https://platform.claude.com/docs/en/manage-claude/authentication) 加入。文档支持不等于当前账号和网络环境实测成功；所有提供商仍须用实际密钥点击连接测试。

图片使用独立的 OpenAI 兼容 images/generations 地址、密钥和模型。接口须返回 data[].url 或 b64_json。SaaS 图片和视觉服务暂未配置，不能宣称支持。图片 URL 可能到期，重要结果应自行下载保存。

所有文本返回的服务商封装通过 Zod 校验，正文为用户可编辑 Markdown。分析结论不是有固定字段的结构化报告；用户须核对事实、篇幅和证据。OCR 使用支持视觉输入的 OpenAI 兼容模型读取最多前四张已采集图片；没有实现本地 OCR 或完整视频转录。
