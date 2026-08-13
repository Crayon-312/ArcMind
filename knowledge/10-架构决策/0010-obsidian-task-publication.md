---
id: "arcmind-doc-decisions-0010-obsidian-task-publication"
type: "decision"
status: "current"
summary: "非平凡任务先在隔离任务舱获批，再按有序清单实施，验证后代码和正式知识一起发布。"
scope: ["decisions"]
tags: ["arcmind-v2", "decisions"]
confidence: "high"
last_verified: "2026-08-03"
---

# 决策 0010：Obsidian 知识库与任务隔离发布

状态：accepted
日期：2026-08-03

## 关系导航

- 所属领域：[决策内容地图](./00-架构决策地图.md)
- 知识库入口：[ArcMind V2 知识库](../00-入口/知识库首页.md)
- 后续细化：[知识关系分层模型](./0011-knowledge-relationship-model.md)
- 落实台账：[Obsidian 知识库与任务隔离](../14-开发方案/0007-obsidian-task-isolation.md)

## 背景

ArcMind V2 需要把项目知识与业务代码清晰分层，同时让人类和 Agent（智能协作助手）都能检索 Markdown 文档。直接允许 Agent 在分析或方案讨论阶段修改正式文档，会把未确认推断错误发布为项目事实；为所有任务机械创建 Git worktree（Git 独立工作树）又会增加目录、分支和清理成本。

## 决策

- 将 `knowledge/` 作为 Obsidian（本地 Markdown 知识库工具）Vault（知识库目录），Git 中的 Markdown 仍是唯一事实源。
- 每个非平凡任务在 `knowledge/14-开发方案/` 使用一个 Markdown 方案落实台账作为隔离任务舱，不额外创建任务目录、数据库或后台服务。
- 任务舱采用 `draft → confirmed → active → done` 状态门禁；讨论阶段不得改正式文档、代码和配置，只有用户批准的完整方案和有序清单可以进入实施。
- Obsidian Canvas（可视化画布）只允许作为可选导航视图，不是任务状态、执行顺序或项目事实来源。
- 固定“先批准任务舱”，不强制所有变更一律文档先行或代码先行。目标契约先保存在任务舱；实现、测试和正式文档在同一任务中完成，验证通过后一起发布为当前事实。
- Git worktree 按隔离风险启用，不按任务数量默认创建。并行、长期或高风险改造、实验、脏工作区或独立运行态才需要工作树；共享文件冲突仍需通过任务排序和所有权协调。
- 仓库不保存 Obsidian 应用本体、个人窗口状态、社区插件、主题和缓存。大体积二进制资料需单独评估，不得因为使用 Obsidian 而直接进入 Git。

## 结果

- 讨论和正式事实有清晰发布边界，用户确认前不会污染线上或当前文档。
- 长任务可以从任务清单恢复执行，不依赖聊天上下文保持全部细节。
- 多个任务只增加轻量 Markdown 台账；确有隔离需要时再付出工作树成本。
- 人类与 Agent 读取同一套可审查文本，不依赖 Obsidian 专有数据库或插件。
