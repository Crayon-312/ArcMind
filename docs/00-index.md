---
id: "arcmind-doc-00-index"
type: "project_fact"
status: "current"
summary: "ArcMind V2 项目知识库的总入口、领域导航和核心阅读路径。"
scope: ["knowledge-base"]
tags: ["arcmind-v2", "knowledge-base"]
confidence: "high"
last_verified: "2026-08-03"
---

# ArcMind V2 项目文档总索引

状态：current
最后校验日期：2026-08-03

本索引是 ArcMind V2 知识网络的总入口，只负责连接各领域内容地图和核心阅读路径。每个领域的完整文件清单、阅读顺序和关系规则由对应内容地图维护，避免总索引成为连接全部文件的扁平中心。

Agent Context OS（智能协作上下文操作系统）的完整开发规则不复制到项目文档；开发工具从仓库根 `AGENTS.md` 和 `.agent-context/config.json` 加载固定版本 Agent，并校验、索引和检索本知识库。

## 知识领域

| 领域 | 回答的问题 | 内容地图 |
|---|---|---|
| 产品 | 为什么做、为谁做、做什么 | [产品内容地图](product/00-product-map.md) |
| 领域 | 核心概念、对象和不变量是什么 | [领域内容地图](domain/00-domain-map.md) |
| 架构 | 系统如何分层、部署和流转数据 | [架构内容地图](architecture/00-architecture-map.md) |
| 模块 | 每个可开发单元负责什么 | [模块内容地图](modules/00-modules-map.md) |
| 业务 | 用户行为如何形成跨模块流程 | [业务内容地图](business/00-business-map.md) |
| 契约 | 手机、云端和工作机如何稳定协作 | [契约内容地图](contracts/00-contracts-map.md) |
| 决策 | 当前取舍为什么成立 | [决策内容地图](decisions/00-decisions-map.md) |
| 计划 | 已批准方案如何按清单落实 | [计划内容地图](plans/00-plans-map.md) |
| 质量 | 什么证据足以进入下一阶段 | [质量内容地图](quality/00-quality-map.md) |
| 项目记忆 | 哪些稳定事实、历史问题和开放问题需要跨任务复用 | [项目记忆内容地图](project-memory/00-project-memory-map.md) |

这些内容地图分别对应 `docs/product/`、`docs/domain/`、`docs/architecture/`、`docs/modules/`、`docs/business/`、`docs/contracts/`、`docs/decisions/`、`docs/plans/` 和 `docs/quality/`，目录用于稳定分类，链接用于表达知识关系。

## 核心知识主链

1. 从[产品背景与愿景](product/01-background-and-vision.md)理解目标与非目标。
2. 用[产品范围与需求](product/02-scope-and-requirements.md)确认首版边界。
3. 通过[统一术语](domain/00-glossary.md)和[核心领域模型](domain/01-core-domain-model.md)建立共同语言。
4. 从[系统上下文与总体边界](architecture/01-system-context.md)进入端侧与基础设施设计。
5. 根据[模块内容地图](modules/00-modules-map.md)和[业务内容地图](business/00-business-map.md)定位职责与流程。
6. 用[契约内容地图](contracts/00-contracts-map.md)确认跨端公开边界。
7. 从[决策内容地图](decisions/00-decisions-map.md)追溯关键取舍。
8. 按[计划内容地图](plans/00-plans-map.md)中的已批准清单执行。
9. 使用[质量内容地图](quality/00-quality-map.md)完成验证与发布闭环。

## Obsidian 与任务隔离

- [知识库首页](README.md)提供人类阅读入口。
- [任务舱模板](templates/task-capsule.md)用于创建单文件方案落实台账。
- [文档附件规则](assets/attachments-guide.md)约束可提交附件和大文件。
- [知识关系分层决策](decisions/0011-knowledge-relationship-model.md)定义分类关系、语义关系和历史关系。
- Git 中的 Markdown（轻量标记文档）是事实源；Obsidian（本地 Markdown 知识库工具）只提供导航、检索和关系图视图。

任务舱不等于 ArcMind 产品运行时的 `Task`。讨论阶段只改草稿状态（`draft`）的任务舱；用户确认后按有序清单实施，验证通过后再把实现、正式文档和项目记忆一起发布。

## Agent 必读顺序

所有涉及产品或架构的任务至少读取：

1. 仓库根 `AGENTS.md`。
2. `.agent-context/config.json` 指定的协作引擎。
3. 本总索引。
4. [产品背景与愿景](product/01-background-and-vision.md)。
5. [产品范围与需求](product/02-scope-and-requirements.md)。
6. [系统上下文与总体边界](architecture/01-system-context.md)。
7. 当前任务对应的领域内容地图、模块、流程、契约、决策和质量文档。

## 状态规则

- 当前有效（`current`）：用户已确认且仍然有效，可以作为开发依据。
- 结构化草稿（`draft`）：必须确认后才能作为实现依据。
- 分析假设（`assumption`）：用于推进分析，必须验证。
- 开放问题（`open`）：存在明确待决事项。
- 已废弃（`deprecated`）：只用于历史追溯。

## 更新规则

- 产品定位或范围变化：更新产品内容地图下的事实、相关决策、计划和项目记忆。
- 领域概念或状态变化：同步检查业务流程、模块、数据架构和契约。
- 端侧职责或依赖变化：同步检查系统架构、模块卡片、跨端契约和质量标准。
- 技术选型只有通过[技术选型与决策门禁](architecture/08-technology-selection.md)后才能成为当前事实。
- 新增正式文档必须进入一个领域内容地图；当前有效文档不得成为关系孤岛。
- 可复用项目记忆直接存入 `project-memory/` 的 Obsidian Markdown；不得恢复独立 JSONL 记忆源。
