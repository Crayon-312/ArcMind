# 数据存储、事务与检索设计

状态：current
最后校验日期：2026-07-30

## 总体结构

首版使用一套 PostgreSQL 实例作为云端主事实库。逻辑模块共享数据库服务，但通过 Python 模块、Repository（仓储）、外键和事务边界维护所有权，不提前拆成多个数据库或微服务。

```text
FastAPI / LangGraph
        |
ArcMind 领域服务与 Repository
        |
SQLAlchemy Unit of Work（工作单元）
        |
PostgreSQL 18
  ├─ ArcMind 领域表
  ├─ Outbox / Inbox 与幂等记录
  ├─ pgvector 可重建索引
  └─ LangGraph 框架专属 Checkpoint 表
```

LangGraph 表只能由 Agent Runtime 适配器访问；领域查询不得读取 Checkpoint 推断任务是否完成。

## 表组与所有权

表名使用复数 `snake_case`。下表是物理映射基线，不是最终 DDL（数据库定义语言）。

| 模块 | 主要表 | 阶段 | 说明 |
|---|---|---|---|
| 身份 | `users`、`login_identities`、`user_sessions`、`device_bindings` | 第一阶段 | 邮箱规范化、凭据与恢复细节在身份专项确定 |
| 对话 | `conversations`、`conversation_turns`、`conversation_summaries` | 第一阶段 | 临时转写不进入最终轮次表 |
| 任务 | `tasks`、`task_plans`、`task_steps`、`task_step_dependencies`、`task_events` | 第一阶段 | 状态、计划版本和依赖关系使用关系字段 |
| 执行 | `executions`、`execution_leases`、`approvals`、`artifact_refs` | 任务闭环 | 每次重试是新的执行尝试 |
| 记忆 | `memories`、`memory_revisions`、`memory_sources`、`memory_embeddings` | 记忆阶段 | 当前事实与向量索引分离 |
| 工作机 | `workstations`、`workstation_capabilities`、`workstation_connections` | 工作机阶段 | 在线连接事实不替代任务状态 |
| 提醒 | `reminders`、`reminder_occurrences` | 提醒阶段 | 每次触发使用独立实例和幂等键 |
| 通知 | `notifications`、`notification_deliveries` | 提醒阶段 | 生成消息与投递成功是两个事实 |
| 集成 | `outbox_events`、`inbox_receipts`、`idempotency_records`、`provider_mappings` | 第一阶段 | 支持跨模块事件、外部回调和供应商替换 |

第一阶段只创建实际纵向切片需要的表，不一次性建立所有未来表；但命名、所有权和关系必须遵循本基线。

## 通用字段规则

| 语义 | 规则 |
|---|---|
| 标识 | PostgreSQL `uuid`，由服务端生成 UUIDv4；不得使用邮箱、名称或供应商 ID 作为主键 |
| 时间 | 使用 `timestamptz` 保存 UTC；展示时区使用 IANA 时区名称单独保存 |
| 并发 | 可修改聚合包含 `version bigint`，更新时比较旧版本 |
| 审计时间 | 根对象包含 `created_at`、`updated_at`；不可变事件只包含创建时间 |
| 状态 | 使用受约束字符串并由领域状态机校验，不允许任意文本 |
| 扩展内容 | JSONB 必须有 Pydantic/JSON Schema 校验、大小限制和明确所有者 |
| 删除 | 不使用全库统一软删除；按对象的隐私、审计和恢复需求分别定义 |
| 所有权 | 聚合根直接保存 `user_id`；子对象通过外键链归属用户，不复制无法校验的所有权字段 |

`TaskStep.dependencies` 不保存为 JSON 数组，而使用 `task_step_dependencies` 关系表，以便约束步骤存在性、检测循环和执行查询。

## 事务边界

以下动作必须在单个 PostgreSQL 事务内完成：

1. 用户确认任务：锁定草稿版本，创建正式任务、计划、步骤、首个任务事件和 Outbox 事件。
2. 派发执行：校验任务版本，创建执行尝试和租约，更新步骤状态，追加任务事件和 Outbox 事件。
3. 接收工作机或供应商事件：先登记 Inbox 去重记录，再校验租约与状态版本，更新执行和任务事实并写 Outbox。
4. 用户审批：校验审批范围和有效期，写审批结果、任务事件和恢复命令事件。
5. 提醒触发：以计划与触发时间构造唯一键，创建 ReminderOccurrence（提醒实例）、Notification（通知）和 Outbox。
6. 记忆更正：创建新修订，切换当前版本，废弃旧向量并创建重新索引事件。

外部 API、模型调用、对象上传和工作机命令不得在数据库事务持锁期间执行。事务只提交本地事实和待发送 Outbox，后台投递器在提交后处理外部副作用。

## 幂等、乱序与审计

- 客户端副作用请求的幂等键按 `user_id + operation + key` 唯一。
- 外部事件按 `source + external_event_id` 唯一；重复事件返回已有处理结果。
- `task_events` 是追加式审计轨迹，记录聚合版本、触发者、旧状态、新状态和原因分类。
- 任务表保存当前快照，事件表用于审计和重建诊断；首版不实施完整 Event Sourcing（事件溯源）。
- 终态更新使用版本条件，迟到事件只能被记录为已忽略，不能恢复任务运行。
- Outbox 投递采用至少一次语义，因此所有消费者必须幂等。

## 记忆与检索

`memories` 与 `memory_revisions` 保存可审查事实；`memory_embeddings` 保存以下索引元数据：

- `memory_revision_id`
- `embedding_provider`
- `embedding_model`
- `dimensions`
- `content_hash`
- `embedding`
- `created_at`

检索顺序为：用户范围与状态过滤、结构化标签过滤、关键词或语义召回、重排、权限与数量裁剪。Embedding 模型改变时创建新索引版本，不覆盖原记忆正文。

PostgreSQL 内建全文检索对中文分词效果必须实测；未通过固定中文语料验收前，不把它作为唯一关键词检索方案。专用向量数据库只有在数据量、延迟或召回率测试证明 pgvector 不满足要求时才引入。

## 数据库访问规则

- FastAPI 每个请求或后台任务使用独立 AsyncSession（异步会话），不得跨并发任务共享。
- Repository 方法不隐式提交；事务由应用服务的 Unit of Work 统一开始、提交或回滚。
- API DTO、领域对象和 ORM 模型分离，避免数据库字段直接成为公开接口。
- 运行时数据库账号无 DDL 权限；Alembic 使用独立迁移账号；备份账号仅具备所需读取权限。
- 首版不启用跨模块数据库触发器承载业务流程；业务状态变化通过领域服务完成。

## 迁移与部署

开发环境通过 Docker Compose 启动与 VPS 同主版本 PostgreSQL。每个迁移需要通过：

1. 空库执行 `upgrade head`。
2. 从上一发布版本数据库升级。
3. 对可逆迁移执行 `downgrade` 后再次升级。
4. 校验外键、唯一约束、索引和默认值。
5. 使用代表性数据检查锁表时间和兼容窗口。

生产发布顺序为备份、迁移、兼容版应用、数据回填、验证、最后收缩旧结构。不得把不可逆删除和依赖新结构的应用放在同一无回滚发布中。

## 备份与删除

- 每日 `pg_dump -Fc`，加密后复制到 VPS 之外，保留 7 日备份和 4 周备份。
- 每月恢复到独立临时数据库并执行关键计数与外键检查。
- 数据库备份不是用户导出；后续需要单独提供按用户范围导出能力。
- 用户删除流程必须覆盖主表、Outbox/Inbox、向量索引、对象存储和仍在保留期内的备份说明。
- 备份中的删除采用有限保留期自然淘汰；恢复备份后必须重放删除清单，避免已删除数据重新出现。

## 当前开放问题

- 对话正文、任务、日志和长期记忆的默认保留期。
- S3 兼容对象存储的具体产品和加密方式。
- 耐久队列、Outbox 投递器和提醒调度器的具体实现。
- LangGraph PostgreSQL Checkpoint 表的初始化、迁移与清理策略，需要技术验证。
