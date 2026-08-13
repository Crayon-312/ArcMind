---
id: "arcmind-doc-decisions-0009-durable-job-stack"
type: "decision"
status: "current"
summary: "项目决策《决策 0009：耐久 Job 与提醒调度技术栈》的当前事实、边界与关联依据。"
scope: ["decisions"]
tags: ["arcmind-v2", "decisions"]
confidence: "high"
last_verified: "2026-07-30"
---

# 决策 0009：耐久 Job 与提醒调度技术栈

状态：accepted
日期：2026-07-30

## 关系导航

- 所属领域：[决策内容地图](00-decisions-map.md)
- 架构结果：[耐久 Job、调度与恢复设计](../architecture/12-durable-jobs-and-scheduling.md)
- 业务边界：[任务生命周期](../business/02-task-lifecycle.md)、[提醒与通知](../business/03-reminder-and-notification.md)
- 落实台账：[耐久 Job 与提醒调度](../plans/0006-durable-jobs-and-scheduling.md)

## 背景

ArcMind 需要在单台 VPS（虚拟专用服务器）上可靠处理 Outbox（事务发件箱）投递、模型后处理、通知、工作机派发、失败重试和提醒触发。它们必须跨进程重启恢复，但不能与用户可见的 `Task` 状态、工作机 `ExecutionLease` 或 LangGraph Checkpoint（检查点）混为一体。

首版已经选定 PostgreSQL 18、Python 3.12、FastAPI 和模块化单体。当前目标是用最少的新增基础设施建立可验证的耐久后台工作能力，并为未来迁移保留端口。

## 决策

- 首版使用 Procrastinate 作为 Python 耐久任务队列，复用 PostgreSQL 18，不新增 Redis 或 RabbitMQ。
- API、队列 Worker、Outbox Dispatcher、Reminder Scheduler 和 Reconciler 作为独立运行进程，共享 `cloud-server` 代码与公开应用服务边界。
- 业务模块只依赖 ArcMind 的 `JobQueue` 端口；Procrastinate 的装饰器、Job ID、状态和表结构不得泄漏到领域对象或公开 API。
- 用户 `Task`、`TaskStep`、`Execution`、`ExecutionLease`、`Reminder`、`ReminderOccurrence` 和 `Notification` 继续由 ArcMind 领域表维护。
- Job 使用至少一次投递；每个消费者必须通过领域唯一键、Inbox 或幂等记录抵抗重复执行。
- 远期提醒由数据库驱动的 Reminder Scheduler 扫描生成唯一触发实例，不把长期业务计划寄托在单条队列 ETA 上。
- 工作机长任务只用短 Job 完成派发、取消和协调，不让一个云端 Worker 长时间等待本地执行结束。
- `dead` Job 进入运维可见的死信视图并允许审计式人工重新入队；不得直接修改队列表伪造完成。

## 候选比较

| 候选 | 正式能力与依赖 | 结论 |
|---|---|---|
| Procrastinate | 官方文档说明它使用 PostgreSQL 保存任务定义、管理锁和派发任务，支持同步/异步代码、周期任务、重试和任务锁；官网同时说明项目正在寻找更多维护者 | 采用；与当前 Python/PostgreSQL 基线匹配，单 VPS 新增运维最少，但必须锁版本并保留迁移端口 |
| Celery | 成熟、吞吐和生态强；官方说明需要消息传输，RabbitMQ 和 Redis Broker（消息代理）功能最完整，周期任务还需单一 `celery beat` 调度来源 | 暂不采用；首版会新增 Broker 和独立调度运维，当前收益不足 |
| Taskiq | 异步优先、类型体验好、组件可替换；官方生产入门建议独立 Broker，示例使用 RabbitMQ，并常配 Redis Result Backend（结果后端） | 暂不采用；仍引入额外组件，当前没有足够优势抵消运维成本 |
| Temporal | 提供 Workflow、Activity、Worker、Timer、Schedule、消息传递等完整耐久工作流原语，并有 LangGraph 集成 | 暂不采用；需要 Temporal Service（Temporal 服务）并引入第三层工作流编排，与 ArcMind 任务编排和 LangGraph 职责重叠 |
| 自建 PostgreSQL `SKIP LOCKED` 队列 | PostgreSQL 官方确认该锁模式可用于多消费者访问类队列表 | 不采用为完整队列；只用于 Outbox、提醒扫描等短领取模式，避免自研全部重试、恢复和 Worker 生命周期 |

## 为什么不是“只用 Procrastinate”

队列库解决的是内部工作的耐久派发，不拥有 ArcMind 业务语义：

- Job 成功不等于用户任务成功。
- Procrastinate 锁不等于工作机执行租约。
- 周期 Job 不等于一条用户提醒规则。
- 队列重试不等于任务步骤的新的 `Execution`。
- LangGraph 恢复不等于副作用可以安全重复。

因此领域状态、队列状态、Agent 图状态和执行器状态必须通过 ID、版本和事件关联，但不能互相替代。

## 运维与部署结果

首版 Docker Compose 至少包含 PostgreSQL、API 和 Worker 进程；Scheduler、Dispatcher 与 Reconciler 可以复用同一云端镜像，以不同命令启动。是否拆成独立容器在工程骨架阶段决定，但生产中必须保证：

- 每种进程可独立健康检查和重启。
- Scheduler 多实例运行也不会重复生成提醒实例。
- Worker 数量可独立扩展并按 Job 类别限制并发。
- 数据库不可用时所有写入型进程停止推进，不退回内存队列。
- 队列组件升级包含 Schema 兼容检查、积压观察和回滚步骤。

## 风险与控制

| 风险 | 控制 |
|---|---|
| PostgreSQL 同时承担业务与队列负载 | 独立连接池、队列并发限制、慢查询和积压指标；达到实测阈值再迁移 Broker |
| 队列组件表与领域表形成双重事实 | 队列只负责内部 Job，公开状态只读领域服务 |
| 至少一次投递造成重复副作用 | 强制幂等键、Inbox、唯一约束和故障点测试 |
| 远期队列记录漂移或丢失 | Reminder 以领域表为准，短周期扫描并生成唯一 Occurrence |
| 工作机断线造成重复派发 | ExecutionLease 版本、回执和协调器；租约过期不自动证明旧执行停止 |
| 将来迁移困难 | `JobQueue`、版本化载荷和领域事件隔离 Procrastinate 私有类型 |
| 上游维护力量不足 | 锁定依赖版本、跟踪发布与安全公告、在升级前做恢复演练，并保留 PostgreSQL 自建领取或其他队列适配器退路 |

## 重新评估触发器

出现以下任一经过指标证明的情况时，重新比较 Celery、Taskiq、专用 Broker 或 Temporal：

- 队列负载明显影响主业务数据库延迟或备份窗口。
- 需要跨语言、跨服务或跨区域高吞吐消息分发。
- 复杂长工作流、数月 Timer（定时器）、Signal（信号）和版本迁移成为主要需求。
- 单 VPS 运维约束不再成立，并已有专门平台维护能力。
- Procrastinate 的升级、可观察性或恢复能力不能满足故障演练。

## 官方证据

- [Procrastinate documentation](https://procrastinate.readthedocs.io/en/stable/)
- [Celery introduction](https://docs.celeryq.dev/en/stable/getting-started/introduction.html)
- [Celery periodic tasks](https://docs.celeryq.dev/en/stable/userguide/periodic-tasks.html)
- [Taskiq getting started](https://taskiq-python.github.io/guide/getting-started.html)
- [Temporal Python SDK](https://docs.temporal.io/develop/python)
- [PostgreSQL locking clause](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)

## 验收门禁

创建正式 Worker 骨架前必须完成一次隔离技术验证：启动与生产同主版本 PostgreSQL，验证 Procrastinate 的初始化、异步 Worker、立即与延迟 Job、重试、Worker 崩溃恢复、多 Worker 竞争、关闭与升级流程；同时用故障注入证明同一 Outbox 和提醒触发重复处理不会产生重复领域副作用。
