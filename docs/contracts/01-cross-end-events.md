# 跨端事件契约基线

状态：draft
最后校验日期：2026-07-30

## 关系导航

- 所属领域：[契约内容地图](00-contracts-map.md)
- 上级架构：[系统上下文与总体边界](../architecture/01-system-context.md)
- 业务来源：[实时对话与任务形成](../business/01-conversation-flow.md)、[任务生命周期](../business/02-task-lifecycle.md)、[提醒与通知](../business/03-reminder-and-notification.md)
- 责任模块：[模块内容地图](../modules/00-modules-map.md)

本文先定义语义级契约。具体 URL、传输协议和字段结构需在技术栈确定后形成版本化 API（应用程序接口）契约。

## 统一事件信封

所有跨端业务事件至少需要表达：

| 字段语义 | 说明 |
|---|---|
| event_id | 全局唯一事件标识，用于去重 |
| event_type | 版本化事件类型 |
| occurred_at | 服务端认可的发生时间 |
| subject_id | 所属会话、任务、设备或提醒 |
| subject_version | 对象版本，防止旧事件覆盖新状态 |
| correlation_id | 关联一次用户请求或任务链路 |
| causation_id | 触发当前事件的上一事件 |
| actor | 用户、云端模块、供应商或工作机 |
| payload | 当前类型的最小必要数据 |

## 手机端事件

| 事件 | 方向 | 用途 |
|---|---|---|
| `conversation.state.changed` | 云端 -> 手机 | 更新连接、收听、处理、说话和结束状态 |
| `conversation.transcript.delta` | 云端 -> 手机 | 展示临时或最终转写 |
| `conversation.response.cancelled` | 双向 | 协调打断和丢弃旧音频 |
| `task.draft.ready` | 云端 -> 手机 | 请求用户确认任务草稿 |
| `task.confirmed` | 手机 -> 云端 | 明确确认指定计划版本 |
| `task.state.changed` | 云端 -> 手机 | 更新任务状态和摘要 |
| `task.approval.requested` | 云端 -> 手机 | 展示限定动作确认 |
| `task.approval.decided` | 手机 -> 云端 | 批准或拒绝指定动作 |
| `notification.created` | 云端 -> 手机 | 新消息或提醒可用 |

## 工作机事件

| 事件 | 方向 | 用途 |
|---|---|---|
| `device.capabilities.reported` | 工作机 -> 云端 | 上报支持能力、版本和约束 |
| `device.heartbeat` | 工作机 -> 云端 | 更新连接活性和当前负载 |
| `execution.lease.offered` | 云端 -> 工作机 | 提供一个有期限的任务租约 |
| `execution.lease.accepted` | 工作机 -> 云端 | 确认接受并返回执行标识 |
| `execution.progressed` | 工作机 -> 云端 | 回传结构化阶段进度 |
| `execution.approval.required` | 工作机 -> 云端 | 请求用户批准本地高风险动作 |
| `execution.completed` | 工作机 -> 云端 | 回传结果摘要和产物引用 |
| `execution.failed` | 工作机 -> 云端 | 回传错误分类、可重试性和检查点 |
| `execution.cancel.requested` | 云端 -> 工作机 | 请求安全停止指定执行 |
| `execution.cancelled` | 工作机 -> 云端 | 确认停止和清理结果 |

## 契约规则

- 事件默认可能重复、延迟和乱序，消费者必须幂等。
- 事件类型和载荷采用显式版本，不静默改变旧语义。
- 任务确认必须绑定计划版本，不能只发送“同意”。
- 工作机结果通过受控引用描述产物，不默认把所有本地内容嵌入事件。
- 实时转写增量不等于最终事实，只有最终转写或用户确认才能进入任务摘要。
- 错误必须区分可重试、需要用户操作和永久失败。

## 待定项

- WebSocket（网页套接字）、Server-Sent Events（服务器推送事件）或其他通道的具体组合。
- 媒体直连与云端代理模式。
- 事件载荷 Schema（模式）、兼容策略和最大大小。
- 工作机连接的设备校验和续租机制。
