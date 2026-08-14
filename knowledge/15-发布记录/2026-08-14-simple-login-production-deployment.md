---
id: "arcmind-release-20260814-simple-login-production"
type: "implementation_note"
status: "current"
summary: "账号密码固定镜像已完成生产迁移、公网文字、受限备份和重启恢复验收，Mailpit 与公共注册链路已从运行态移除。"
scope: ["identity", "database", "operations", "production-release"]
tags: ["password-login", "postgresql", "deployment", "acceptance"]
confidence: "high"
last_verified: "2026-08-14"
---

# 账号密码登录生产部署

## 关系导航

- 实施任务：[账号密码登录与数据库并发收敛](../14-开发方案/0016-simple-login-and-database-hardening.md)
- 身份决策：[单一账号密码身份基线](../10-架构决策/0018-simple-login-identity.md)
- 运行手册：[生产部署与健康检查](../12-运行手册/01-生产部署与健康检查.md)
- 验收矩阵：[第一阶段身份与文字闭环测试矩阵](../11-测试与验收/03-phase-1-test-matrix.md)

## 发布结果

- GitHub Actions（GitHub 自动化流水线）工作流 `31765547142` 在固定提交 `bd55a08d2ce5f488eb73d0c9c8d72979c5177c48` 上通过全仓检查、PostgreSQL 迁移、36 个后端测试及 API 与 Web 镜像发布。
- 生产先完成所有者账号自定义格式备份和结构检查，再升级到 `20260813_0003`、创建 `arcmind_runtime` 受限角色、切换固定镜像并用运行角色再次完成备份。
- 生产保留原有 2 个用户及其对话、轮次、响应和事件事实；验收数据之外未删除业务数据。Mailpit（测试邮件捕获服务）、验证码登录和本机 `8025` 监听已从运行态移除。
- 已绑定 `owner` 的旧用户拥有 9 个会话；另一个未绑定、无密码的旧用户仍拥有 3 个会话。数据保留但当前单账号不可访问，必须按[旧用户数据归属问题](../13-已知问题/legacy-user-ownership-after-login-migration.md)取得用户确认后再处理。
- `arcmind_runtime` 无超级用户、建库、建角色、复制和绕过行级安全权限；API 与 Worker 使用该角色，结构迁移继续使用所有者角色。

## 用户行为证据

- 公网可信 HTTPS、首页和就绪检查返回成功。
- 错误账号密码返回统一未授权；正确 `owner` 账号可登录并获得具备 `Secure`、`HttpOnly`、`SameSite=Lax`、`Path=/`、无 `Domain` 的 `__Host-arcmind_session` Cookie（浏览器会话凭据）。
- 创建会话、提交文字、SSE（服务器发送事件）增量、快照、完成、携带旧事件 ID 重连、最终助手轮次恢复、即时取消、退出和退出后会话失效通过。
- 整栈重启后固定镜像和证书恢复，重启前会话可读取，并能继续提问、接收完成事件和持久化新轮次；重启后的 API、Web、Worker 与 PostgreSQL 均健康。
- 生产登录明文未出现在 API 或 Worker 日志；重启后的核心服务日志没有新的异常。

## 队列升级证据

生产已有 Procrastinate `3.9.0` 的完整四张队列表和相关类型。该库官方 `apply_schema` 只支持空数据库，重复运行会在已有枚举处失败；旧、新镜像版本一致，因此本次没有覆盖或重建队列结构。运行手册已收敛为：空库只初始化一次，已有库先核对，供应商版本变化必须应用其 SQL 迁移。

## 剩余边界

- 当前生产仍使用确定性测试模型；真实 DeepSeek 接入不属于本次发布事实。
- 真实手机麦克风与实时语音、任务闭环、异地加密备份和独立恢复演练仍按各自阶段验收，不因本次身份文字发布自动完成。
- 原始登录密码、数据库密码、密钥、服务器地址和私密对话不进入仓库或知识库。
