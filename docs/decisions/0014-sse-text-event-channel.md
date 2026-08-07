# 决策 0014：文字闭环使用 SSE 事件通道

状态：accepted
日期：2026-08-06
最后校验日期：2026-08-07

## 关系导航

- 所属领域：[决策内容地图](00-decisions-map.md)
- 业务来源：[实时对话与任务形成](../business/01-conversation-flow.md)
- 契约结果：[跨端事件契约基线](../contracts/01-cross-end-events.md)、[云端公开 API 契约草案](../contracts/02-cloud-public-api.md)
- 模块边界：[会话与实时交互](../modules/conversation-runtime.md)
- 落实台账：[第一阶段开发入口门禁](../plans/0009-phase-1-entry-gate.md)

## 背景

第一条文字纵向切片需要服务端持续向手机发送模型增量、完成、失败和任务进度。浏览器到云端的主要控制动作仍是普通 HTTP 请求，当前没有双向高频二进制传输需求。

## 决策

- 手机到云端的创建、取消和确认继续使用普通 HTTPS（安全超文本传输协议）请求；云端到手机的文字增量和状态更新使用 SSE（服务器发送事件）。
- `POST /conversations/{conversation_id}/turns` 持久化用户轮次并返回 `202`、`response_id` 和事件流地址；`GET /responses/{response_id}/events` 返回 `text/event-stream`。
- SSE 通过同源安全 Cookie（浏览器会话凭据）鉴权。每条事件包含响应内单调序号、稳定事件 ID、类型、响应 ID 和服务端时间，不直接透传模型供应商事件。
- 最小事件集为 `response.started`、`response.snapshot`、`response.delta`、`response.completed`、`response.failed`、`response.cancelled` 和 `heartbeat`。
- 浏览器重连携带 `Last-Event-ID`。服务端先发送权威 `response.snapshot`，客户端用快照替换当前临时文本，再接收更高序号增量；重复事件按 ID 和序号忽略。
- 生成中的文本按最多 500 毫秒或新增 256 字符形成可恢复快照，最终响应单独持久化。首版把有序 SSE 事件写入 `response_events` 作为耐久投递与诊断记录；增量仍不是最终会话事实，服务重启后无法恢复的生成标记为失败并允许用户重试。
- 心跳默认 15 秒；连接失效不取消模型生成。用户显式取消使用独立 HTTPS 命令，服务端按 `response_id` 幂等处理并停止继续发布旧增量。
- 任务进度复用相同事件信封，但读取耐久 `TaskEvent`；任务状态不得由临时 SSE 连接拥有。工作机长期双向通道仍单独评估，不由本决策预先指定。

## 为什么不用 WebSocket

WebSocket（网页套接字）适合持续双向消息，但第一阶段控制动作已经由 HTTP 清晰表达。现在引入 WebSocket 会增加连接鉴权、命令幂等、双向心跳和代理故障面，而不会改善文字服务端推送。实时语音与工作机连接具有不同协议需求，后续可独立使用 WebSocket，不要求全系统只有一种传输。

## 恢复与错误

| 场景 | 行为 |
|---|---|
| 短暂断线 | 浏览器自动重连，服务端先发快照再继续增量 |
| 事件序号缺口 | 客户端丢弃临时拼接并采用新快照 |
| 会话失效 | SSE 返回或发送 `AUTH_SESSION_EXPIRED` 后关闭，客户端重新登录 |
| 模型超时或限流 | 持久化失败类别和可重试性，发送 `response.failed` |
| 服务进程重启 | 已完成响应从数据库恢复；未完成生成进入可识别失败，不伪造完成 |
| 客户端重复取消 | 返回同一取消结果，不重复调用供应商取消 |

## 验收门禁

- 覆盖正常增量、完成、模型错误、显式取消、迟到增量丢弃和会话撤销。
- 覆盖在不同序号断线、携带 `Last-Event-ID` 重连、重复事件、快照替换和服务进程重启。
- Caddy（自动 HTTPS 反向代理）不得缓存或缓冲 SSE，连接和应用超时需大于心跳窗口。
- 最终轮次和任务状态必须在关闭 SSE 后仍可通过普通查询接口恢复。

## 官方证据

- [MDN：Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [HTML Standard：Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)
