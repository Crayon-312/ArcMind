# 架构说明

## 当前架构状态

项目计划采用 Windows 优先的本地桌面应用架构：

- Electron main process 管理窗口、IPC、配置、模型代理、语音服务编排、本地数据库和应用生命周期。
- Renderer process 运行 React 应用、聊天界面、设置界面和 Three.js/WebGL 粒子视觉。
- Preload 只暴露 typed `window.arcMind`，作为 renderer 与 main 的安全桥接。
- 本地存储保存会话历史、设置、长期记忆索引和必要审计日志。
- 系统状态遥测由 main process 聚合读取 CPU、内存、磁盘和 GPU 可用状态，通过 preload 的只读接口提供给 renderer，不暴露本地路径或系统控制能力。
- AI Runtime 负责模型供应商适配、流式回复、错误归一化和上下文组装。
- Voice Runtime 负责语音输入、录音状态、ASR、TTS 和播放生命周期。
- 长期记忆由 main process 持久化并在 AI Runtime 组装上下文时注入，renderer 只通过 preload 进行用户可见管理。
- 产品化层由 main process 负责脱敏运行日志、崩溃恢复和运行信息 IPC，renderer 负责错误边界和用户可见恢复入口。

## 架构原则

- 清晰分层：界面、视觉、模型、语音、存储、安全和桌面能力保持边界清楚。
- 单向依赖：renderer 通过 preload 暴露的接口访问能力，不直接调用 Node、文件系统或密钥存储。
- 可替换外部系统：模型供应商、ASR、TTS、数据库和打包工具应通过适配层隔离。
- 流式优先：聊天输出、视觉状态和语音播报都应能处理渐进式状态。
- 隐私优先：敏感配置和对话内容必须有明确存储位置、展示边界和删除能力。
- 可验证设计：核心上下文组装、模型请求、记忆策略和状态机应优先放在可单元测试的位置。

## 计划分层

- `src/main`：Electron main、IPC handlers、服务编排、模型代理、配置和生命周期。
- `src/preload`：`contextBridge` 安全桥接。
- `src/renderer`：React UI、Three.js 视觉系统、聊天视图、设置视图。
- `src/shared`：typed IPC contract、schemas、状态枚举、错误结构和共享类型。当前已包含 `ChatMessage`、`ConversationState`、`CoreMode`、`AiStreamEvent`、`AppError` 和视觉状态推导工具。
- `src/db`：本地数据库 schema、migration 和 repository。
- `src/ai`：模型供应商适配、prompt、上下文管理和工具调用协议。
- `src/voice`：ASR/TTS 抽象、录音和播放状态。
- `tests`：单元、集成、renderer 和后续 Electron smoke tests。

## 进程边界

- Renderer 禁止直接访问 Node API、文件系统、数据库、系统密钥或环境变量。
- Preload 只暴露明确的 typed API，不暴露任意命令执行或通用文件读写。
- Main process 是持久化写入、密钥读取、模型请求代理和本地服务编排的边界。
- 系统状态采样必须留在 main process，renderer 只消费结构化快照，不直接调用系统命令或硬件接口。
- AI Runtime 不直接渲染 UI；它只返回结构化状态、流式文本、错误和元数据。
- Voice Runtime 不直接修改聊天历史；语音结果应通过会话服务进入对话流。
- 视觉系统只消费 renderer 组装出的 `CoreMode` 与 `VisualSignal`，不得直接调用 AI Runtime、Voice Runtime 或存储层。
- Renderer 错误边界不得把 UI 状态、prompt、对话内容或敏感配置序列化到日志。

## 对话状态机

第一版对话与视觉共享以下高层状态：

- `idle`：待机或没有活动请求。
- `listening`：用户正在录音或输入语音。
- `transcribing`：语音正在识别。
- `thinking`：模型请求已发出，等待或接收流式内容。
- `speaking`：正在语音播报。
- `muted`：语音播报关闭。
- `error`：模型、网络、语音或存储失败。

状态变化必须可被 renderer 订阅，视觉系统不得自行推断业务状态。

## 外部方案处理规则

外部项目、论文、模型文档和 AI 生成方案只能作为设计输入。处理流程：

1. 摘要记录到 `docs/agent/04-decisions.md`。
2. 标记状态：候选、已采纳、已拒绝、待验证。
3. 对关键技术事实查官方文档或写最小原型验证。
4. 只把被验证或明确决定的结论写入架构事实。
