---
id: "arcmind-decision-0016-agent-context-os-v3-obsidian-source"
type: "decision"
status: "current"
summary: "ArcMind 开发协作层完整使用 Agent Context OS schema 3，并以 docs Obsidian Vault 作为唯一项目知识源。"
scope: ["development", "knowledge-base", "agent-context"]
tags: ["arcmind-v2", "decision", "agent-context-os", "obsidian", "schema-3"]
confidence: "high"
last_verified: "2026-08-13"
---

# 决策 0016：完整使用 Agent Context OS schema 3 与 Obsidian 唯一知识源

状态：accepted
日期：2026-08-13

## 关系导航

- 所属领域：[决策内容地图](00-decisions-map.md)
- 上游边界：[开发协作引擎与产品运行时分离](0003-development-engine-boundary.md)
- 知识库基础：[Obsidian 知识库与任务隔离发布](0010-obsidian-task-publication.md)
- 落实台账：[Agent Context OS 新版完整升级](../plans/0013-agent-context-os-v3-upgrade.md)
- 验收标准：[V2 文档基线](../quality/01-documentation-acceptance.md)

## 背景

ArcMind 原有 `docs/` 已具备 Obsidian 知识网络，但旧 schema 1 只把独立 JSONL 文件声明为项目记忆源，Agent 无法直接校验、索引和搜索正式文档。Agent Context OS 0.2.0 已提供可执行的 Obsidian 只读运行层。

## 决策

- 项目配置只使用 schema 3 的 `agent`、`memory.sources` 和 embedded-json 本地索引。
- `docs/` 是唯一 Obsidian 项目知识源；正式知识使用稳定 ID、类型、状态和摘要。
- 旧 JSONL 记忆完整迁移为 `docs/project-memory/` 下的独立 Markdown 后删除，不保留兼容 provider 或备用目录。
- `plans/`、`templates/` 和 `assets/` 保留在 Vault 中，但排除出正式知识索引，避免任务生命周期与知识状态混用。
- Agent Context OS 通过固定提交的开发依赖加载，ArcMind 仓库不复制完整引擎源码。
- 本地索引只负责定位上下文，可以删除重建，不进入 Git，也不替代知识原文、代码、测试或用户确认。

## 结果

- 人类和 Agent 使用同一套 Git 可审查 Markdown 事实。
- 新任务必须先搜索项目知识并读取命中证据，不再只依赖聊天上下文或单独摘要文件。
- 项目门禁阻止旧 schema、旧字段、旧 JSONL 目录和旧索引 provider 再次出现。
- 协作层升级不进入 ArcMind 产品运行时，也不要求部署或重启产品服务。
