---
id: "arcmind-agent-runtime-map"
type: "architecture_rule"
status: "current"
summary: "产品主 Agent 负责理解、规划和工具提议，任务编排器与领域服务维护授权、执行和业务事实。"
scope: ["agent-runtime"]
tags: ["agent-runtime", "knowledge-map"]
confidence: "high"
last_verified: "2026-08-13"
---

# Agent 运行时地图

- [产品 Agent 运行时协作模型](./01-产品Agent运行时协作模型.md)：交互层、主 Agent、编排器、工具和执行器边界。
- [主 Agent 运行时模块（草案）](./02-主Agent运行时模块.md)：模块职责、输入输出和依赖。
- [产品记忆与上下文地图](../24-产品记忆与上下文/00-产品记忆与上下文地图.md)：检索和记忆事实来源。
- [任务与提醒地图](../23-任务与提醒/00-任务与提醒地图.md)：任务事实与执行生命周期。
- [首个主 Agent 模型决策](../10-架构决策/0015-first-model-provider.md)：模型适配取舍。

本文域属于 ArcMind 产品运行时，与开发仓库使用的 Agent Context OS（智能协作上下文操作系统）严格分离。
