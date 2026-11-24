# 数据

本地 IndexedDB 数据库 `virallens`，Dexie version 1：records 表主键 id，索引 kind、createdAt；记录字段 title、body、sourceUrl。保存研究、创作、样本和图片结果。搜索在本地已加载记录中完成；备份导出不含模型密钥。

一键图文改写写入 `kind: quick-rewrite` 的记录，可选 `original` 字段保存原帖快照和图片链接。图片链接仍由原站提供，可能失效。同一稿件编辑后更新原记录。该字段无需修改索引，旧记录仍可读取。

Chrome storage.local 保存提供商配置与密钥，并限制为 TRUSTED_CONTEXTS 访问。密钥在本地未做额外应用层加密；不要在共享浏览器用户配置中使用敏感密钥。用户可单独删除全部本地密钥。

D1 表结构以 `apps/worker/migrations/0001_init.sql` 为准：users、subscriptions、usage_records、payment_events。额度由服务端条件 UPDATE 原子扣减，失败返还。没有客户端充值或支付模拟接口。
