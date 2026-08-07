# 计划内容地图

状态：current
最后校验日期：2026-08-07

计划目录保存方案落实台账，也就是隔离任务舱。它记录用户批准范围、有序任务、执行证据和发布结果，不替代产品或架构当前事实。

## 上下游

- 上级入口：[项目文档总索引](../00-index.md)
- 方案依据：[产品内容地图](../product/00-product-map.md)、[决策内容地图](../decisions/00-decisions-map.md)
- 发布验收：[质量内容地图](../quality/00-quality-map.md)

## 已完成台账

- [ArcMind V2 文档基线](0001-v2-documentation-foundation.md)
- [V2 设计细化](0002-v2-design-readiness.md)
- [三端代码组织与实施顺序审查](0003-three-app-architecture-review.md)
- [V2 首阶段技术基线](0004-v2-technology-baseline.md)
- [云端数据与持久化基线](0005-cloud-data-foundation.md)
- [耐久 Job 与提醒调度](0006-durable-jobs-and-scheduling.md)
- [Obsidian 知识库与任务隔离](0007-obsidian-task-isolation.md)
- [知识关系重构](0008-knowledge-relationship-reconstruction.md)

## 当前台账

- [第一阶段开发入口门禁](0009-phase-1-entry-gate.md)（执行中，`active`；等待手机、模型、高位公网端口续期方案和告警证据）
- [ArcMind V2 首个运行时纵向切片与永久服务器发布](0011-first-runtime-slice.md)（执行中，`active`；实现身份、文字对话和新 VPS 首轮发布）

## 草稿台账

- [ArcMind 独立 VPS 部署与 HTTPS 迁移](0010-dedicated-vps-deployment.md)（草稿，`draft`；已完成空主机核验，后续基础设施实施由 0011 统一管理）

## 使用规则

- 新任务从[任务舱模板](../templates/task-capsule.md)创建。
- 只有用户确认后的完整清单可以进入实施。
- 完成后必须连接实际修改的正式文档、决策、项目记忆和验收证据。
