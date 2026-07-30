# 技术选型与决策门禁

状态：current
最后校验日期：2026-07-30

本文记录 ArcMind V2 已确认的首阶段技术基线、明确延期的选择以及仍需专项验证的开放问题。具体依赖版本在创建工程骨架时锁定到当时稳定版，不在架构文档中追逐每个补丁版本。

## 选型原则

1. 先满足可验证的产品闭环，再优化理论扩展性。
2. 优先选择作者能独立部署、诊断和维护的组件。
3. 手机端兼容性以真实 iOS 和 Android 浏览器测试为准。
4. 实时语音先按质量筛选，再综合延迟、价格、接入稳定性和国内可用性。
5. 供应商能力必须通过正式文档、仓库更新或实测验证，不能依赖营销摘要。
6. 任何运行时依赖都要有升级、降级和替换边界。

## 已确认技术基线

| 领域 | 选择 | 状态 | 决策记录 |
|---|---|---|---|
| 仓库 | 单仓库三套独立应用 | accepted | `docs/decisions/0004-three-app-monorepo.md` |
| 手机 Web | React + TypeScript + Vite + React Router + TanStack Query | accepted | `docs/decisions/0006-mobile-web-stack.md` |
| 手机样式 | Tailwind CSS + CSS 变量设计令牌 | accepted | `docs/decisions/0006-mobile-web-stack.md` |
| 云端 API | Python 3.12 + FastAPI + Pydantic + Uvicorn | accepted | `docs/decisions/0005-cloud-agent-runtime-stack.md` |
| 产品主 Agent | LangGraph；ArcMind 领域服务和数据库保持事实所有权 | accepted | `docs/decisions/0005-cloud-agent-runtime-stack.md` |
| Python 工程 | uv + Ruff + Pyright + pytest | accepted | `docs/decisions/0007-engineering-baseline.md` |
| TypeScript 工程 | Node.js LTS + pnpm workspace + ESLint + Vitest | accepted | `docs/decisions/0007-engineering-baseline.md` |
| 端到端测试 | Playwright，覆盖 Chromium、WebKit 和 Firefox | accepted | `docs/decisions/0007-engineering-baseline.md` |
| 公开契约 | OpenAPI 3.1 + JSON Schema；生成客户端类型 | accepted | `docs/decisions/0007-engineering-baseline.md` |
| 本地与 VPS 编排 | Docker Compose | accepted | `docs/decisions/0007-engineering-baseline.md` |
| 工作机 MVP | Electron + TypeScript + React/Vite 渲染层 | accepted | `docs/decisions/0007-engineering-baseline.md` |

## 现在不选的内容

| 领域 | 状态 | 延期原因 | 决策时点 |
|---|---|---|---|
| 主数据库、迁移与检索 | open | 需要先完成领域数据与一致性分析 | 下一轮云端数据设计 |
| 耐久任务队列与提醒调度 | open | 必须结合任务租约、重试和延时语义选择 | 数据库设计之后 |
| 实时语音供应商与媒体协议 | open | 必须经过真机音质、打断、延迟和成本测试 | 文字任务闭环稳定后 |
| 主 Agent 模型供应商 | open | LangGraph 与模型解耦，需结合国内可用性和成本选择 | 文字对话纵向切片前 |
| 身份实现 | open | 邮箱验证、恢复、撤销和反滥用需专项设计 | 身份纵向切片前 |
| 可信 HTTPS | open | 需要针对无域名或有域名部署做真机验证 | 身份纵向切片前 |
| Web Push | open | 首版先使用页面内消息，浏览器推送后置 | 提醒阶段 |
| PWA | deferred | 不阻塞页面前台通话和任务查看 | 手机闭环稳定后 |

FastAPI 的进程内后台任务不能承担 ArcMind 的耐久任务队列。LangGraph 的 Checkpoint（检查点）也不能替代任务表、审计事件、提醒计划或跨设备业务事实。

## 关键取舍

### 为什么主 Agent 选择 LangGraph

- 官方定位就是长期、有状态 Agent 的低层编排框架，可在同一图中组合确定性步骤和模型步骤。
- Checkpoint 支持故障恢复和会话级状态，Interrupt（中断）支持等待用户确认后恢复，符合高风险动作审批。
- 框架不要求由 LangChain 托管模型，可在 ArcMind 适配层后接不同推理供应商。
- ArcMind 仍自行维护任务、记忆和审计领域；不把 LangGraph Store 当成整个产品数据库。

未选择 OpenAI Agents SDK 作为主骨架：它简单、成熟并支持会话、工具、人工介入和非 OpenAI 模型接入，但默认能力和实时 Agent 更偏 OpenAI 产品路径，不适合作为供应商可替换系统的最外层事实框架。它未来可以作为某个 OpenAI 专用适配器使用。

未选择 Mastra：TypeScript 统一栈很有吸引力，但当前官方文档仍把部分 Durable Agents（耐久 Agent）、Goals（目标）和 Schedules（调度）能力标为 Beta。未选择 CrewAI 和 AutoGen：它们更强调自主多 Agent 团队或分布式 Agent，不符合首版“一个主 Agent + 明确工具与任务事实”的最小复杂度原则。

### 为什么手机 Web 不选择 Next.js

首版没有 SEO（搜索引擎优化）、服务端渲染或 React 服务端组件需求，云端 API 也由 FastAPI 独立提供。React + Vite 生成静态前端，部署、调试和故障边界更简单。若未来出现公开内容页或服务端渲染需求，再单独评估 Next.js，不提前承担双后端心智负担。

### 为什么工作机 MVP 选择 Electron

Electron 可复用 React、TypeScript 和前端工程经验，并能从主进程调用 Codex CLI 等本地程序。代价是安装包较大且安全边界更严格，因此必须打包本地页面、关闭远程内容的 Node.js 集成、启用 Context Isolation（上下文隔离）和 Sandbox（沙箱），并校验所有 IPC（进程间通信）消息。Tauri 体积更小，但会在第一版引入 Rust；.NET 原生方案则引入另一套 UI 和语言生态，当前维护成本更高。

## 官方证据

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)
- [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/)
- [Mastra documentation](https://mastra.ai/docs)
- [FastAPI features](https://fastapi.tiangolo.com/features/)
- [React: Creating a React app](https://react.dev/learn/creating-a-react-app)
- [Vite guide](https://vite.dev/guide/)
- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Tauri introduction](https://v2.tauri.app/start/)
- [pnpm workspace](https://pnpm.io/workspaces)
- [uv projects](https://docs.astral.sh/uv/concepts/projects/)
- [Docker Compose](https://docs.docker.com/compose/)
- [Playwright](https://playwright.dev/docs/intro)

## 实时语音评测矩阵

候选可能包括 StepAudio 2.5 Realtime、国内其他实时语音服务以及 OpenAI Realtime API（OpenAI 实时应用程序接口）。列为候选不代表已选用。

| 维度 | 最低门槛 | 验证方式 |
|---|---|---|
| 打断 | AI 播放中可稳定中止并继续听取用户 | 真机多轮打断测试 |
| 音色 | 清晰自然、长对话无明显机械节奏 | 盲听评分和疲劳度测试 |
| 端到端延迟 | 达到自然轮流对话体验 | 分段测量采集、网络、首包和播放延迟 |
| 转写质量 | 口语、停顿、中文专有词可用 | 固定语料集对比 |
| 工具协作 | 能输出稳定文本或结构化事件供主 Agent 使用 | 接口验证和故障注入 |
| 稳定性 | 断线、限流、超时和取消行为可控 | 长连接与弱网测试 |
| 成本 | 可按真实分钟和并发估算 | 官方价格与用量实测 |
| 合规与可用性 | 部署地区和数据路径可接受 | 合同、文档和网络实测 |

## 明确排除

- 依赖个人 ChatGPT Plus（ChatGPT 个人订阅）私有接口作为稳定生产接入方案。
- 无法提供实时事件、打断控制或稳定转写的纯语音合成方案。
- 强制把供应商会话状态作为任务和长期记忆唯一事实的方案。
- 需要工作机开放公网入站端口才能使用的默认架构。

## 决策输出要求

每个技术选型记录至少包括：候选、证据、实测环境、优缺点、成本、失败降级、迁移方案和最终验收结果。
