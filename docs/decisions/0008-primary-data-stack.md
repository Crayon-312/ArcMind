# 决策 0008：主数据库与持久化技术栈

状态：accepted
日期：2026-07-30

## 关系导航

- 所属领域：[决策内容地图](00-decisions-map.md)
- 架构结果：[数据存储、事务与检索设计](../architecture/11-data-storage-and-transactions.md)
- 领域依据：[核心领域模型](../domain/01-core-domain-model.md)
- 落实台账：[云端数据与持久化基线](../plans/0005-cloud-data-foundation.md)

## 背景

ArcMind 需要同时维护身份、会话、任务状态机、审批、执行尝试、长期记忆、提醒和通知。这些对象之间存在强关联、状态约束和多表原子写入，同时记忆又需要结构化过滤、关键词检索和后续语义检索。

## 决策

- 主数据库使用 PostgreSQL 18。
- Python 数据访问使用 SQLAlchemy 2.0 异步接口与 psycopg 3 驱动。
- Schema（数据库结构）迁移使用 Alembic，并随 `cloud-server` 源码版本化。
- 开发、测试和 VPS 环境都使用 PostgreSQL；不使用 SQLite 代替集成环境主库。
- 初期使用一套 PostgreSQL 实例和一个 ArcMind 数据库，不拆分多个业务数据库。
- 语义检索使用 pgvector 扩展，但只有接入 Embedding（向量嵌入）模型后才创建生产向量索引。
- LangGraph Checkpoint 使用同一 PostgreSQL 服务中的框架专属表，不与 ArcMind 领域表互相查询。
- 大型二进制产物和需要保留的音频未来进入 S3 兼容对象存储，PostgreSQL 只保存元数据和受控引用。

## 候选比较

| 候选 | 优点 | 结论 |
|---|---|---|
| PostgreSQL | ACID 事务、外键、并发写、JSONB、全文检索、成熟备份和 pgvector | 采用，最符合任务状态和记忆组合需求 |
| MongoDB | 文档结构灵活，也支持多文档事务 | 不采用；核心数据关系和状态约束明显，多文档事务增加复杂度而没有实际收益 |
| SQLite | 部署简单、单文件、适合设备本地数据 | 不作为云端主库；多进程并发写、远程集中数据和生产差异不符合云端中枢 |
| MySQL | 成熟、运维生态广 | 可行但不采用；PostgreSQL 的 JSONB、扩展和 pgvector 能以更少组件覆盖当前需求 |
| 专用向量数据库 | 大规模向量检索能力强 | 首版不采用；数据规模未知，先避免双写、删除同步和额外备份系统 |

Redis 不是本决策的主数据库候选。它是否作为缓存、队列或调度辅助，要在耐久任务设计中单独决定。

## 映射边界

- Pydantic DTO（数据传输对象）、领域对象和 SQLAlchemy ORM（对象关系映射）模型是三层不同类型，不互相直接暴露。
- Repository（仓储）只能由所属领域模块调用；禁止主 Agent、手机 API 或其他模块直接拼接跨模块 SQL。
- 稳定查询字段使用普通列、约束和外键；JSONB 只用于结构会演进且不承担身份或状态机约束的内容。
- 领域根对象使用 UUID（通用唯一标识符）；外部供应商 ID 只保存在映射表。
- 所有时间使用 `timestamptz` 保存 UTC，用户时区单独保存。
- 可并发修改的聚合使用整数 `version` 做 Optimistic Concurrency Control（乐观并发控制）。

## 迁移规则

- 生产迁移作为独立发布步骤执行，不在每个应用进程启动时自动运行。
- 每个迁移必须能在空库和上一发布版本数据库上升级。
- 破坏性变更使用 expand-migrate-contract（扩展、迁移、收缩）顺序，不能在同一发布直接删除旧列。
- Alembic 自动生成只作为草稿；外键、索引、约束、默认值和数据迁移必须人工审查。
- 可逆结构迁移提供 downgrade（降级）；不可逆数据迁移必须先备份并写明恢复路径。

## 备份与恢复基线

- 个人预览阶段目标为 RPO（恢复点目标）不超过 24 小时、RTO（恢复时间目标）不超过 4 小时。
- 每日使用 `pg_dump` 自定义格式生成逻辑备份，备份加密后复制到 VPS 之外。
- 最低保留 7 个日备份和 4 个周备份；执行高风险迁移前额外备份。
- 每月至少在独立临时数据库执行一次恢复演练，只有实际恢复成功才算备份有效。
- 当产品无法接受一天数据损失时，再升级为 WAL（预写式日志）归档与 PITR（时间点恢复）。

## 风险与控制

| 风险 | 控制 |
|---|---|
| 一个数据库承担多个模块 | 代码仓储与事务边界隔离，禁止跨模块直写内部表 |
| JSONB 演变成无约束数据桶 | 核心字段关系化，JSONB 字段必须有 Schema 和大小限制 |
| 向量模型更换导致旧向量失效 | 向量表保存模型、维度和源版本，可删除并重建 |
| 迁移失败阻塞部署 | 预发布副本验证、迁移前备份、分阶段兼容变更 |
| VPS 与备份同时丢失 | 加密异地复制并定期恢复演练 |

## 官方证据

- [PostgreSQL transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- [PostgreSQL JSON types](https://www.postgresql.org/docs/current/datatype-json.html)
- [PostgreSQL full text search](https://www.postgresql.org/docs/current/textsearch.html)
- [PostgreSQL SQL dump](https://www.postgresql.org/docs/current/backup-dump.html)
- [SQLAlchemy asyncio](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [Alembic tutorial](https://alembic.sqlalchemy.org/en/latest/tutorial.html)
- [pgvector](https://github.com/pgvector/pgvector)
- [MongoDB transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [SQLite appropriate uses](https://www.sqlite.org/whentouse.html)

## 验收门禁

创建正式数据库模型前，必须以 Docker Compose 启动与生产同主版本的 PostgreSQL，验证 Alembic 首次建库、升级、可逆回滚、唯一约束、外键、并发版本冲突、事务发件箱和备份恢复。
