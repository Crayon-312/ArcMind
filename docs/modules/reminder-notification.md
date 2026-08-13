---
id: "arcmind-doc-modules-reminder-notification"
type: "architecture_rule"
status: "draft"
summary: "模块边界《模块卡片：提醒与通知》的当前事实、边界与关联依据。"
scope: ["modules"]
tags: ["arcmind-v2", "modules"]
confidence: "medium"
last_verified: "2026-07-30"
---

# 模块卡片：提醒与通知

状态：draft
最后校验日期：2026-07-30

## 关系导航

- 所属领域：[模块内容地图](00-modules-map.md)
- 调度架构：[耐久 Job、调度与恢复设计](../architecture/12-durable-jobs-and-scheduling.md)
- 业务流程：[提醒与通知](../business/03-reminder-and-notification.md)
- 事件契约：[跨端事件契约基线](../contracts/01-cross-end-events.md)

## 职责

管理提醒计划、触发实例、通知消息、投递尝试、读取状态和用户通知偏好。

## 不负责

不拥有任务状态，不将通知投递成功等同于任务完成，不依赖手机页面内定时器。

## 允许依赖

- PostgreSQL 持久化规则与 Reminder Scheduler。
- `JobQueue` 端口和 Outbox 投递器。
- 页面内事件和可选推送适配器。
- 任务、审批和设备事件的公开订阅。

## 禁止依赖

- 直接修改任务或审批结果。
- 未经用户启用使用额外外部通知通道。
- 以客户端时间作为唯一触发依据。

## 数据流

```text
提醒计划 -> 到期扫描 -> 唯一触发实例 -> Notification/Outbox -> 投递 Job -> 已读/失败
```

## 验证方式

- 时区、重复计划、错过触发、重试、去重和权限拒绝测试。
- 多 Scheduler 并发扫描、停机补偿和重复 Job 测试。
- 页面离线后重新连接的消息补偿测试。

## 常见风险

- 夏令时或时区变化导致重复/遗漏。
- 推送失败后业务事件不可查询。
- 重试生成多条重复消息。
- 把远期提醒只保存在队列 ETA 中，导致升级或恢复后无法核对业务计划。
