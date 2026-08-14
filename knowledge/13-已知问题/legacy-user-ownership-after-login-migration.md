---
id: "arcmind-known-issue-legacy-user-ownership"
type: "known_issue"
status: "current"
summary: "生产账号密码迁移后，一个未绑定旧用户仍拥有 3 个会话；合并、保留还是删除必须由用户确认。"
scope: ["identity", "data-migration", "production"]
tags: ["legacy-user", "conversation-ownership", "open-question"]
confidence: "high"
last_verified: "2026-08-14"
---

# 账号密码迁移后的旧用户数据归属

## 关系导航

- 实施任务：[账号密码登录与数据库并发收敛](../14-开发方案/0016-simple-login-and-database-hardening.md)
- 数据规则：[数据存储、事务与检索设计](../05-数据模型/01-数据存储事务与检索.md)
- 生产证据：[账号密码登录生产部署](../15-发布记录/2026-08-14-simple-login-production-deployment.md)

## 已确认事实

- 生产在迁移前后都保留 2 个旧用户，未删除用户、会话或对话事实。
- `owner` 已原位绑定到最早的旧用户，该用户拥有 9 个会话。
- 第二个旧用户仍未绑定账号、没有密码摘要，但拥有 3 个会话；当前唯一账号无法读取这些会话。
- 公开注册、邮箱验证码和 Mailpit 已移除；`users.email` 目前只为旧数据识别与安全处置保留，不参与公开登录。

## 需要用户确认

必须确认第二个旧用户是否也是本人历史账号：

1. 若是本人数据，迁移其 3 个会话及下游轮次、响应和事件的所有权到 `owner`，验证计数与访问后删除空旧用户和 `users.email` 历史字段。
2. 若需要保留为独立身份，当前单账号产品边界必须调整，不能直接删除登录入口或身份记录。
3. 若确认是可删除测试数据，先做独立备份和精确清单，再删除该用户的完整依赖链；不得只删 `users` 行或遗留孤儿事实。

在用户确认前不得自动合并、删除、暴露邮箱值或移除 `users.email`。AUTH-04 和阶段 1 退出保持待办。
