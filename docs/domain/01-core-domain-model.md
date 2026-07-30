# 核心领域模型

状态：draft
最后校验日期：2026-07-30

## 聚合边界

| 聚合 | 根对象 | 包含或关联 | 事实所有者 |
|---|---|---|---|
| 身份 | `User` | `UserSession`、`DeviceBinding`、偏好 | 身份与访问模块 |
| 对话 | `Conversation` | `Turn`、`ConversationSummary`、供应商会话映射 | 会话模块 |
| 记忆 | `Memory` | 来源、版本、状态、可见范围 | 记忆模块 |
| 任务 | `Task` | `TaskPlan`、`TaskStep`、`Approval`、`Execution`、`ArtifactRef` | 任务编排模块 |
| 工作机 | `Workstation` | `WorkstationConnection`、`Capability`、执行租约 | 工作机网关 |
| 提醒 | `Reminder` | `ReminderOccurrence`、调度规则 | 提醒模块 |
| 消息 | `Notification` | 投递尝试、已读状态、目标引用 | 通知模块 |

## 关系图

```text
User
 ├─ 0..* UserSession
 ├─ 0..* Conversation ── 1..* Turn
 │                       └─ 0..* ConversationSummary
 ├─ 0..* Memory
 ├─ 0..* Task ── 1 TaskPlan ── 1..* TaskStep
 │               ├─ 0..* Approval
 │               ├─ 0..* Execution ── 0..* ArtifactRef
 │               └─ 0..* TaskEvent
 ├─ 0..* Workstation ── 0..* Capability
 ├─ 0..* Reminder ── 0..* ReminderOccurrence
 └─ 0..* Notification
```

## 核心对象字段草案

| 对象 | 必需语义字段 | 说明 |
|---|---|---|
| `User` | `id`、`status`、`locale`、`time_zone`、`created_at` | 邮箱等登录标识由身份子模型单独保存 |
| `Conversation` | `id`、`user_id`、`mode`、`state`、`started_at`、`ended_at` | `mode` 区分文字和实时语音 |
| `Turn` | `id`、`conversation_id`、`role`、`content_parts`、`finality`、`created_at` | 临时转写与最终轮次必须区分 |
| `Memory` | `id`、`user_id`、`type`、`summary`、`source_ref`、`status`、`confidence` | 支持更正、废弃和删除 |
| `Task` | `id`、`user_id`、`title`、`goal`、`state`、`plan_version`、`created_at` | 状态只由编排器改变 |
| `TaskStep` | `id`、`task_id`、`kind`、`dependencies`、`state`、`acceptance` | 步骤 ID 在同一计划版本稳定 |
| `Execution` | `id`、`step_id`、`target_type`、`target_id`、`attempt`、`state`、`lease_version` | 区分每次真实执行 |
| `Approval` | `id`、`task_id`、`action`、`scope`、`state`、`expires_at` | 只批准具体动作 |
| `Workstation` | `id`、`user_id`、`display_name`、`status`、`last_seen_at` | 在线状态与绑定状态分离 |
| `Capability` | `id`、`workstation_id`、`type`、`version`、`constraints` | 云端只能派发已声明能力 |
| `Reminder` | `id`、`user_id`、`schedule`、`time_zone`、`state`、`next_trigger_at` | 原始自然语言保留为展示证据 |
| `Notification` | `id`、`user_id`、`type`、`subject_ref`、`priority`、`state` | 不复制完整任务正文 |

## 领域不变量

1. 所有用户数据对象必须归属一个用户主体。
2. 任务草稿未经确认不能产生执行租约。
3. 任务终态不能被迟到事件恢复成非终态。
4. 每次执行尝试只对应一个任务步骤和一个执行目标。
5. 工作机解绑后不能接受新租约，但历史执行记录仍可追溯。
6. 长期记忆必须包含来源和状态；无法验证的内容不能标为高可信当前事实。
7. 审批过期、被拒绝或动作范围变化后不得继续使用。
8. 提醒触发与通知投递是两个事实，任何一方失败都不能伪造另一方成功。

## 数据标识规则

- 领域对象使用服务端生成、不可猜测且全局唯一的标识。
- 外部供应商标识只保存在适配映射中，不作为内部主键。
- 客户端提交副作用请求时提供幂等标识。
- 对象版本用于并发控制和乱序事件防护。
- 展示名称可以修改，不能承担对象身份作用。

## 物理存储映射

本领域模型仍负责业务语义；已确认的 PostgreSQL 表组、字段约定、事务边界和检索设计见 `docs/architecture/11-data-storage-and-transactions.md`。领域对象、API DTO 和 SQLAlchemy ORM 模型必须保持分离，不能因为物理表已经确定就把本领域草案自动视为全部定稿。

## 待确认点

- 用户登录标识是否只支持邮箱，还是预留其他方式。
- 对话原始内容与摘要的默认保留期。
- 任务计划是任务聚合内部版本，还是独立聚合。
- 产物在云端存储、本地引用和临时下载之间的默认策略。
- 删除用户数据时历史审计记录的最小保留边界。
