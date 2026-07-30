# 架构决策记录

本文记录已讨论、候选、已采纳或已拒绝的重要取舍。外部方案和 AI 生成建议必须先进入这里，不能直接成为项目事实。

## 已采纳

### 2026-07-29：区分 ChatGPT Plus Live 产品能力与 ArcMind 私有接口接入能力

- 状态：已采纳。
- 产品事实：OpenAI 官方 [ChatGPT Voice](https://help.openai.com/en/articles/20001274-chatgpt-voice) 当前说明付费计划使用 `GPT-Live-1`；Plus 用户可直接在 ChatGPT.com、官方移动端和受支持的桌面 Chat 中使用最新 Live Voice，不需要购买 OpenAI API 额度，也不要求 macOS。
- 接入边界：上述产品权益不等于存在一个受支持、可供第三方桌面应用调用的 Plus 私有 Live API。ArcMind 当前通过 codex-LB 模拟 ChatGPT/Codex 私有协议；现有 HTTP 403 更指向该私有协议适配、sideband 与 attestation 链路，而不是已经证明 Plus 账户缺少语音权益。
- 苹果限制原因：`Wei-Shaw/sub2api` 当前借用 Apple Silicon 版官方 ChatGPT.app 内的 `devicecheck.node` 和运行时生成 `x-oai-attestation` DeviceCheck 证明，因此它要求 Apple Silicon macOS 与已安装的官方应用。该要求属于第三方中转实现，不属于 Plus Live Voice 本身；Windows 用户直接使用 ChatGPT.com 或官方 Windows 应用不受影响。
- 当前选择：只要求立即使用最新 Live Voice 时，使用 ChatGPT.com 或官方 Windows 应用；要求嵌入 ArcMind 且接受 API 计费时，采用 OpenAI 公共 Realtime API；要求嵌入 ArcMind、只使用 Plus/Pro OAuth 订阅且不使用 API 计费时，当前 Windows/Linux 环境没有已找到并经正式源码证明可用的成熟中转，不推荐购买或部署未提供 attestation、账户绑定 sideband 与真实远端音频证据的服务。
- 官方 Codex 边界：`openai/codex` 的 app-server 已有实时协议和 `attestation/generate` 协作，但证明由官方桌面宿主处理，app-server 自身不是可直接暴露给 ArcMind 的通用 Plus Live 中转。

### 2026-07-29：依赖漏洞暂缓修复，实时语音建联优先

- 状态：已采纳。
- 决策：保留当前依赖版本，不运行 `npm audit fix` 或强制跨大版本升级；首页实时语音建联作为当前最高优先级任务。
- 已知风险：当前锁定依赖包含 2 个 critical、15 个 high、4 个 moderate 受影响包；完整清单、暴露面和后续修复入口见 `dependency-security.md`。
- 复查条件：实时语音主链路调通后，或进入发布/安装包交付前，重新执行依赖审计并按生产运行时、构建链、开发工具链顺序处理。

### 2026-07-29：实时语音启用时采用通话优先交互和七状态视觉

- 状态：已采纳。
- 决策：已保存且检测通过的 `codex-lb-live` 配置启用后，首屏不显示文字输入，用户显式点击后才申请麦克风并创建 WebRTC 会话；未启用实时语音时才使用文字聊天。临时连接失败停留在通话界面，提供重试和设置，不自动降级文字。
- 状态：正式视觉状态为 `ready`、`connecting`、`listening`、`thinking`、`speaking`、`muted`、`connection_error`，分别对应慢呼吸、向内收束、音量波纹、聚合内收、持续外扩、琥珀弱提示、红色短闪后保持可重试。
- 进程边界：renderer 创建 peer connection、采集麦克风和播放远端音频；main process 使用本机 codex-LB 密钥提交 SDP 并返回远端 SDP。密钥不进入 renderer，音频不经 main process，也不落盘。
- 证据：OpenAI 官方 WebRTC 指南确认浏览器负责 peer connection、麦克风、远端音频和数据通道，服务端负责携带密钥提交 SDP；官方 Codex 当前 `realtime_call.rs` 确认 `/backend-api` 私有路由使用带 `intent=quicksilver&architecture=avas` 的 JSON `{ sdp, session }` 请求，而公共 `/v1/realtime/calls` 使用 multipart 表单。codex-LB `docs/live-voice.md` 确认它代理前者但不代理 WebRTC 媒体。
- 边界：codex-LB 私有控制侧事件不是公共稳定契约，因此视觉状态同时使用连接状态、远端真实音量和已知实时事件，未知事件安全忽略；真实账户权益、麦克风权限和远端音频必须在 Electron 中手动验证。

### 2026-07-29：GPT-Live 实时语音采用 codex-LB 专用配置和失败关闭门禁

- 状态：已采纳。
- 决策：文字模型继续使用独立的 OpenAI-compatible 配置；GPT-Live 实时语音使用独立的 `codex-lb-live` 配置。设置界面必须声明该能力只兼容 codex-LB 的私有 Codex Live Voice 路由，不能把普通文字接口兼容性视为实时语音兼容性。
- 检测：main process 读取 codex-LB 的 OpenAPI 文档，确认服务身份和 `POST /backend-api/codex/realtime/calls` 路由，再通过只读的 `GET /v1/usage` 验证代理 API Key 已注册。检测不提交 SDP、不创建通话。
- 门禁：只有检测状态为 `available` 才允许用户在界面选择启用；保存 `enabled: true` 时 main process 必须再次检测，失败则拒绝持久化。地址或密钥草稿变化后，renderer 立即使旧检测结果失效并关闭草稿中的启用状态。
- 已验证事实：以上路由和密钥要求来自 2026-07-29 检查的 `Soju06/codex-lb` 当前源码与 `docs/live-voice.md`。codex-LB 明确说明这是已安装 Codex 应用使用的私有兼容面，不是 OpenAI 公共 Realtime API，也不代理 WebRTC 媒体。
- 官方边界：OpenAI 的 [Realtime and audio](https://developers.openai.com/api/docs/guides/realtime) 文档说明，公共 GA WebRTC 流程使用 `POST /v1/realtime/client_secrets` 和 `/v1/realtime/calls`；这与本项目当前探测的 codex-LB 私有 `/backend-api/codex/realtime/calls` 路径不同。
- 运行核验：2026-07-29 通过只读 SSH 确认 VPS 当前运行 `codex-lb v1.22.0`（提交 `4c0dbc9ceb2b5d70204ea7603cf1b4bef83db234`）。该版本只有通话创建 POST 路由，没有 2026-07-27 后合并的账户绑定 Live Voice sideband；上游对 3 次既有语音创建请求均返回 HTTP 403 `forbidden`，涉及 2 个不同的活动 Plus 账户。诊断仅保存账户数量和状态类别，不保存服务器连接信息、账户标识或令牌。
- 边界：该检测只能确认 codex-LB 服务、Live Voice 路由和代理密钥；ChatGPT Plus 账户不能等价替代 OpenAI API Key，也不能证明使用公开 `gpt-realtime-2.1`。后续决策已经在 renderer/main 分层实现 WebRTC 通话创建与实时通话状态机；私有 WebSocket 控制侧通道仍不是本项目依赖的稳定公共契约。
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

### 2026-07-01：右上工具采用极小热区和图标 rail

- 状态：已采纳。
- 决策：参考 Mineradio 的贴边隐藏、悬浮唤出和透明玻璃气质，但不复制源码、SVG 滤镜、贴图或资产。ArcMind 右上角只保留极小识别区，鼠标进入后图标按钮从右向左滑出；点击回应、记忆、设置等按钮后，再从右侧弹出对应面板。底部输入改为小型点击把手，不再用大面积 hover 区。
- 原因：减少边缘误触和 hover 状态抖动，避免工具 rail 或输入唤出牵动 WebGL 弦核闪烁，同时保留沉浸式桌面终端的可发现性。

### 2026-07-02：输入框弹出采用上沿起波，弦核采用多轴包裹壳

- 状态：已采纳。
- 决策：输入框弹出反馈采用先实验台确认、再移植产品的方式。正式效果以 `A 上沿起波` 为准，并采用产品化 `A+` 强度：输入框从底部向上闯入，上沿作为唯一波源向弦核空间推出短促 3D 波前；正式界面保留实验页的上沿爆亮、火花和透视波面作为外部视觉证据，同时增强核心上推、相机推进和 halo 回弹。弦核粒子基础形态从扁平圆饼盘改为多轴包裹壳，实体轨道降级为低透明非闭合轻弧线。
- 原因：用户明确要求视觉因果必须表现为“因为输入框弹出才出现空间涟漪”；偏心冲击圆环和单一圆饼粒子盘会被误读为弦核结构错误或在特定视角变成一条线，影响美感。

### 2026-06-30：项目命名为 ArcMind

- 状态：已采纳。
- 决策：项目英文名为 `ArcMind`，中文定位为“弧核智能终端”，目录名为 `arcmind`。
- 原因：名称能同时表达环形粒子视觉、能量核心和大模型智能内核，适合桌面 AI 终端定位。

### 2026-06-30：v1 采用桌面 AI 终端而非普通网页聊天

- 状态：已采纳。
- 决策：v1 默认按 Windows 桌面应用规划，优先 Electron + Three.js/WebGL + 云端大模型 API。
- 原因：桌面形态更适合沉浸式视觉、语音、常驻窗口、快捷键和本地记忆。

## 候选

### 2026-07-29：以 Apple Silicon macOS 上的 sub2api 作为私有 Live Voice 候选中转

- 状态：待验证。
- 候选：`Wei-Shaw/sub2api v0.1.168`。仓库源码已验证存在 `POST /backend-api/codex/realtime/calls`、`WS /backend-api/codex/{call_id}`、`POST /v1/live`、`WS /v1/live/{call_id}`、账户绑定、创建阶段最多 4 个账户故障转移和 `x-oai-attestation` 生成。
- 账号边界：Live 调度只接受 OpenAI OAuth 订阅账户，不接受 OpenAI API Key、Personal Access Token 或 Agent Identity。
- 部署硬限制：attestation 当前只支持 Apple Silicon macOS，运行节点必须安装官方 ChatGPT.app；Linux 和 Windows 明确不支持。当前 Linux VPS 不能原地替换为该方案。
- 采用门槛：候选服务端的管理员 `GET /admin/groups/live-capability` 必须返回 `supported: true`，目标分组必须启用 `allow_live`，并完成一次真实 SDP 创建、sideband 建联和远端音频验证。商业中转站仅宣称“基于 sub2api”不构成能力证据。
- 风险：该方案仍依赖 ChatGPT 私有协议和 DeviceCheck 实现，官方变化可能再次导致失效，也不能证明私有 `gpt-realtime` 别名对应公开模型的确切版本。

### 后续评估：Tauri 替代 Electron

- 状态：候选。
- 评估点：安装体积、系统资源、WebGL 表现、语音和本地能力集成成本、开发速度。

### 后续评估：本地模型或混合模型模式

- 状态：候选。
- 评估点：隐私、离线能力、显存要求、响应速度、模型质量、安装复杂度。

## 已拒绝

暂无。
