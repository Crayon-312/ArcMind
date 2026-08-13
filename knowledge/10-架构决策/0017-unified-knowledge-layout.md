---
id: "arcmind-decision-0017-unified-knowledge-layout"
type: "decision"
status: "current"
summary: "ArcMind 将 knowledge 作为统一知识根，00-15 固定软件工程职责、20-79 登记产品专属领域，归档不进入当前检索。"
scope: ["knowledge-base", "architecture", "collaboration"]
tags: ["knowledge-layout", "obsidian", "agent-context"]
confidence: "high"
last_verified: "2026-08-13"
---

# 决策 0017：统一知识库目录与职责

状态：accepted
日期：2026-08-13

## 关系导航

- 所属领域：[架构决策地图](./00-架构决策地图.md)
- 上级规则：[知识库维护规范](../00-入口/知识库维护规范.md)
- 既有基础：[Obsidian 知识库与任务隔离发布](./0010-obsidian-task-publication.md)、[知识关系分层模型](./0011-knowledge-relationship-model.md)
- 落实任务：[统一知识库结构完整迁移](../14-开发方案/0014-unified-knowledge-vault-migration.md)
- 验收标准：[知识库与文档基线验收](../11-测试与验收/01-documentation-acceptance.md)

## 背景

ArcMind 与其他项目使用不同知识根和领域名称，会增加人类学习成本，并让 Agent（智能协作助手）必须为每个仓库重新猜测入口、前后端、数据、运行和任务位置。旧 `project-memory/` 又重复复述正式事实，存在两处内容不同步的风险。

## 决策

- 所有项目统一使用 `knowledge/` 作为 Obsidian（本地 Markdown 知识库工具）根目录。
- `00-15` 固定软件工程公共知识职责；项目具备对应能力时必须创建目录和唯一领域地图。
- `20-79` 只用于在总地图登记的项目专属领域，不得改变公共编号含义。
- 模块文档跟随前端、后端或项目专属责任主体归档，不建立会重复事实的通用“模块设计”一级目录。
- `90-模板`、`99-归档` 和 `_attachments` 是固定保留区；任务舱位于 `14-开发方案`，四者不进入当前正式知识索引。
- 稳定事实直接存在对应领域，决策、开放问题和发布记录各归其位，不再额外复制项目记忆摘要。
- 每个当前知识必须进入所属领域地图、具有语义关系并通过自动门禁；摘要必须表达真实结论。

## 结果

- 人类可以在不同项目中使用相同的目录心智模型。
- Agent 能从固定入口和领域地图检索当前事实，归档不会干扰默认结果。
- 前端、后端、接口、数据和运行知识成为明确职责，不再埋在总架构目录中。
- 历史迁移记录仍可追溯，但不会与当前正式事实竞争权威性。
