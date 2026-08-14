---
id: "arcmind-known-issue-legacy-user-ownership"
type: "known_issue"
status: "current"
summary: "用户已确认把未绑定旧用户的 3 个会话合并到 owner；本地迁移通过，等待生产发布与访问验收。"
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

## 用户决策与实施状态

用户已经确认第二个旧用户也是本人历史账号，并选择合并到 `owner`。本地迁移将：

1. 迁移会话和响应直接所有权到 `owner`，轮次和事件通过外键链保持不变。
2. 删除未绑定旧用户的会话令牌，避免旧令牌获得合并后的全部数据权限。
3. 处理跨用户重复幂等键，删除空旧用户，收紧账号与密码摘要非空约束并移除 `users.email`。

`20260814_0004` 已通过 PostgreSQL 18.4 的空库、历史双用户、重复幂等键、升级、降级、再次升级和 36 个后端测试。在固定镜像生产迁移与 `owner` 访问全部 12 个历史会话验证完成前，本问题保持 `current`，不得提前标记关闭。
