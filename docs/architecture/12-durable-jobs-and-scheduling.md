# 耐久 Job、调度与恢复设计

状态：current
最后校验日期：2026-08-07

## 关系导航

- 所属领域：[架构内容地图](00-architecture-map.md)
- 数据基础：[数据存储、事务与检索设计](11-data-storage-and-transactions.md)
- 业务状态：[任务生命周期](../business/02-task-lifecycle.md)、[提醒与通知](../business/03-reminder-and-notification.md)
- 责任模块：[任务编排](../modules/task-orchestration.md)、[提醒与通知模块](../modules/reminder-notification.md)
- 技术决策：[耐久 Job 与提醒调度技术栈](../decisions/0009-durable-job-stack.md)
- 落实台账：[耐久 Job 与提醒调度](../plans/0006-durable-jobs-and-scheduling.md)

## 目标

ArcMind 的对话、任务、提醒和工作机执行都可能跨越 Web 请求、进程重启和短暂网络故障。本设计定义首版耐久后台工作、延迟调度、重试、租约与恢复边界，保证系统不会把“队列已消费”误认为“用户任务已完成”。

首版采用 Procrastinate（基于 PostgreSQL 的 Python 任务队列）和 PostgreSQL 18。Procrastinate 只承载内部 Job（后台作业）的派发、领取、重试和短期调度；ArcMind 领域表仍是用户任务、提醒、审批、执行和通知的唯一事实源。

## 术语与事实边界

| 对象 | 作用 | 事实所有者 | 不能代表 |
|---|---|---|---|
| `Task` | 用户确认的工作目标、计划、状态和结果 | 任务编排模块 | 某个 Worker（后台工作进程）已运行 |
| `TaskStep` | 任务内具有依赖和验收条件的步骤 | 任务编排模块 | 一条队列消息 |
| `Execution` | 某个步骤的一次真实执行尝试 | 任务编排模块 | 队列处理函数的一次调用 |
| `ExecutionLease` | 云端或工作机执行器在限定时间和版本内获得的执行权 | 任务编排模块 | Procrastinate 的内部锁 |
| `Job` | 云端内部可领取、可重试、可延迟的短后台工作 | Job Queue（作业队列）适配层 | 用户可见任务状态 |
| `Reminder` | 用户确认的持久化提醒规则 | 提醒模块 | 一个长期等待的队列定时器 |
| `ReminderOccurrence` | 某条提醒在某个计划时刻的唯一触发实例 | 提醒模块 | 通知已成功送达 |
| `Notification` | 面向用户的持久化消息 | 通知模块 | 对应业务动作成功 |

Procrastinate 自有表属于队列组件的运行数据。业务代码只能通过 `JobQueue` 端口提交和处理 Job，不得直接查询队列表来计算 `Task`、`Reminder` 或 `Notification` 状态。

## 总体结构

```text
领域事务
  ├─ 更新 Task / Execution / Reminder / Notification
  └─ 写入 OutboxEvent
           |
           v
Outbox Dispatcher（发件箱投递器）
           |
           v
JobQueue 端口 -> Procrastinate / PostgreSQL
           |
           v
短任务 Worker -> 领域服务 / 外部适配器
           |
           └─ 幂等写回领域事实与新的 OutboxEvent

Reminder Scheduler（提醒调度器）
  -> 扫描到期 Reminder
  -> 唯一创建 ReminderOccurrence
  -> 创建 Notification 与 OutboxEvent
```

初期在一个 `cloud-server` 代码库内运行 API、Worker、Outbox Dispatcher、Reminder Scheduler 和 Reconciler（协调恢复器）等独立进程；它们可以位于不同容器或同一镜像的不同启动命令，但不能依赖同一进程内存共享状态。

## Job 类型与生命周期

首版至少需要以下 Job 类别：

- Outbox 事件投递与外部副作用调用。
- 云端短工具调用或模型后处理。
- 工作机任务包派发、取消和状态协调。
- 通知投递与失败重试。
- 过期租约、僵尸执行和未完成 Outbox 的周期扫描。
- 提醒调度器生成触发实例后的投递工作。

统一队列语义使用以下状态；具体 Procrastinate 状态由适配层映射：

| 状态 | 含义 |
|---|---|
| `scheduled` | 已登记，但尚未到可领取时间 |
| `available` | 可以被 Worker 领取 |
| `leased` | 已被一个 Worker 领取并受内部锁保护 |
| `running` | 处理函数已经开始执行 |
| `retry_wait` | 失败后等待下一次重试时间 |
| `succeeded` | 处理函数已按契约完成 |
| `failed` | 已确认是永久错误，不再自动重试 |
| `cancelled` | 在开始副作用前被安全取消 |
| `dead` | 重试预算耗尽或恢复策略无法继续，需要人工处理 |

`Job.succeeded` 只说明这次内部协调动作完成。例如“把任务改为等待用户输入”可以是 Job 成功，同时用户 `Task` 进入 `blocked`；不得把两种状态机械映射。

## 至少一次、幂等与事务

系统采用 At-least-once Delivery（至少一次投递）语义。Worker 崩溃、连接中断或 Outbox 投递器在“已入队但未标记投递”之间退出时，同一逻辑工作可能再次出现。

所有有副作用的处理器必须：

1. 接收稳定的 `job_key`、领域对象 ID、预期版本和关联 ID。
2. 在写入前检查 `inbox_receipts`、`idempotency_records` 或领域唯一键。
3. 在同一 PostgreSQL 事务内登记去重事实、更新领域状态并写出后续 Outbox。
4. 对外部服务无法提供幂等键的调用，记录调用尝试和结果，不以盲目重试扩大副作用。
5. 对迟到或旧租约事件只记录“已忽略”，不得覆盖新版本或终态。

Outbox Dispatcher 使用短事务领取待投递记录；PostgreSQL 官方明确说明 `FOR UPDATE SKIP LOCKED` 可用于多个消费者访问 queue-like table（类队列表）以减少锁竞争。领取后不得在数据库锁内执行网络调用。

## 重试与错误分类

| 错误类型 | 队列处理 | 领域处理 |
|---|---|---|
| 瞬时网络、临时不可用、数据库连接中断 | 指数退避并加入随机抖动 | 保留原业务状态，不伪造失败 |
| 供应商限流 | 优先遵守 `Retry-After`，再应用退避上限 | 记录供应商和限流分类 |
| 永久参数、权限或不支持错误 | 不自动重试，进入 `failed` | 根据领域规则进入 `blocked` 或 `failed` |
| 需要用户补充输入 | Job 完成其状态写回职责 | `Task` 进入 `blocked` |
| 需要高风险审批 | Job 完成其状态写回职责 | `Task` 进入 `waiting_approval` |
| 未分类错误或重试耗尽 | 进入 `dead` 并告警 | 由协调器决定保持、阻塞或失败，不自动等同 |

每类 Job 必须单独配置最大尝试次数、退避上限、超时和并发度。禁止使用一个全局重试策略处理模型请求、通知、工作机派发和不可逆外部操作。

## Worker、锁与僵尸恢复

- Procrastinate 的内部锁只保护一个 Job 的领取与处理，不替代 `ExecutionLease`。
- Worker 必须具有进程级健康检查和结构化日志；长处理器应定期报告心跳或拆成短步骤。
- Worker 异常退出后，由队列恢复机制和 Reconciler 重新开放可安全重试的 Job。
- Reconciler 周期扫描过期 `ExecutionLease`、长时间无进展的 `Execution`、未投递 Outbox 和 `dead` Job 的关联对象。
- 人工重新入队必须生成新的操作记录并沿用原幂等语义，不允许直接修改队列表伪造成功。

## 工作机长任务边界

工作机上的编程、文件处理或调查任务可能持续数分钟到数小时。云端 Job 只负责：

1. 校验任务和步骤版本。
2. 创建或续订 `ExecutionLease`。
3. 向在线工作机派发任务包并等待短时接收回执。
4. 写回 `dispatched` 或安全退回 `queued`。

工作机确认接收后，派发 Job 结束，不长期占用 Worker。后续进度、审批、取消和结果通过工作机通道作为幂等事件进入领域服务；Reconciler 负责检测租约过期和断线。租约过期不代表本地进程已经停止，因此不得立即向另一执行器重复派发可能产生副作用的步骤。

## Reminder Scheduler

远期提醒不直接依赖队列中保存数天或数月的 ETA（预计执行时间）。`reminders.next_trigger_at` 是持久化事实，调度器按短周期扫描到期窗口：

1. 以数据库时间为准，领取 `next_trigger_at <= scan_until` 的有效提醒。
2. 使用 `(reminder_id, scheduled_for)` 唯一键创建 `reminder_occurrences`。
3. 在同一事务创建 `notifications`、Outbox，并计算下一次触发时间。
4. 事务提交后由队列异步投递通知。

多实例扫描依靠行锁和唯一约束去重。调度器停机后恢复时采用 catch-up（补偿触发）策略：补建未生成的实例，记录 `scheduled_for` 与 `triggered_at`，但不伪装成准时送达。重复提醒逐个补偿还是合并摘要，由提醒类型的明确策略决定。

## PostgreSQL 故障时的降级

- API 不得退回内存写入；需要持久化的请求返回明确的暂时不可用状态。
- Worker、Dispatcher 和 Scheduler 停止领取新工作并按连接退避重试，不在本地猜测完成状态。
- 已派发的工作机可以在有效租约和既有授权范围内完成当前有界步骤；租约到期后不得开始新的高风险动作。
- 工作机可短暂缓存带稳定事件 ID 的进度，恢复连接后重放；缓存大小和保留期在工作机阶段确定。
- 提醒恢复后按补偿策略生成实例，并向用户展示实际延迟。

## 当前已实现的文字生成切片

- `POST /conversations/{conversation_id}/turns` 在一个 PostgreSQL 事务内写入用户轮次、响应记录和 `arcmind.generate_response` Job，成功后立即返回 `202`，不在 HTTP 请求中等待模型。
- 独立 Worker 领取 `model` 队列；每次增量先检查响应仍为 `generating`，再写入响应快照和有序事件，终态之后的迟到写入被拒绝。
- 同一个响应使用稳定队列锁和领域唯一约束。隔离数据库实测两个独立 Worker 竞争同一 Job 时只创建一个最终助手轮次和一个完成事件。
- 用户取消先锁定并提交 ArcMind 响应终态，再尽力通知队列停止 Job；重复取消不重复追加事件，队列取消失败也不能恢复领域状态。
- Worker 重新领取遗留 `generating` 响应时写入 `GENERATION_INTERRUPTED` 可重试失败，不把部分文本伪造成完成；容器停止宽限期内 Worker 可正常退出。
- 当前切片只运行确定性测试模型。真实 DeepSeek 流式调用、Outbox Dispatcher、提醒调度和通用 Reconciler 仍不属于已上线事实。

## 适配与迁移边界

业务模块只依赖以下概念端口：

- `JobQueue.enqueue()`：提交立即或短期延迟 Job。
- `JobHandler`：按版本化载荷处理 Job。
- `SchedulerTick`：触发数据库扫描，不承载业务计划本身。
- `JobAdmin`：查询失败、死信和人工重新入队。

领域事件载荷使用版本化 JSON Schema（JSON 模式）。未来若吞吐、跨服务隔离或复杂长工作流达到实测瓶颈，可以把适配器迁移到 Celery、Taskiq 或 Temporal；迁移不得改变 `Task`、`ExecutionLease`、`ReminderOccurrence` 和 Outbox 的领域语义。

## 验证矩阵

- Worker 在处理前、外部副作用后、领域事务提交前后崩溃。
- 同一 Outbox、回调、工作机事件和提醒触发重复投递。
- 多 Worker 并发领取、锁等待、租约过期和僵尸恢复。
- 限流、永久错误、需要输入、等待审批和重试耗尽。
- 调度器停机、跨时区、夏令时、错过触发和多实例扫描。
- 工作机接收回执丢失、断线重连、旧租约迟到和取消竞态。
- PostgreSQL 短暂不可用、恢复后的积压处理和用户可见降级。

## 官方证据

- [Procrastinate documentation](https://procrastinate.readthedocs.io/en/stable/)
- [Procrastinate GitHub repository](https://github.com/procrastinate-org/procrastinate)
- [Celery introduction](https://docs.celeryq.dev/en/stable/getting-started/introduction.html)
- [Celery periodic tasks](https://docs.celeryq.dev/en/stable/userguide/periodic-tasks.html)
- [Taskiq documentation](https://taskiq-python.github.io/)
- [Taskiq getting started](https://taskiq-python.github.io/guide/getting-started.html)
- [Temporal Python SDK](https://docs.temporal.io/develop/python)
- [PostgreSQL SELECT locking clause](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)
