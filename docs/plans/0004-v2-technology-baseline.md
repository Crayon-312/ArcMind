# 方案落实台账：V2 首阶段技术基线

状态：done
最后更新：2026-07-30

## 关系导航

- 所属领域：[计划内容地图](00-plans-map.md)
- 选型入口：[技术选型与决策门禁](../architecture/08-technology-selection.md)
- 发布决策：[云端与产品主 Agent 技术栈](../decisions/0005-cloud-agent-runtime-stack.md)、[手机 Web 技术栈](../decisions/0006-mobile-web-stack.md)、[跨端工程与工作机基线](../decisions/0007-engineering-baseline.md)
- 验收标准：[第一阶段设计就绪验收](../quality/02-phase-1-design-acceptance.md)

## 目标

基于 ArcMind V2 三端边界和第一阶段闭环，核对官方资料，确定会影响工程骨架的技术栈，并把数据库、队列、身份、HTTPS 和实时语音等需要专项分析的选择保留到正确阶段。

## 非目标

- 不创建业务代码或三套应用工程骨架。
- 不选择数据库、消息队列、实时语音供应商或主 Agent 模型供应商。
- 不把 LangGraph Checkpoint 当作任务、记忆或提醒数据库。
- 不启动尚不存在的开发服务。

## 已确认点

- 单仓库管理手机 Web、云端和工作机三套独立应用。
- 手机 Web 使用 React + TypeScript + Vite。
- 云端使用 Python 3.12 + FastAPI，产品主 Agent 使用 LangGraph。
- 工作机 MVP 使用 Electron + TypeScript，并执行严格渲染器隔离。
- HTTP 契约使用 OpenAPI 3.1，事件使用版本化 JSON Schema。
- 跨语言仓库分别使用 pnpm workspace 和 uv，不先引入额外 Monorepo 任务框架。

## 延期项

- 主数据库、迁移、备份和检索。
- 耐久队列、重试、任务租约和延时提醒。
- 邮箱身份实现、可信 HTTPS 和实时事件传输。
- 首个模型供应商、实时语音供应商和通知渠道。

## 系统影响矩阵

| 影响类型 | 内容 | 状态 | 写回位置 |
|---|---|---|---|
| 架构 | 确定云端、主 Agent、手机和工作机运行时 | current | [技术选型与决策门禁](../architecture/08-technology-selection.md) |
| 仓库 | 单仓库三应用从提议转为正式决策 | current | [决策 0004](../decisions/0004-three-app-monorepo.md) |
| 接口 | 确定 OpenAPI 3.1 与 JSON Schema 契约源 | current | [决策 0007](../decisions/0007-engineering-baseline.md) |
| 数据 | 明确框架运行态不得替代领域事实 | current | [决策 0005](../decisions/0005-cloud-agent-runtime-stack.md) |
| 安全 | 增加 Electron 隔离、IPC 校验和本地页面要求 | current | [决策 0007](../decisions/0007-engineering-baseline.md) |
| 测试 | 确定 pytest、Vitest 和 Playwright 分层 | current | [决策 0006](../decisions/0006-mobile-web-stack.md)、[决策 0007](../decisions/0007-engineering-baseline.md) |
| 发布 | 确定 Docker Compose 单 VPS 基线 | current | [决策 0007](../decisions/0007-engineering-baseline.md) |
| 记忆 | 技术栈与开发顺序写回，关闭宽泛开放问题 | current | `.agent-context/memory-sources/` |

## 任务清单

| 顺序 | ID | 任务 | 依赖 | 验收口径 | 状态 |
|---:|---|---|---|---|---|
| 1 | T1 | 读取项目边界、质量门禁与技术开放问题 | 现有 V2 文档 | 当前事实和开放问题分离 | done |
| 2 | T2 | 核对 Agent 框架官方能力与成熟度 | T1 | 覆盖状态、恢复、人工确认、多供应商和替代方案 | done |
| 3 | T3 | 核对手机、云端、工作机和工程工具官方资料 | T1 | 覆盖开发、测试、部署和安全边界 | done |
| 4 | T4 | 形成技术选型与独立决策记录 | T2-T3 | 当前选择、未选原因、风险和迁移边界完整 | done |
| 5 | T5 | 同步索引、质量门禁、风险和项目记忆 | T4 | 状态与证据路径一致 | done |
| 6 | T6 | 运行验证并创建本地提交 | T5 | 项目检查和差异检查通过 | done |

## 工作区模式

本任务属于 S3 架构决策，但按用户此前明确要求在当前 `v2` 工作目录串行完成。本轮工作区初始干净、没有并行 Agent、没有共享文件竞争，因此不创建额外 Git worktree。

## 多 Agent 说明

本任务未启用子 Agent：当前上层规则不允许主动委派，且技术取舍、决策状态与项目记忆需要由单一主 Agent 串行核对。

## 完成核对

- [x] 核心框架候选已比较并引用官方资料。
- [x] 当前必须确定和延期项已分开。
- [x] LangGraph、任务表、队列和长期记忆边界已澄清。
- [x] 三端与工程基线已形成独立决策记录。
- [x] 项目检查和差异检查完成；本地提交在本台账更新后执行。

## 变更记录

- 2026-07-30：用户要求开始定下技术栈并由 Codex 按顺序主动引导。
- 2026-07-30：完成官方证据核对和技术决策写回，进入验证阶段。
- 2026-07-30：项目检查、下游薄入口检查、JSONL 校验和差异检查通过。
