# 页面提取

处理 `www.xiaohongshu.com` 的博主主页和笔记、`mp.weixin.qq.com` 的文章，以及 `x.com` 和 `twitter.com` 的帖子详情。内容脚本每次响应读取当前 URL 和 DOM。博主研究支持滚动后重新采集，同一博主的样本按笔记 ID 去重。

博主主页寻找已加载 note-item 卡片；详情提取标题、正文、图片、可见指标和视频源；公众号寻找 activity-name、js_content 等 DOM。缺失互动指标为 null，未识别形式标为 unknown，不能推算收藏、评论、发布时间。

X Adapter 以当前 URL 的帖子 ID 匹配主帖链接，提取可见正文、作者、时间和图片，并将去除查询参数的原帖链接交给改写和导出流程。长帖请先展开全文，也可手动粘贴原文。

选择器仅经 DOM fixture 测试，真实站点可能改版。当前 extractionConfidence 为 low，没有冒充全量历史采集或高置信度。页面无法采集时使用用户手动文本和文件导入。远程图片可因防盗链不可读，视觉 API 需提供商能访问来源 URL。
