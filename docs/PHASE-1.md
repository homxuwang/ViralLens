# Phase 1 实施与验收计划

目标：在现有文档基础上增加可构建、可加载的 Chrome 扩展骨架。

- [x] 建立 workspace、WXT/React 配置及 lint、类型检查、测试、构建命令。
- [x] 先测试页面分类：博主、笔记、公众号、未知和伪造域名；实现独立 URL 分类模块。
- [x] 建立后台 action 打开 Side Panel、受限平台内容脚本和面板通信；只读取页面标题与 URL，不冒充正文提取。
- [x] 建立六项中文导航，当前页刷新、加载/错误状态和明确的未实现说明。
- [x] 运行全部检查与构建，检查生成 manifest；记录 Chrome 手动加载的验收步骤及未验证事项。

文件职责：`apps/extension/entrypoints` 为浏览器入口，`lib/page-context.ts` 为纯分类逻辑，`components/App.tsx` 中的 refresh 为当前阶段 Chrome 通信，`components/App.tsx` 为界面。业务解析、AI、数据库和 Worker 在后续阶段独立实现。

