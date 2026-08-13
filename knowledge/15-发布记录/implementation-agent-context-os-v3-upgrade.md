---
id: "arcmind-implementation-agent-context-os-v3-upgrade"
type: "implementation_note"
status: "current"
summary: "ArcMind 已固定 Agent Context OS 0.2.0 的 fd84369 提交，122 条 Obsidian 知识可校验、索引和按状态检索。"
scope: ["development", "knowledge-base", "local-index"]
tags: ["arcmind-v2", "implementation", "agent-context-os", "obsidian", "search"]
confidence: "high"
last_verified: "2026-08-13"
---

# Agent Context OS schema 3 升级实现事实

ArcMind 开发协作层以工作区开发依赖固定 Agent Context OS 0.2.0 上游提交 `fd84369ae9fd1d88df222d18a8519fba87592f4e`。`.agent-context/config.json` 只配置一个 `docs/` Obsidian 来源，本地索引写入被 Git 忽略的 `.agent-context/local-index/index.json`。

## 已验证行为

- `validate` 从唯一来源加载全部知识，核心字段、枚举、唯一 ID、敏感标记和索引路径保护通过。
- `index` 可以删除后重建，不依赖旧 JSONL 文件。
- `search` 能定位产品定位、云端与工作机边界、历史迁移根因，并按 `draft`、`deprecated` 等状态过滤。
- 项目门禁能阻止 schema 1、旧 `engine`、`memory.source_paths`、旧索引 provider 和 `.agent-context/memory-sources/` 复活。

## 证据

- [升级决策](../10-架构决策/0016-agent-context-os-v3-obsidian-source.md)
- [升级任务舱](../14-开发方案/0013-agent-context-os-v3-upgrade.md)
- [文档基线验收](../11-测试与验收/01-documentation-acceptance.md)
- [项目记忆内容地图](../99-归档/旧项目记忆/00-project-memory-map.md)
