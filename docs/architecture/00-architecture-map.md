---
id: "arcmind-doc-architecture-00-architecture-map"
type: "architecture_rule"
status: "current"
summary: "架构知识《架构内容地图》的当前事实、边界与关联依据。"
scope: ["architecture"]
tags: ["arcmind-v2", "architecture"]
confidence: "high"
last_verified: "2026-08-03"
---

# 架构内容地图

状态：current
最后校验日期：2026-08-03

架构文档回答“系统由什么组成、职责如何分配、数据如何流动、技术如何落地”。

## 上下游

- 上级依据：[产品内容地图](../product/00-product-map.md)、[领域内容地图](../domain/00-domain-map.md)
- 上级入口：[项目文档总索引](../00-index.md)
- 下游实现：[模块内容地图](../modules/00-modules-map.md)、[契约内容地图](../contracts/00-contracts-map.md)
- 约束与验收：[决策内容地图](../decisions/00-decisions-map.md)、[质量内容地图](../quality/00-quality-map.md)

## 总体与端侧

- [系统上下文与总体边界](01-system-context.md)：系统拓扑、信任边界和两条数据路径。
- [手机 Web 端模块](02-mobile-web.md)：用户入口的职责和限制。
- [云端后端模块](03-cloud-backend.md)：身份、会话、任务、记忆和调度中枢。
- [工作机端模块](04-workstation-client.md)：可选本地执行端的权限与连接。
- [产品 Agent Runtime 协作模型](05-agent-runtime.md)：语音、主 Agent 和执行器的运行时协作。

## 数据、安全与工程

- [数据、上下文与记忆边界](06-data-and-memory.md)
- [安全与部署边界](07-security-and-deployment.md)
- [技术选型与决策门禁](08-technology-selection.md)
- [代码仓库与三套可部署应用](09-repository-and-deployable-apps.md)
- [三端架构一致性与风险审查](10-three-end-risk-review.md)
- [数据存储、事务与检索设计](11-data-storage-and-transactions.md)
- [耐久 Job、调度与恢复设计](12-durable-jobs-and-scheduling.md)

## 阅读路径

先读总体边界，再读对应端侧；涉及状态持久化、后台工作或提醒时，继续读取数据事务与耐久调度文档，并核对相关决策和契约。
