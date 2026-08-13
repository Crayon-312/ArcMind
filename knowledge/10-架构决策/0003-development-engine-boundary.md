---
id: "arcmind-doc-decisions-0003-development-engine-boundary"
type: "decision"
status: "current"
summary: "Agent Context OS 只治理仓库开发协作，不进入 ArcMind 产品 Agent、语音或工作机运行链路。"
scope: ["decisions"]
tags: ["arcmind-v2", "decisions"]
confidence: "high"
last_verified: "2026-07-30"
---

# 决策 0003：开发协作引擎与产品运行时分离

状态：accepted
日期：2026-07-30

## 关系导航

- 所属领域：[决策内容地图](./00-架构决策地图.md)
- 产品运行时：[产品 Agent Runtime 协作模型](../20-Agent运行时/01-产品Agent运行时协作模型.md)
- 协作发布：[Obsidian 知识库与任务隔离发布](./0010-obsidian-task-publication.md)
- 落实台账：[ArcMind V2 文档基线](../14-开发方案/0001-v2-documentation-foundation.md)

## 背景

ArcMind V2 未来会包含产品主 Agent、任务编排器和工作机执行器。同时，本仓库使用 Agent Context OS 规范 Codex 等开发工具的工作方式。两者都可能被简称为 Engine 或 Agent，容易造成架构混淆。

## 决策

- Agent Context OS 是外部开发协作引擎，只管理开发上下文、方案、门禁和任务报告。
- ArcMind Agent Runtime 是产品运行时，只处理最终用户对话、记忆、任务编排和执行。
- V2 采用 Agent Context OS 的极薄启动器模式，只保存 `AGENTS.md`、配置、项目记忆和检查入口。
- 不把 Agent Context OS 文档和内部实现复制进产品代码，也不在产品部署中启动它。
- 文档和代码命名必须明确使用“开发协作”或“产品运行时”限定语。

## 结果

- 开发规范可独立升级，不影响产品运行协议。
- 产品主 Agent 可以自由选择运行时框架，不被仓库协作工具绑定。
- 开发工具必须同时理解外部规则和当前项目事实，不能只读其中之一。
