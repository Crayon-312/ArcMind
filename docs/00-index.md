# ArcMind V2 项目文档索引

状态：current
最后校验日期：2026-07-30

本目录描述 ArcMind V2 的产品事实、业务流程、系统边界、公开契约和阶段计划。Agent Context OS（智能协作上下文操作系统）的完整开发规则不复制到这里；开发工具从 `AGENTS.md` 和 `.agent-context/config.json` 加载外部引擎。

## 必读顺序

所有涉及产品或架构的任务至少读取：

1. `AGENTS.md`
2. `.agent-context/config.json`
3. 本文件
4. `product/01-background-and-vision.md`
5. `product/02-scope-and-requirements.md`
6. `architecture/01-system-context.md`
7. 当前任务对应的模块或业务文档

## 文档地图

### 产品

- `product/01-background-and-vision.md`：项目背景、定位、价值和非目标。
- `product/02-scope-and-requirements.md`：功能需求、质量要求和优先级。
- `product/03-users-and-scenarios.md`：用户类型和关键使用场景。
- `product/04-delivery-roadmap.md`：从文档基线到手机端、云端和工作机端的交付顺序。
- `product/05-build-sequence.md`：云端先行、纵向切片联调的具体实施顺序提议。

### 架构（`docs/architecture/`）

- `architecture/01-system-context.md`：系统组成、信任边界和端到端数据流。
- `architecture/02-mobile-web.md`：手机 Web 端职责和限制。
- `architecture/03-cloud-backend.md`：云端服务职责和内部模块。
- `architecture/04-workstation-client.md`：可选工作机端的职责、权限和连接方式。
- `architecture/05-agent-runtime.md`：产品运行时主 Agent、语音层和执行器的协作方式。
- `architecture/06-data-and-memory.md`：会话、记忆、任务和提醒的数据职责。
- `architecture/07-security-and-deployment.md`：传输、身份、设备、权限和部署边界。
- `architecture/08-technology-selection.md`：尚未定案的技术选型及决策门禁。
- `architecture/09-repository-and-deployable-apps.md`：一个仓库、三套应用和共享契约的代码组织提议。
- `architecture/10-three-end-risk-review.md`：三端方案的一致性检查、风险和修正建议。

### 领域与模块

- `domain/00-glossary.md`：产品统一语言和容易混淆的术语边界。
- `domain/01-core-domain-model.md`：核心业务对象、关系、所有权和不变量。
- `modules/`：手机端、身份、会话、主 Agent、任务、记忆、提醒和工作机等模块卡片。

### 业务与契约

- `business/01-conversation-flow.md`：实时对话到任务确认的主流程。
- `business/02-task-lifecycle.md`：任务状态机、执行与进度反馈。
- `business/03-reminder-and-notification.md`：定时提醒和完成通知。
- `contracts/01-cross-end-events.md`：跨端事件的语义级契约基线。
- `contracts/02-cloud-public-api.md`：手机端访问云端的资源级 API 草案。
- `contracts/03-workstation-channel.md`：云端与工作机连接和执行协议草案。

### 决策、计划与质量

- `decisions/0001-v2-independent-line.md`：V2 与旧版双线并存决策。
- `decisions/0002-cloud-centered-topology.md`：采用云端中枢和可选工作机扩展的决策。
- `decisions/0003-development-engine-boundary.md`：开发协作引擎与产品运行时分离决策。
- `decisions/0004-three-app-monorepo.md`：单仓库三应用的待确认决策。
- `plans/0001-v2-documentation-foundation.md`：本轮文档基线落实台账。
- `plans/0002-v2-design-readiness.md`：领域与模块设计细化台账。
- `plans/0003-three-app-architecture-review.md`：三端代码组织和开发顺序审查台账。
- `quality/01-documentation-acceptance.md`：当前阶段的文档验收口径。
- `quality/02-phase-1-design-acceptance.md`：进入第一阶段代码开发前的设计门禁。

## 状态规则

- `current`：用户已确认且当前有效，可作为开发依据。
- `draft`：结构化草稿，必须确认后才能作为实现依据。
- `assumption`：用于推进分析的假设，必须验证。
- `open`：存在明确待决问题。
- `deprecated`：已废弃，仅用于追溯。

## 更新规则

- 产品定位或范围变化：更新 `product/`、相关决策和项目记忆。
- 端侧职责或依赖变化：更新 `architecture/`、跨端契约和项目记忆。
- 流程、状态或验收变化：更新 `business/`、`quality/` 和相关记忆。
- 技术选型只有通过 `architecture/08-technology-selection.md` 的决策门禁后才能成为 `current`。
- 项目记忆用于检索，本文档体系用于承载完整事实；两者必须保持一致。
