# ViralLens

面向小红书、微信公众号和 X 的 AI 内容研究与跨平台创作 Chrome 扩展。采用 WXT、React、TypeScript、Manifest V3 和 pnpm workspace。

当前源码包含页面采集与增量去重、博主统计排名、BYOK 分析创作、图片生成、小红书与公众号互转、X 热帖转公众号、Dexie 本地管理和 Worker/D1 基础接口。需求及复验结果见 `docs/MVP-SCOPE.md` 和 `docs/PROGRESS.md`。

## 本地开发

环境：Node.js 22.16+、pnpm 11.5.2。根目录执行：

```sh
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

生产构建输出：`apps/extension/.output/chrome-mv3`。pnpm workspace 允许 esbuild 必要安装脚本；plugin-react 限制在 5.x 以兼容当前 WXT 的 Vite 7。

## Chrome 安装和手动验收

1. 执行 `pnpm build`。
2. 打开 `chrome://extensions`，启用开发者模式，点击“加载已解压的扩展程序”，选择上述输出目录。
3. 打开小红书主页或微信公众号文章，刷新网页，再点击工具栏 ViralLens 图标，确认侧边栏打开。
4. 点击“刷新识别”，核对页面分类、标题、URL 和“页面脚本已连接”。切换标签页或 SPA 路由后再次刷新识别。
5. 在博主研究页采集笔记，滚动网页后再次采集，核对增量去重、分类、指标缺失和内部相对排序。
6. AI 设置中配置提供商、地址、模型和密钥，保存并授权目标域名，测试真实连接。详情见 `docs/AI-PROVIDERS.md`。
7. 对素材执行分析、改写、视频脚本、双向转换；检查结果后保存到我的内容，验证搜索、删除、Markdown/HTML/TXT 导出和 JSON 备份。图片 API 需独立配置。
8. 测试不支持页面、断网、错误密钥、空内容和窄侧栏；不可把错误或样本不足隐藏为成功。

改写 X 热帖时，先在浏览器打开帖子详情并展开全文。进入「跨平台创作」，采集当前页或粘贴原文，再点击「X 热帖 → 公众号文章」。采集成功时，Markdown 和 HTML 可保留可点击的原帖链接。

通用图文稿可从「当前页面」直接生成。配置 BYOK 文本模型后，打开 X 或小红书帖子详情，点击「一键改写并保存」。稿件、原帖文字和图片链接进入本浏览器的「我的内容」。编辑可保存到同一条记录，发布时可复制正文或导出 Markdown、HTML、TXT。开启兼容的视觉模型后，单次改写最多传入 4 张图片的链接。

## API 与云端状态

BYOK 不需要登录，密钥保存到本地 Chrome storage。配置的文本/图片提供商地址会接收用户主动提交的素材与请求。SaaS 需要自行部署 Worker、D1 并配置服务端密钥及访问令牌；步骤见 `docs/DEPLOYMENT.md`。没有注册、支付或云同步流程。

部署 CLI 的 workerd 下载曾发生镜像超时，因此 Worker 的部署工具采用固定版本 `pnpm dlx wrangler@4.160.0` 按需执行，不影响扩展运行；首次部署仍需下载并联网。Claude/Gemini 当前为文本适配，SaaS 图片与视觉未配置。没有完整视频下载或自动转录。
