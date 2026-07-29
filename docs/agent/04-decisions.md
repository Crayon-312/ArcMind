# 架构决策记录

本文记录已讨论、候选、已采纳或已拒绝的重要取舍。外部方案和 AI 生成建议必须先进入这里，不能直接成为项目事实。

## 已采纳

### 2026-07-29：GPT-Live 实时语音采用 codex-LB 专用配置和失败关闭门禁

- 状态：已采纳。
- 决策：文字模型继续使用独立的 OpenAI-compatible 配置；GPT-Live 实时语音使用独立的 `codex-lb-live` 配置。设置界面必须声明该能力只兼容 codex-LB 的私有 Codex Live Voice 路由，不能把普通文字接口兼容性视为实时语音兼容性。
- 检测：main process 读取 codex-LB 的 OpenAPI 文档，确认服务身份和 `POST /backend-api/codex/realtime/calls` 路由，再通过只读的 `GET /v1/usage` 验证代理 API Key 已注册。检测不提交 SDP、不创建通话。
- 门禁：只有检测状态为 `available` 才允许用户在界面选择启用；保存 `enabled: true` 时 main process 必须再次检测，失败则拒绝持久化。地址或密钥草稿变化后，renderer 立即使旧检测结果失效并关闭草稿中的启用状态。
- 已验证事实：以上路由和密钥要求来自 2026-07-29 检查的 `Soju06/codex-lb` 当前源码与 `docs/live-voice.md`。codex-LB 明确说明这是已安装 Codex 应用使用的私有兼容面，不是 OpenAI 公共 Realtime API，也不代理 WebRTC 媒体。
- 官方边界：OpenAI 的 [Realtime and audio](https://developers.openai.com/api/docs/guides/realtime) 文档说明，公共 GA WebRTC 流程使用 `POST /v1/realtime/client_secrets` 和 `/v1/realtime/calls`；这与本项目当前探测的 codex-LB 私有 `/backend-api/codex/realtime/calls` 路径不同。
- 边界：该检测只能确认 codex-LB 服务、Live Voice 路由和代理密钥；ChatGPT 账户实际语音权益只能在后续建立真实会话时由上游最终确认。当前任务不实现 WebRTC 媒体、WebSocket 控制侧通道或实时通话状态机。
- 原因：实时语音协议与普通 OpenAI-compatible 文字接口不是同一能力。独立配置可以保留任意文字模型供应商，同时以失败关闭方式防止不支持的中转服务被误启用。

### 2026-06-30：v1 模型接入采用 OpenAI-compatible HTTP 适配层

- 状态：已采纳。
- 决策：文字聊天先通过 Electron main process 内的 OpenAI-compatible `/chat/completions` 流式 HTTP 适配层实现，不在 renderer 中持有 API Key 或供应商请求细节。
- 原因：OpenAI-compatible 协议覆盖面广，便于先形成可聊天闭环；后续可在 AI Runtime 中扩展其他供应商，而不影响 UI 契约。

### 2026-06-30：会话历史先采用 `sql.js` 写入 SQLite 文件

- 状态：已采纳。
- 决策：本地会话历史先在 Electron main process 中用 `sql.js` 读写 SQLite 文件，数据库文件位于 Electron `userData`。
- 原因：避免第一阶段被 native SQLite 的 Windows/Electron 编译与打包问题阻塞，同时保留 SQLite 文件和 repository 边界，后续可替换为 native 实现。

### 2026-06-30：v1 语音输入采用点击录音和 OpenAI-compatible ASR

- 状态：已采纳。
- 决策：v1 只做点击说话，不做唤醒词或持续监听。renderer 使用 `MediaRecorder` 采集临时音频，main process 使用已配置的 OpenAI-compatible Base URL 调 `/audio/transcriptions`。
- 原因：与当前模型配置和安全边界复用，能先形成语音输入闭环；音频不落盘，降低隐私风险。

### 2026-06-30：v1 语音播报先采用 Web Speech API

- 状态：已采纳。
- 决策：v1 TTS 先在 renderer 使用浏览器内置 `speechSynthesis` 播放模型回复，支持静音和停止播报；preload 保留 `window.arcMind.voice.speak` / `stopSpeaking` typed API 作为后续 main process TTS provider 接入点。
- 原因：无需新增云端 TTS 配置或保存音频文件即可形成“可读也可听”的第一版闭环，同时不改变 API Key 仍由 main process 持有的安全边界。

### 2026-07-01：v1 长期记忆先采用手动保存和显式启用

- 状态：已采纳。
- 决策：长期记忆 v1 只支持用户手动新增、查看、编辑、删除和启用/禁用，不自动从对话中抽取或总结。AI Runtime 在 system prompt 中注入 ArcMind 人格，并只附加当前启用的记忆。
- 原因：手动记忆能先满足可控、可删除和隐私可信的产品目标，避免自动记忆在早期阶段误收集敏感信息；上下文组装集中在 main process，renderer 不直接访问数据库或模型请求细节。

### 2026-07-01：Jarvis 感增强通过轻量视觉信号驱动

- 状态：已采纳。
- 决策：v1 不引入新的动画库或外部视觉资产，而是在 renderer 中用共享 `VisualSignal` 驱动 `ParticleCore`：流式 token 触发短脉冲，错误触发闪断，思考态聚合粒子，播报态产生波形，麦克风低/中/高频和节奏分别影响粒子大小、轨道速度、核心亮度和环形波动。
- 原因：保持视觉系统由真实业务和音频状态驱动，避免堆叠不可验证的装饰效果；复用现有 Three.js 场景和低性能降级策略，减少第一版风险。

### 2026-07-01：产品化 smoke 采用 Electron 生产 renderer 启动检查

- 状态：已采纳。
- 决策：v1 产品化先使用 `npm run smoke` 启动已构建的 Electron renderer，自动检查应用标题、输入框、模型设置入口、记忆入口和粒子 canvas 非空白；Windows 安装包继续使用 `electron-builder` NSIS。
- 原因：无需引入额外端到端测试框架即可验证第一屏关键能力和 WebGL 渲染，适合作为打包前的轻量 smoke gate。

### 2026-07-01：左侧会话采用边缘触发抽屉，弦核支持直接 3D 交互

- 状态：已采纳。
- 决策：参考 Mineradio 的左侧歌单/队列面板与 3D 歌单架交互形态，但不复制源码、素材或品牌表达。ArcMind 会话历史默认隐藏为左侧边缘入口，用户移入或点击后以玻璃抽屉显示；抽屉打开时弦核视觉轻微偏转。弦核默认显示更大，并支持鼠标拖拽旋转和滚轮缩放。
- 原因：减少会话列表和 HUD 对粒子核心的遮挡，把主视觉留给弦核，同时保留桌面工具的可发现性和可操作性。

### 2026-06-30：项目命名为 ArcMind

- 状态：已采纳。
- 决策：项目英文名为 `ArcMind`，中文定位为“弧核智能终端”，目录名为 `arcmind`。
- 原因：名称能同时表达环形粒子视觉、能量核心和大模型智能内核，适合桌面 AI 终端定位。

### 2026-06-30：v1 采用桌面 AI 终端而非普通网页聊天

- 状态：已采纳。
- 决策：v1 默认按 Windows 桌面应用规划，优先 Electron + Three.js/WebGL + 云端大模型 API。
- 原因：桌面形态更适合沉浸式视觉、语音、常驻窗口、快捷键和本地记忆。

## 候选

### 后续评估：Tauri 替代 Electron

- 状态：候选。
- 评估点：安装体积、系统资源、WebGL 表现、语音和本地能力集成成本、开发速度。

### 后续评估：本地模型或混合模型模式

- 状态：候选。
- 评估点：隐私、离线能力、显存要求、响应速度、模型质量、安装复杂度。

## 已拒绝

暂无。
