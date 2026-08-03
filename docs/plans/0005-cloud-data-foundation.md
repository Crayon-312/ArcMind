# 方案落实台账：云端数据与持久化基线

状态：done
最后更新：2026-07-30

## 关系导航

- 所属领域：[计划内容地图](00-plans-map.md)
- 领域依据：[核心领域模型](../domain/01-core-domain-model.md)
- 发布决策：[主数据库与持久化技术栈](../decisions/0008-primary-data-stack.md)
- 发布架构：[数据存储、事务与检索设计](../architecture/11-data-storage-and-transactions.md)

## 目标

在创建云端代码骨架前，确定主数据库、数据访问、迁移、检索和备份基线，明确领域事实、LangGraph 运行态、向量索引和未来队列之间的边界。

## 非目标

- 不创建数据库容器、ORM 模型或 Alembic 文件。
- 不选择耐久队列和提醒调度器。
- 不决定身份凭据、邮箱服务或 HTTPS。
- 不为尚未进入开发顺序的模块一次性创建所有表。

## 系统影响矩阵

| 影响类型 | 内容 | 状态 | 写回位置 |
|---|---|---|---|
| 架构 | PostgreSQL 成为唯一主事实库 | current | [决策 0008](../decisions/0008-primary-data-stack.md) |
| 数据 | 定义表组、字段、事务、幂等和检索边界 | current | [数据存储、事务与检索设计](../architecture/11-data-storage-and-transactions.md) |
| Agent | Checkpoint 与领域任务事实隔离 | current | [数据存储、事务与检索设计](../architecture/11-data-storage-and-transactions.md) |
| 安全 | 运行、迁移和备份账号职责分离 | current | [决策 0008](../decisions/0008-primary-data-stack.md) |
| 隐私 | 备份恢复后重放删除清单 | current | [数据存储、事务与检索设计](../architecture/11-data-storage-and-transactions.md) |
| 发布 | 定义分阶段迁移、备份和恢复演练 | current | [决策 0008](../decisions/0008-primary-data-stack.md) |
| 记忆 | 关闭数据库开放问题并保留队列、保留期等专项问题 | mixed | `.agent-context/memory-sources/` |

## 任务清单

| 顺序 | ID | 任务 | 依赖 | 验收口径 | 状态 |
|---:|---|---|---|---|---|
| 1 | D1 | 读取领域、任务、记忆、提醒和质量边界 | 现有 V2 文档 | 所有强一致对象和开放问题已覆盖 | done |
| 2 | D2 | 核对数据库、迁移、备份和向量检索官方资料 | D1 | 候选比较具有正式证据 | done |
| 3 | D3 | 确定主数据库与 Python 数据栈 | D1-D2 | 技术选择、替代方案和迁移边界明确 | done |
| 4 | D4 | 设计表组、事务、幂等、检索和备份 | D3 | 能映射核心领域对象和任务状态机 | done |
| 5 | D5 | 同步架构、质量门禁、风险与项目记忆 | D4 | 当前事实与开放问题分离 | done |
| 6 | D6 | 运行验证并创建本地提交 | D5 | 项目检查、JSONL 和差异检查通过 | done |

## 工作区模式

本任务属于 S3 架构决策。按用户此前要求继续在当前 `v2` 工作目录串行完成；工作区初始干净、没有并行 Agent 或共享文件冲突，因此不创建新的 Git worktree。

## 多 Agent 说明

本任务未启用子 Agent：当前上层规则不允许主动委派，且数据所有权、事务边界和项目记忆必须串行保持一致。

## 完成核对

- [x] 主数据库与迁移工具已确定。
- [x] 表组和领域所有权已映射。
- [x] LangGraph、业务事实和向量索引已隔离。
- [x] Outbox、Inbox、幂等与事务边界已设计。
- [x] 开发环境、备份和恢复目标已定义。
- [x] 项目检查、下游薄入口检查、JSONL 和差异检查完成；本地提交在本台账更新后执行。

## 变更记录

- 2026-07-30：按已确认开发顺序进入云端数据与持久化设计。
- 2026-07-30：完成官方证据核对并形成 PostgreSQL 数据基线。
- 2026-07-30：项目检查、下游薄入口检查、JSONL 校验和差异检查通过。
