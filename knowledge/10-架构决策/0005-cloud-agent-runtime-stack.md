---
id: "arcmind-doc-decisions-0005-cloud-agent-runtime-stack"
type: "decision"
status: "current"
summary: "云端使用 Python 3.12、FastAPI 与 Pydantic，产品主 Agent 通过 LangGraph 编排但领域服务维护业务事实。"
scope: ["decisions"]
tags: ["arcmind-v2", "decisions"]
confidence: "high"
last_verified: "2026-07-30"
---

# 决策 0005：云端与产品主 Agent 技术栈

状态：accepted
日期：2026-07-30

## 关系导航

- 所属领域：[决策内容地图](./00-架构决策地图.md)
- 架构结果：[云端后端](../07-后端设计/01-云端后端设计.md)、[产品 Agent Runtime 协作模型](../20-Agent运行时/01-产品Agent运行时协作模型.md)
- 选型基线：[技术选型与决策门禁](../09-技术调研/01-技术选型与决策门禁.md)
- 落实台账：[V2 首阶段技术基线](../14-开发方案/0004-v2-technology-baseline.md)

## 背景

ArcMind 云端既要提供普通 HTTP API、流式事件和长连接，又要承载主 Agent 的计划、审批和恢复逻辑。实时语音、模型和执行器必须可替换，任务与记忆事实不能被某个模型 SDK 私有状态接管。

## 决策

- 云端运行时使用 Python 3.12。
- Web API 使用 FastAPI，输入输出模型使用 Pydantic，ASGI（异步服务器网关接口）服务使用 Uvicorn。
- 产品主 Agent 编排使用 LangGraph。
- LangGraph 只负责 Agent 运行图、短期图状态、Checkpoint 和 Interrupt；ArcMind 领域服务及主数据库拥有用户、会话、任务、记忆、提醒和审计事实。
- 模型通过 ArcMind 的 `ModelProvider` 适配接口接入，不让业务模块直接依赖 OpenAI、StepFun 或其他供应商 SDK。
- 实时语音继续使用独立适配层，不把语音供应商会话对象传入主 Agent 领域层。

## 候选比较

| 候选 | 优点 | 不作为主骨架的原因 |
|---|---|---|
| LangGraph | 低层状态图、持久化、流式事件、人工确认、子图和恢复控制 | 需要自行设计领域模型和任务事实；这是 ArcMind 需要保留的控制权 |
| OpenAI Agents SDK | 原语少、上手快，内置工具、会话、追踪、人工介入和实时 Agent | 默认路径更偏 OpenAI；跨供应商时存在功能差异，适合专用适配器而非系统事实骨架 |
| Mastra | TypeScript 统一栈，Agent、工作流、记忆和语音能力齐全 | 部分耐久 Agent、目标和调度能力仍为 Beta，首版不承担成熟度风险 |
| CrewAI | Flow 与 Crew 的多 Agent 组织清晰 | 首版不需要自治 Agent 团队，角色抽象会增加状态归属复杂度 |
| AutoGen | 事件驱动、多 Agent 和分布式扩展能力强 | 更适合多 Agent 研究与复杂分布式系统，超出首版需求 |

## 重要边界

- LangGraph Checkpoint 不是业务数据库事务，也不是耐久消息队列。
- FastAPI `BackgroundTasks` 只用于进程内短任务，不用于跨重启任务、提醒或工作机派发。
- 主 Agent 不能直接修改任务状态；必须调用任务编排领域接口。
- 子 Agent 是未来可插拔执行资源，不是每个任务都要创建的默认结构。

## 风险与迁移

| 风险 | 控制 |
|---|---|
| LangGraph 状态与业务表出现双重事实 | 只把图状态当运行态；业务状态变化必须经领域服务提交 |
| Python 异步代码和阻塞 SDK 混用 | 适配层隔离阻塞调用，并在集成测试中检查事件循环阻塞 |
| 框架升级改变序列化或恢复语义 | 固定版本、保存最小图状态、建立暂停与恢复回归测试 |
| 未来更换 Agent 框架 | 领域接口、事件和数据库不依赖 LangGraph 类型，迁移只替换编排层 |

## 官方证据

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)
- [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [FastAPI features](https://fastapi.tiangolo.com/features/)
- [OpenAI Agents SDK models](https://openai.github.io/openai-agents-python/models/)
- [Mastra documentation](https://mastra.ai/docs)

## 验收门禁

创建正式主 Agent 模块前，必须用一次性技术验证证明：流式输出、Checkpoint 恢复、Interrupt 审批、取消和模型适配器替换可以在不直接写任务表的情况下工作。
