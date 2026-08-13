---
id: "arcmind-doc-quality-01-documentation-acceptance"
type: "project_fact"
status: "current"
summary: "知识库验收要求统一目录、合法元数据、零断链、零当前孤岛、任务隔离和可重建检索同时通过。"
scope: ["quality", "knowledge-base"]
tags: ["documentation", "acceptance", "knowledge-graph"]
confidence: "high"
last_verified: "2026-08-13"
---

# 验收口径：知识库与文档基线

## 关系导航

- 所属领域：[测试与验收地图](./00-测试与验收地图.md)
- 知识入口：[知识库总地图](../00-入口/00-知识库总地图.md)
- 目录决策：[统一知识库目录与职责](../10-架构决策/0017-unified-knowledge-layout.md)
- 关系决策：[知识关系分层模型](../10-架构决策/0011-knowledge-relationship-model.md)
- 落实任务：[统一知识库结构完整迁移](../14-开发方案/0014-unified-knowledge-vault-migration.md)
- 检索加固：[知识事实与检索质量加固](../14-开发方案/0015-knowledge-retrieval-quality-hardening.md)
- 自动检查：`scripts/check-agent.ps1`

## 验收标准

| 编号 | 标准 | 验证方式 |
|---|---|---|
| KA-001 | `knowledge/` 是唯一 Obsidian 知识根，旧 `docs/` 不得复活 | 配置检查与项目门禁 |
| KA-002 | `00-15` 公共编号和 `20-79` 登记领域不得改变职责 | 顶层目录白名单检查 |
| KA-003 | 每个启用的正式领域具有唯一 `00-*-地图.md` | 领域地图门禁 |
| KA-004 | 当前正式文档必须被所属领域地图收录 | 地图出链检查 |
| KA-005 | 当前正式知识不得成为关系孤岛 | 全库关系度检查 |
| KA-006 | Markdown 内部链接目标全部存在 | 断链检查 |
| KA-007 | 正式知识具有唯一 ID、合法类型、状态和真实结论摘要 | Agent Context OS 校验与摘要门禁 |
| KA-008 | `14-开发方案` 的编号任务具备任务类型、状态、ID 和变更等级 | 任务舱门禁 |
| KA-009 | `active` 或 `confirmed` 任务具有有序任务清单 | 任务舱正文检查 |
| KA-010 | `14-开发方案`、`90-模板`、`99-归档` 和 `_attachments` 不进入当前索引 | 配置排除项与索引数量检查 |
| KA-011 | 本地索引被 Git 忽略且能删除后重建 | `.gitignore` 与 `pnpm context:index` |
| KA-012 | 固定查询能命中产品边界、前后端职责、任务隔离、历史根因和运行手册 | `pnpm context:search` |
| KA-013 | OpenAPI 迁移不破坏类型生成、测试和容器构建 | `pnpm check` 与云端测试 |
| KA-014 | Obsidian 默认关系图排除归档与模板噪声，并按知识域分组 | 检查 `.obsidian/graph.json` 与实际打开效果 |
| KA-015 | 个人工作区、插件、主题和缓存不进入 Git | `.gitignore` 与 `git status` |
| KA-016 | 标准 Markdown 内部关系进入索引，任务舱与归档保持排除 | 索引 `links` 统计与路径检查 |
| KA-017 | 默认检索优先当前事实且结果显示状态，显式 `--status draft` 仍可检索草稿 | 固定查询与状态过滤 |
| KA-018 | 当前知识引用非开放问题草稿时必须在链接文字中显示状态 | 项目跨状态关系门禁 |
| KA-019 | 讨论权限、当前登录方式与迁移状态、生产模型和 API 变更查询的第一命中直接回答问题 | 固定真实查询 |

## 失败处理

任何检查失败时必须记录失败文件、实际输出、期望结果和修正方式。不得通过删除门禁、扩大排除范围或把未确认内容改成 `current` 来让检查通过。
