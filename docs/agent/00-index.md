# AGENT 文档索引

本目录是 ArcMind 的 agent 操作系统。任何 agent 都应先从这里确认阅读顺序，再进入代码修改。

## 通用阅读顺序

1. `AGENTS.md`：仓库入口和硬规则。
2. `docs/agent/00-index.md`：当前文档地图。
3. `docs/agent/01-project-overview.md`：项目目标、当前阶段和非目标。
4. `docs/agent/02-architecture.md`：整体架构、进程边界和模块边界。
5. `docs/agent/03-tech-stack.md`：技术栈和依赖策略。
6. `docs/agent/quality.md`：质量门禁。
7. `docs/agent/review.md`：自查和评审要求。
8. 按任务类型阅读 `docs/agent/workflows/` 下对应流程。
9. 按修改范围阅读 `docs/agent/modules/` 下对应模块说明。
10. 涉及架构、外部方案、新技术或重大取舍时，阅读 `docs/agent/04-decisions.md`。

## 任务路由

- 新增功能：阅读 `workflows/new-feature.md` 和 `checklists/new-feature-checklist.md`。
- 修复 bug：阅读 `workflows/bug-fix.md` 和 `checklists/bug-fix-checklist.md`。
- 重构：阅读 `workflows/refactor.md` 和 `checklists/refactor-checklist.md`。
- 性能优化：阅读 `workflows/performance.md`。
- 代码评审：阅读 `review.md` 和 `checklists/review-checklist.md`。
- UI 与视觉改造：阅读 `design-system.md`、`design-ops.md`、`workflows/ui-change.md` 和 `checklists/ui-change-checklist.md`。
- 模型接入或模型供应商变更：阅读 `workflows/model-integration.md` 和 `modules/ai-runtime.md`。
- 语音输入、语音播报或音频状态：阅读 `modules/voice-runtime.md`。
- 粒子、WebGL、动画状态机或沉浸式界面：阅读 `modules/visual-system.md`。
- CPU、内存、磁盘、GPU 或本机系统状态展示：阅读 `modules/system-telemetry.md`。
- 本地记忆、会话历史、设置或数据库：阅读 `modules/memory-storage.md`。
- API Key、权限、隐私和敏感数据：阅读 `modules/security.md`。
- 依赖漏洞审计、暂缓修复和升级复查：阅读 `dependency-security.md`。
- 版本控制、提交、推送、发布：阅读 `workflows/version-control.md` 和 `checklists/version-control-checklist.md`。

## 文档维护原则

- `AGENTS.md` 只保留入口规则和硬约束。
- 项目事实维护在 `docs/agent/`，不得散落到临时任务说明里。
- 新增模块必须新增对应模块文档，或明确记录为什么暂不需要。
- 项目事实变化时，先更新对应文档，再让后续 agent 依赖它。
- Markdown 文档默认使用中文；代码标识、命令、依赖名、协议名和外部专有名词保留英文。
