# 开发进度

## 2026-11-26 验收复核与 MVP 体验缺口补齐

- 经用户确认：保留 X 热帖改写与本地一键图文改写，先补齐 MVP 体验级缺口再进行真实环境验收。
- **博主研究排序、日期筛选与模块一对齐**：在 `apps/extension/extractors/index.ts` 与 `apps/extension/lib/models.ts` 补齐博主头像提取与常见卡片选择器；在 `apps/extension/lib/research.ts` 新增 `parsePublishedTime`、`filterAndSortNotes` 与 `summarizeSamples`；在 `apps/extension/components/Workspace.tsx` 补齐博主资料卡（头像/昵称/简介/主页链接）、20–50 篇样本目标提示、缺失字段统计、按赞/藏/评/发布时间/相对分排序与日期区间筛选；在 `apps/extension/lib/prompts.ts` 对齐模块一 2.2 要求的全部 15 项分析报告维度。
- **Markdown → 公众号 HTML 导出增强**：在 `apps/extension/lib/export.ts` 升级 `toHtml`，支持 `#`~`####` 标题、无序/有序列表、多行引用、分隔线、代码块、加粗/斜体/行内代码、安全 `https?://` 链接与图片渲染，保持 XSS 转义与 `javascript:` 协议拦截。
- **公众号转小红书可点击选题**：新增 `apps/extension/lib/topics.ts` 解析多角度选题，优化 `apps/extension/lib/prompts.ts` 选题格式提示；在「跨平台创作」中生成选题后自动渲染可点击选题卡片，点击选中后直接带入「选中主题 → 小红书笔记」。
- **GitHub Actions 自动校验与打包**：新增 `.github/workflows/release-extension.yml` 与 `pnpm zip` 脚本，在推送/PR/手动触发时先执行类型检查、Lint 和单元测试，全部通过后自动构建并打包为 Chrome MV3 发布包 `virallens-0.1.0-chrome.zip` 上传至 Actions Artifact；推送 `v*` 标签时自动发布到 GitHub Release。
- **本地自动化验证**：扩展与 Worker TypeScript 检查、`pnpm lint`、39 项 Vitest 单测（5 文件）与 `pnpm zip` 均通过。
- **仍待真实环境验收**：真实登录态小红书/公众号/X 网页 DOM 采集、真实 BYOK 模型凭证调用（文本/视觉/图片）、Cloudflare Workers + D1 云端部署（`wrangler.toml` 的 `database_id` 仍为占位符）。

## 浏览器本地一键图文改写

- 「当前页面」添加 X 和小红书图文帖的一键改写。点击后核对当前帖子，采集可见正文，以配置好的 BYOK 模型生成通用中文图文稿，成功后自动存入 IndexedDB 并打开编辑页。兼容视觉模型可读取最多 4 张来源图片。
- 稿件保存原帖来源、文字和图片链接。修改后更新同一条记录，可复制或导出 Markdown、HTML、TXT 供后续发布。热点由用户选帖。
- 30 项 Vitest 测试、扩展类型检查、ESLint 和生产构建通过。隔离 Chromium 用测试页面与模拟 BYOK HTTP 响应验证了两平台一键改写、图片请求参数、本地持久化、原记录更新与导出。实际页面和真实模型响应仍待实测。

## 2026-11-24 X 热帖改写与功能复验

- 新增 X 帖子详情识别和可见正文采集。在「跨平台创作」中选择「X 热帖 → 公众号文章」，可用采集结果或手动粘贴的原文生成中文稿件。正文、作者和原帖链接可交给模型，采集到的链接随稿件保存并可在 HTML/Markdown 中打开。X 热帖由用户选定。
- 修复两处浏览器问题。首页可以从内容脚本读取缺少标签页 URL 权限的支持页面。博主增量采集只合并同一博主主页的样本，避免把前一次 X 帖子或另一位博主的笔记带入研究。
- `pnpm lint`、扩展与 Worker TypeScript 检查、25 项 Vitest 测试和 `pnpm build` 均通过。MV3 产物在 `apps/extension/.output/chrome-mv3`。构建有两条来自 Zod 的 Rollup 注释警告。
- 在独立 Chromium 中加载实际扩展并用测试页面、模拟模型响应走通 X 改写、博主研究、单篇分析、创作、脚本、图片、双向转换、保存、搜索、导出、删除和密钥删除，共截获 10 次模型请求。Worker 通过本地 SQLite 迁移和处理器检查，覆盖鉴权、X 改写分发、扣额、失败返还与零余额。
- 真实站点探测未通过正文提取。X 帖子请求返回网络响应错误，小红书样本跳转不可浏览页或超时，公众号样本加载超时。缺少实际模型凭证，本次未确认文本、视觉或图片的真实模型响应。D1 配置仍为占位，云端验收待部署。

| 核对项 | 当前开发缺口 |
| --- | --- |
| X | 当前为选帖改写。自动发现和排序热点未开发。 |
| 博主研究 | 已支持类型筛选、最低相对分、按赞/藏/评/发布时间排序及日期筛选。固定字段结构化报告校验与真实主页 DOM 实测尚缺。 |
| 单篇视频与图文 | 视频可用可见内容及用户粘贴的字幕。自动读取可见字幕和转录未开发。OCR 依赖 OpenAI 兼容视觉端点。 |
| 公众号转小红书 | 已支持多选题拆解与可点击选题卡片选中后生成。结构化稿件校验与真实公众号 DOM 实测尚缺。 |
| 小红书转公众号 | 已支持大纲/全文与常用 Markdown 转安全 HTML 导出。真实模型与粘贴公众号编辑器实测尚缺。 |
| BYOK | 已有文本连接测试。模型能力自动检测尚缺，视觉能力由用户配置；尚缺真实凭证实测。 |
| SaaS | 已有文本代理、配额和基础账户接口。SaaS 图片、视觉尚未实现，会员与订阅是基础表结构；D1 尚未部署。 |
| 发布 | 已有 MV3 构建目录。英文界面、隐私政策草稿和商店发布尚缺。 |

## 2026-11-12 持续实施（验收延后）

按用户最新要求：继续实现全部冻结功能，最终统一验收；中间保留必要自动检查。

- Phase 2：已加入小红书博主卡片/详情、公众号文章 DOM Adapter、缺失值标记、手动滚动后增量采集和去重。真实平台 DOM 测试待最终验收。
- Phase 3：已加入图文/视频分类统计、同账号同类型相对排名、筛选、赛道定位/可模仿性研究模型调用入口。
- Phase 4：已加入文本分析、原创标题正文、视频口播分镜、图片接口、视觉模型 OCR 入口。仅支持读取可见视频信息及用户提供字幕，不下载转录视频。
- Phase 5：已加入公众号 DOM 提取、双向转换、选题/大纲分步生成、用户可编辑文本、HTML/Markdown/TXT 导出及复制。
- BYOK：配置本地保存、修改删除、连接测试、域名授权；OpenAI/兼容、DeepSeek、Claude、Gemini 文本适配，独立 OpenAI 兼容图片接口。尚无真实凭证调用验证。
- 本地管理：Dexie 保存样本/研究/创作/图片记录、加载、搜索、删除和 JSON 备份导出。复杂知识库和研究项目系统未开发。
- SaaS：Worker/D1 迁移及令牌哈希认证、配额扣减/失败返还、调用记录和账户基础接口；未部署。登录注册 UI、真实支付、订阅购买和同步不在当前冻结交付范围。
- 限制：视觉仅 OpenAI 兼容；Claude/Gemini 当前仅文本。SaaS 图片/视觉服务未配置。报告为 Markdown，未实现固定字段结构化报告验证。远程图片记录可能过期。
- 最近检查：19 项测试通过；扩展 TypeScript、Worker TypeScript、ESLint 均通过；最新生产构建通过，产物约 454 kB。Rollup 对 Zod 依赖有两条注释注解处理警告，无构建错误。
- 依赖恢复：部署 CLI 的 workerd 下载超时，已改为固定版本按需执行；workspace 依赖已从缓存恢复安装，锁文件已更新。
- 代码：`extractors/`、`lib/models.ts`、`research.ts`、`storage.ts`、`ai.ts`、`prompts.ts`、`export.ts`、`components/Workspace.tsx`、`apps/worker/`。
- 下一步：统一执行真实浏览器/模型/部署验收；需要可访问的平台页面、用户在扩展中配置的有效模型密钥，以及可选 Cloudflare 账号和数据库配置。当前不能声称真实页面、模型调用或云端部署已通过。

## Phase 0：完成

- 已检查项目：工作目录为空，尚未初始化 Git。
- 开发环境：Node.js v22.16.0、pnpm 11.5.2、Git 2.29.2.windows.2。
- 已完成：确定阶段计划、验收条件和主要风险。
- 代码文件：尚无。
- 测试结果：Phase 0 无可执行代码；尚未运行类型检查、lint、测试或构建。
- 尚未完成：扩展、解析器、AI、内容库、云端和最终验收。
- 外部依赖：后续需要真实 AI 提供商配置；云端部署需要 Cloudflare 账号。
- 已知问题：尚无可运行产品；真实平台页面结构需在实现时验证。
- 下一阶段：初始化 pnpm/WXT/React/TypeScript 并交付可安装的 Side Panel 骨架。

## Phase 1：代码与构建完成，Chrome 交互验收待执行

- 实施日期：2026-11-12。
- 已完成：pnpm workspace、WXT/React/严格 TypeScript、MV3 后台、Side Panel 六项导航、平台受限内容脚本、页面 URL 分类和标题通信、手动刷新、加载/失败提示。
- 主要文件：`apps/extension/entrypoints/`、`components/App.tsx`、`lib/page-context.ts`、根目录配置与锁文件。
- 验证：`pnpm typecheck` 通过；`pnpm lint` 通过；`pnpm test` 8/8 通过；`pnpm build` 通过，产物约 235 kB。
- 已核对生成 manifest：MV3、service worker、side_panel、两个平台的 content script；仅 sidePanel 与 activeTab 权限。
- 已修复：plugin-react 6 与 Vite 7 不兼容，约束 plugin-react 5；pnpm 安装允许 esbuild 必要脚本。
- 未验证：真实 Chrome 加载、action 打开面板、真实平台脚本通信和窄屏视觉验收。步骤见 README，不能据构建成功宣称这些已通过。
- 尚未实现：笔记/文章正文提取、增量采集、研究统计、AI 分析与生成、双向转换、导出、本地库、BYOK、Worker/D1。页面均明确标记状态。
- 外部依赖：Phase 1 不需要模型密钥或 Cloudflare 账号。
- 下一阶段：先完成 Chrome 手动验收，再进入 Phase 2 平台 Adapter、真实页面提取、增量去重及必要本地保存。
