---
id: "arcmind-doc-contracts-02-cloud-public-api"
type: "architecture_rule"
status: "draft"
summary: "手机端通过版本化 HTTPS API 操作身份、会话和任务，服务端事件通道负责增量更新与恢复。"
scope: ["contracts"]
tags: ["arcmind-v2", "contracts"]
confidence: "medium"
last_verified: "2026-08-13"
---

# 云端公开 API 契约草案

状态：draft
最后校验日期：2026-08-06

## 关系导航

- 所属领域：[契约内容地图](./00-接口与事件地图.md)
- 客户端边界：[手机 Web 端](../06-前端设计/01-手机Web端设计.md)、[手机 Web 模块](../06-前端设计/03-手机Web模块.md)
- 业务来源：[实时对话与任务形成](../02-业务模型/03-实时对话与任务形成.md)、[身份与工作机绑定](../02-业务模型/04-身份与工作机绑定.md)
- 事件语义：[跨端事件契约基线](./01-跨端事件契约.md)
- 身份决策：[单一账号密码身份基线](../10-架构决策/0018-simple-login-identity.md)
- 事件决策：[文字闭环使用 SSE 事件通道](../10-架构决策/0014-sse-text-event-channel.md)
- 第一阶段机器契约：[第一阶段机器契约](./04-第一阶段机器契约.md)

## 目标

本契约描述手机 Web 端可以依赖的资源语义。当前不锁定后端框架，路径和载荷在实现前仍可调整，但资源归属和越权边界必须保持。

## 通用约定

- 基础前缀暂定为 `/api/v1`。
- 请求和响应使用版本化 JSON（JavaScript 对象表示法）结构；实时音频除外。
- 所有时间使用带时区的 ISO 8601（国际标准时间格式），服务端保存标准时间。
- 创建或改变副作用的请求支持幂等标识。
- 列表接口采用稳定游标分页，不以客户端页码表达实时数据位置。
- 错误响应包含稳定错误码、用户可读摘要、是否可重试和关联标识。
- 手机端只访问本文件定义的公开资源，不访问内部管理或工作机接口。

## 身份资源

| 方法 | 路径 | 用途 | 状态 |
|---|---|---|---|
| `POST` | `/auth/session` | 使用单一账号密码创建 Web 会话 | proposed |
| `DELETE` | `/auth/sessions/current` | 退出当前会话 | accepted |
| `DELETE` | `/auth/sessions` | 撤销当前用户全部 Web 会话 | accepted |
| `GET` | `/me` | 获取当前用户和基础偏好 | accepted |
| `PATCH` | `/me/preferences` | 更新时区、语言和交互偏好 | accepted |

登录只接收账号和密码；成功响应设置 `__Host-arcmind_session` 安全 Cookie，正文不返回会话令牌。错误账号和错误密码统一使用 `AUTH_INVALID_CREDENTIALS`，不得泄露用户登记情况。当前 OpenAPI 机器契约和运行代码仍是验证码旧版本，必须在[任务舱 0016](../14-开发方案/0016-simple-login-and-database-hardening.md)中与前后端实现同步切换。

## 会话资源

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/conversations` | 创建文字或实时语音会话记录 |
| `GET` | `/conversations` | 查询会话摘要列表 |
| `GET` | `/conversations/{conversation_id}` | 获取会话详情和最终轮次 |
| `POST` | `/conversations/{conversation_id}/turns` | 提交文字轮次 |
| `GET` | `/responses/{response_id}/events` | 通过 SSE 接收响应快照、增量和终态 |
| `POST` | `/responses/{response_id}/cancel` | 幂等取消生成中的响应 |
| `POST` | `/conversations/{conversation_id}/realtime-sessions` | 创建短期实时连接引导信息 |
| `POST` | `/conversations/{conversation_id}/end` | 结束会话并触发摘要收尾 |

实时连接引导信息只能支持当前会话和短期连接，不得向浏览器暴露云端长期供应商权限。

提交文字轮次成功后返回 `202`、`response_id` 和事件流地址。SSE 使用同源 Cookie 鉴权，重连读取 `Last-Event-ID`；最终轮次必须能由会话查询接口恢复，不能只存在于事件流。

## 任务与审批资源

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/tasks` | 查询当前用户任务列表 |
| `GET` | `/tasks/{task_id}` | 获取任务、计划、步骤和最新状态 |
| `POST` | `/task-drafts/{draft_id}/confirm` | 确认指定草稿和计划版本 |
| `POST` | `/task-drafts/{draft_id}/discard` | 放弃任务草稿 |
| `POST` | `/tasks/{task_id}/cancel` | 请求取消任务 |
| `POST` | `/tasks/{task_id}/revisions` | 提交任务范围变更请求 |
| `GET` | `/tasks/{task_id}/events` | 查询可展示的任务事件 |
| `POST` | `/approvals/{approval_id}/decisions` | 批准或拒绝具体动作 |

确认请求必须同时携带草稿版本；审批请求必须匹配未过期的动作范围。

## 工作机资源

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/workstations` | 查询已绑定工作机和在线摘要 |
| `POST` | `/workstation-bindings` | 创建短期绑定挑战 |
| `POST` | `/workstation-bindings/{binding_id}/confirm` | 在手机端确认设备绑定 |
| `PATCH` | `/workstations/{workstation_id}` | 修改设备显示名或偏好 |
| `DELETE` | `/workstations/{workstation_id}` | 解除设备关系 |

## 提醒、通知与记忆资源

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET/POST` | `/reminders` | 查询或创建提醒 |
| `PATCH/DELETE` | `/reminders/{reminder_id}` | 修改、关闭或删除提醒 |
| `GET` | `/notifications` | 查询消息中心 |
| `POST` | `/notifications/{notification_id}/read` | 标记消息已读 |
| `GET` | `/memories` | 查询用户可管理的长期记忆 |
| `PATCH` | `/memories/{memory_id}` | 更正或调整记忆状态 |
| `DELETE` | `/memories/{memory_id}` | 删除长期记忆及其索引副本 |

## 错误结构草案

```json
{
  "error": {
    "code": "TASK_PLAN_VERSION_CONFLICT",
    "message": "任务计划已更新，请重新确认。",
    "retryable": false,
    "correlation_id": "request-reference"
  }
}
```

## 关键错误类别

| 类别 | 示例 | 客户端处理 |
|---|---|---|
| 身份失效 | `AUTH_SESSION_EXPIRED` | 清理交互状态并重新登录 |
| 登录凭据无效 | `AUTH_INVALID_CREDENTIALS` | 保留账号输入，不推断账号或密码哪一项错误 |
| 版本冲突 | `TASK_PLAN_VERSION_CONFLICT` | 刷新真实数据后重新确认 |
| 权限拒绝 | `ACTION_NOT_ALLOWED` | 不自动重试，展示范围 |
| 资源离线 | `WORKSTATION_OFFLINE` | 展示等待、换设备或取消 |
| 供应商不可用 | `REALTIME_PROVIDER_UNAVAILABLE` | 提供重连或文字降级 |
| 速率限制 | `RATE_LIMITED` | 按服务端建议等待 |

## 待定项

- 大型产物上传、下载和临时访问契约。
- 账号密码身份接口以及任务、实时语音、工作机、提醒和记忆资源的机器契约；当前机器契约仍记录待迁移的验证码旧实现。
