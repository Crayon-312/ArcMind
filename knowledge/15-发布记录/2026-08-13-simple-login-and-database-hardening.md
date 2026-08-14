---
id: "arcmind-release-20260813-simple-login-database-hardening"
type: "implementation_note"
status: "current"
summary: "2026-08-13 本地实现完成账号密码、两档数据库权限和并发保护；后续生产结果由 2026-08-14 发布记录接续。"
scope: ["identity", "database", "concurrency", "release"]
tags: ["login", "postgresql", "idempotency", "local-release"]
confidence: "high"
last_verified: "2026-08-13"
---

# 账号密码登录与数据库并发加固实现

## 关系导航

- 实施任务：[账号密码登录与数据库并发收敛](../14-开发方案/0016-simple-login-and-database-hardening.md)
- 身份决策：[单一账号密码身份基线](../10-架构决策/0018-simple-login-identity.md)
- 机器契约：[第一阶段机器契约](../04-接口与事件/04-第一阶段机器契约.md)
- 验收证据：[第一阶段身份与文字闭环测试矩阵](../11-测试与验收/03-phase-1-test-matrix.md)
- 部署顺序：[生产部署与健康检查](../12-运行手册/01-生产部署与健康检查.md)

## 已实现

- 登录接口收敛为单一账号密码，手机 Web、OpenAPI（开放式接口描述规范）和生成类型同步更新；验证码、SMTP（简单邮件传输协议）和 Mailpit（测试邮件捕获服务）运行依赖移除。
- 密码使用标准库 scrypt（抗暴力密码派生算法）摘要；真实摘要由部署环境注入，支持更新配置后在成功登录时同步轮换。
- 旧用户首次正确登录时原位绑定账号，保留用户、会话、对话、响应和队列事实。
- 数据库权限只分所有者/迁移角色与 `arcmind_runtime` 运行角色；运行角色无结构修改权限，但可以完成业务、队列和备份读写。
- 同一会话通过行锁串行提交，并由活动响应部分唯一索引兜底；相同幂等键并发返回同一业务结果。

## 验证与发布边界

- WSL（Windows 的 Linux 子系统）隔离 PostgreSQL 18.4 完成 35 个后端测试；受限运行账号复跑关键业务测试和 `pg_dump -Fc` 备份通过。
- Windows 本地的异步命令入口使用兼容的 Selector 事件循环；Linux 容器路径保持标准事件循环。
- 本记录描述 2026-08-13 的本地实现和隔离数据库边界；后续生产切换已经完成，见[账号密码生产部署](./2026-08-14-simple-login-production-deployment.md)。历史边界不再代表当前线上状态。
