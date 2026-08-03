# 决策内容地图

状态：current
最后校验日期：2026-08-03

决策文档记录已经接受的重要取舍、替代方案和结果，解释当前产品与架构为什么如此设计。

## 上下游

- 上级入口：[项目文档总索引](../00-index.md)
- 主要约束：[产品内容地图](../product/00-product-map.md)、[架构内容地图](../architecture/00-architecture-map.md)
- 落实记录：[计划内容地图](../plans/00-plans-map.md)

## 项目与协作边界

- [决策 0001：V2 作为独立长期开发线](0001-v2-independent-line.md)
- [决策 0003：开发协作引擎与产品运行时分离](0003-development-engine-boundary.md)
- [决策 0010：Obsidian 知识库与任务隔离发布](0010-obsidian-task-publication.md)
- [决策 0011：知识关系分层模型](0011-knowledge-relationship-model.md)

## 产品拓扑与工程组织

- [决策 0002：云端中枢与可选工作机拓扑](0002-cloud-centered-topology.md)
- [决策 0004：单仓库管理三套独立应用](0004-three-app-monorepo.md)
- [决策 0007：跨端工程与工作机基线](0007-engineering-baseline.md)

## 技术栈

- [决策 0005：云端与产品主 Agent 技术栈](0005-cloud-agent-runtime-stack.md)
- [决策 0006：手机 Web 技术栈](0006-mobile-web-stack.md)
- [决策 0008：主数据库与持久化技术栈](0008-primary-data-stack.md)
- [决策 0009：耐久 Job 与提醒调度技术栈](0009-durable-job-stack.md)

## 关系规则

- 每项接受的决策必须连接其约束的正式文档和对应落实台账。
- 决策被替代时保留历史，并从当前内容地图指向替代决策。
