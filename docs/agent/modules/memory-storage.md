# 模块：记忆与本地存储

## 模块职责

记忆与本地存储负责会话历史、用户设置、长期记忆、模型配置元数据和必要运行日志。

不负责保存 API Key 明文、私密语音样本或不透明的外部 token。

## 公共接口

- 会话 CRUD。
- 消息追加和读取。
- 记忆新增、查看、编辑、删除和禁用。
- 设置读取和保存。
- 当前已提供 `window.arcMind.storage.listConversations/getConversation/getMostRecentConversation/createConversation/renameConversation/deleteConversation/clearConversation`。
- 当前已提供 `window.arcMind.storage.listMemories/createMemory/updateMemory/setMemoryEnabled/deleteMemory`，renderer 只通过 preload 管理记忆，不直接访问 SQLite。

## 数据与状态

- 会话历史和长期记忆必须可被用户查看和删除。
- 记忆写入应尽量保守，避免自动记录敏感内容。
- 数据库 schema 和 migration 必须保持可追踪。
- 当前会话历史使用 SQLite 文件，存放在 Electron `userData` 下，schema 版本记录在 `schema_meta`。
- 当前长期记忆与会话历史共用 SQLite 文件，使用 `memories` 表保存用户手动写入的文本、启用状态和更新时间。
- 当前 `sql.js` 持久化写入通过 repository 内部队列串行落盘，避免并发 IPC 写入时旧快照覆盖新快照。

## 边界规则

- 不把长期记忆静默发送给模型；必须通过上下文策略控制。
- 不在日志中记录完整私密对话。
- 删除记忆后不得继续注入模型上下文。
- v1 只做手动保存记忆，不自动从对话中总结或抽取记忆。

## 验证要求

- repository 单元测试。
- migration 测试。
- 记忆删除、禁用和上下文注入测试。
- 当前已有会话 repository 的 CRUD 与跨实例持久化测试；长期记忆已有 CRUD、禁用、删除和跨实例持久化测试。
