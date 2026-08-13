---
id: "arcmind-decision-0016-agent-context-os-v3-obsidian-source"
type: "decision"
status: "current"
summary: "ArcMind 开发协作层使用 Agent Context OS schema 3，并以 knowledge Obsidian Vault 作为唯一当前项目知识源。"
scope: ["development", "knowledge-base", "agent-context"]
tags: ["arcmind-v2", "decision", "agent-context-os", "obsidian", "schema-3"]
confidence: "high"
last_verified: "2026-08-13"
---

# 决策 0016：完整使用 Agent Context OS schema 3 与 Obsidian 唯一知识源

状态：accepted
日期：2026-08-13

## 关系导航

- 所属领域：[决策内容地图](./00-架构决策地图.md)
- 上游边界：[开发协作引擎与产品运行时分离](./0003-development-engine-boundary.md)
- 知识库基础：[Obsidian 知识库与任务隔离发布](./0010-obsidian-task-publication.md)
- 落实台账：[Agent Context OS 新版完整升级](../14-开发方案/0013-agent-context-os-v3-upgrade.md)
- 验收标准：[V2 文档基线](../11-测试与验收/01-documentation-acceptance.md)

## 背景

ArcMind 原有 `docs/` 曾具备 Obsidian 知识网络，但旧 schema 1 只把独立 JSONL 文件声明为项目记忆源，Agent 无法直接校验、索引和搜索正式文档。Agent Context OS 0.2.0 提供了可执行的 Obsidian 只读运行层；统一知识结构迁移后，当前唯一根目录改为 `knowledge/`。

## 决策

- 项目配置只使用 schema 3 的 `agent`、`memory.sources` 和 embedded-json 本地索引。
- `knowledge/` 是唯一 Obsidian 项目知识源；正式知识使用稳定 ID、类型、状态和能表达结论的摘要。
- 旧 JSONL 记忆迁移历史保存在 `99-归档/旧项目记忆/`，不再与正式领域形成双重事实源。
- `14-开发方案`、`90-模板`、`99-归档` 和 `_attachments` 保留在 Vault 中，但排除出正式知识索引，避免任务、历史与当前知识状态混用。
- Agent Context OS 通过固定提交的开发依赖加载，ArcMind 仓库不复制完整引擎源码。
- 本地索引只负责定位上下文，可以删除重建，不进入 Git，也不替代知识原文、代码、测试或用户确认。

## 结果

- 人类和 Agent 使用同一套 Git 可审查 Markdown 事实。
- 新任务必须先搜索项目知识并读取命中证据，不再只依赖聊天上下文或单独摘要文件。
- 项目门禁阻止旧 schema、旧字段、旧 JSONL 目录和旧索引 provider 再次出现。
- 协作层升级不进入 ArcMind 产品运行时，也不要求部署或重启产品服务。
- 统一目录职责、关系与归档规则由[统一知识库结构决策](./0017-unified-knowledge-layout.md)继续约束。
