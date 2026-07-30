# 模块：Voice Runtime

## 模块职责

Voice Runtime 负责录音、ASR 语音识别、TTS 语音合成、播放控制、静音和语音状态事件。

不负责决定模型回复内容，也不直接写入聊天历史。

## 公共接口

- `startRecording` / `stopRecording` / `cancelRecording`。
- `transcribeAudio`。
- `speakText` / `stopSpeaking`。
- 状态事件：listening、transcribing、speaking、muted、error。
- 当前 v1 已提供点击录音和 `window.arcMind.voice.transcribe`；renderer 只把临时内存音频 buffer 交给 main process，main process 调用 OpenAI-compatible `/audio/transcriptions`。
- 当前 v1 语音播报先使用 renderer 侧 Web Speech API `speechSynthesis` 完成播放，preload 已保留 `window.arcMind.voice.speak` / `stopSpeaking` 的 typed API 作为后续 main process TTS provider 接入点。
- 当前已新增 GPT-Live 接入契约：`window.arcMind.settings` 可读取、保存和检测独立的 `codex-lb-live` 配置。
- `window.arcMind.voice.createRealtimeCall({ sdp })`：main process 读取已启用的 codex-LB 配置，把 renderer 生成的 SDP 与基础 `gpt-realtime` 会话配置封装为私有 Codex JSON `{ sdp, session }`，提交到带 `intent=quicksilver&architecture=avas` 的 `/backend-api/codex/realtime/calls`；成功时返回远端 SDP，失败时返回结构化、脱敏的 `AppError`，不得依赖跨 IPC 抛出的字符串错误。
- renderer 使用 `RTCPeerConnection` 管理麦克风轨道、远端音频播放、数据通道和连接释放；代理 API Key 始终留在 main process。

## 数据与状态

- 音频临时文件或 buffer 必须有生命周期和清理策略。
- TTS 播放必须支持停止和切换静音。
- 当前录音不落盘，`MediaRecorder` 停止后立即释放媒体轨道，ASR 请求使用内存中的 `ArrayBuffer`。录音与音量分析复用同一条 `MediaStream`，避免一次点击说话触发两路麦克风采集。
- 当前 TTS 不生成或保存音频文件；模型回复完成后可自动播报，静音或停止播报会调用 `speechSynthesis.cancel()` 并驱动 `speaking` 视觉状态退出。
- 实时通话只在用户显式点击开始后申请麦克风权限；结束、失败或组件卸载会关闭 peer connection、音频分析器并停止所有媒体轨道。麦克风静音通过禁用本地音轨实现，不结束会话。
- 实时语音只持久化 `provider`、`enabled`、服务根地址和代理 API Key；瞬时检测状态不持久化。
- 用户粘贴以 `/v1` 结尾的常见 API Base URL 时，实时语音配置会将其归一化为 codex-LB 服务根地址；配置读取兼容 UTF-8 BOM，避免外部配置工具写入文件标记后导致 JSON 解析失败。
- 实时语音失败信息只保留失败阶段、内部错误码、HTTP 状态、上游安全错误码、WebRTC/ICE 状态等诊断元数据；不得显示或记录代理密钥、SDP、通话标识、语音内容或上游私密正文。

## 2026-07-29 实时通话诊断基线

- 必须区分 ChatGPT 产品内的 Live Voice 与 OpenAI 公共 Realtime API：OpenAI 官方 [ChatGPT Voice](https://help.openai.com/en/articles/20001274-chatgpt-voice) 当前把付费计划使用的最新语音体验称为 `GPT-Live-1`，Plus 订阅可在 ChatGPT.com、官方移动端和受支持的桌面 Chat 中直接使用；这不要求用户购买 OpenAI API 额度，也不要求 macOS。
- OpenAI 官方 [Realtime and audio](https://developers.openai.com/api/docs/guides/realtime) 与 [WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc) 描述的是开发者公共 API 路线。该路线使用标准 OpenAI API Key，并由服务端向 `/v1/realtime/calls` 提交 SDP；它与 ChatGPT Plus 订阅权益、ChatGPT 产品内的 `GPT-Live-1` 命名和计费相互独立。
- ArcMind 当前走的是 codex-LB 私有已安装 Codex 应用兼容面：JSON `{ sdp, session }`、`type: quicksilver`、`model: gpt-realtime` 和 `/backend-api/codex/realtime/calls?intent=quicksilver&architecture=avas`。该私有模型别名和协议不等于、也不能证明使用公开 `gpt-realtime-2.1`。
- 当前本地脱敏日志已复现两次 `call_creation` 阶段失败：HTTP 403、上游安全错误码 `forbidden`。这表明麦克风授权、本地 SDP Offer 生成和 ArcMind 到 codex-LB 的 HTTP 路径已通过，失败位于 codex-LB 调用上游或 ChatGPT 账户能力门禁。
- `Soju06/codex-lb` 当前 `main` 在 2026-07-27 合并了完整 Live Voice sideband，要求通话创建与 `WS /backend-api/codex/{call_id}`、`WS /v1/live/{call_id}` 或 `WS /v1/realtime?call_id=...` 使用同一 ChatGPT 账户。当前最新稳定发布 `v1.22.0` 早于该合并：它已有私有通话创建路由，但没有这套账户绑定 sideband，因此“检测到 POST 路由”不足以证明完整兼容。
- VPS 已于 2026-07-29 通过只读 SSH 核验：活动容器使用 `codex-lb v1.22.0`、提交 `4c0dbc9ceb2b5d70204ea7603cf1b4bef83db234`，镜像构建于 2026-07-24。容器源码只有 `POST /backend-api/codex/realtime/calls`，未包含 `backend_codex_realtime_live_websocket`、`proxy_realtime_live_websocket` 或 `/v1/live/{call_id}` 等后续 Live Voice sideband 实现，因此当前部署不是完整 Live Voice 版本。
- VPS 脱敏日志确认请求已经完成代理密钥校验、账户选择和上游提交，上游明确返回 HTTP 403、`forbidden` 与 `Voice session access denied.`。数据库中已有 3 次该类失败，涉及 2 个不同的活动 Plus 账户；当前实例共有 8 个活动 Plus 账户和 2 个暂停账户，ArcMind 使用的代理密钥作用域在请求日志中显示为 5 个账户。不得记录或展示对应邮箱、账户 ID、令牌、SDP、通话 ID 或语音数据。
- `v1.22.0` 的 Codex control 单次请求只会对连接阶段的临时 `upstream_unavailable` 执行账户故障转移；上游 HTTP 403 `forbidden` 不满足故障转移条件。因此即使代理密钥绑定多个账户，某个账户的语音权限被拒也不会自动逐个尝试其余账户。
- 2026-07-29 进一步核对 `Wei-Shaw/sub2api v0.1.168` 后，发现 ChatGPT 私有 Live 请求已经需要 `x-oai-attestation` DeviceCheck 证明。`sub2api` 在 2026-07-25 的 `e6eb23ea` 增加完整 Live gateway，在 `988d4b57` 增加 macOS Live attestation，并在 `1c26dc7a` 修复会话结算与 observer 容错；其实现包含私有通话创建、账户绑定 sideband、最多 4 个账户的创建故障转移及 attestation 复用。
- `sub2api` 的 Live 能力只允许 OpenAI OAuth 订阅账户，不接受 OpenAI API Key 账户、Personal Access Token 或 Agent Identity；这与使用 ChatGPT Pro/Plus 订阅的目标一致。但它当前只能在 Apple Silicon macOS 上生成 attestation，且运行节点必须安装官方 ChatGPT.app；Linux 和 Windows 构建会明确返回不支持。因此不能把它直接替换部署到当前 Linux VPS 并期待 Live 可用。
- 上述“Apple Silicon macOS + 官方 ChatGPT.app”是 `sub2api` 生成私有接口 `x-oai-attestation` 的实现约束，不是 ChatGPT Plus 使用 Live Voice 的产品要求。`sub2api` 会从官方应用包内加载 `devicecheck.node` 与对应运行时来生成 Apple DeviceCheck 证明；Windows 和 Linux 没有这套可复用模块，因此该中转实现明确失败。用户在 Windows 上直接使用 ChatGPT.com 或官方 ChatGPT 桌面应用不受此限制。
- `Soju06/codex-lb` 当前 `main` 已有完整账户绑定 sideband，但只保留和转发下游提供的 `x-oai-attestation`，未实现 DeviceCheck attestation 生成。ArcMind 当前也不会生成该证明。结合现有上游 403，缺少 attestation 是比“Plus 账号无语音权益”更强的协议层根因候选；完成带 attestation 的真实通话验证前仍标记为待验证，不断言为唯一根因。
- OpenAI 官方 `openai/codex` 已加入 WebRTC、`thread/realtime/start`、`/v1/realtime/calls`、sideband 与 `attestation/generate` 协作，但 `codex app-server` 不独立生成设备证明；它把证明请求交给官方桌面宿主。公开 app-server 因而不是一个可直接替换 codex-LB、供 ArcMind 在 Windows/Linux 上调用的通用 Plus Live 中转。
- 产品路径边界：若目标只是立即使用 Plus 账户的最新 Live Voice，可直接使用 ChatGPT.com 或官方 Windows 桌面应用；若目标是把它嵌入 ArcMind，稳定的官方开发路线是公共 Realtime API，但需要独立 API Key 与 API 计费。坚持复用 ChatGPT Plus/Pro OAuth 订阅时，当前已核验的完整候选只有 Apple Silicon macOS 上的 `sub2api`，仍属于易受私有协议变化影响的方案；截至本次核验，没有正式源码证据支持可在 Windows 或 Linux VPS 上直接部署的成熟替代中转。

## 边界规则

- 未启用实时语音时不默认持续监听麦克风；实时语音启用后也必须由用户显式开始，只有会话存续期间持续监听。
- 不保存用户语音样本，除非后续明确设计并获得用户可见开关。
- 录音权限和失败原因必须能反馈给用户。
- renderer 可以负责浏览器内置播放生命周期，但不得读取 API Key、直接调用云端 TTS 或保存音频样本。
- GPT-Live 当前只允许 codex-LB 的私有 Codex Live Voice 兼容接口。renderer 修改地址或密钥后必须使旧检测结果失效；main process 保存启用状态时必须重新检测并失败关闭。
- 能力检测只读取 OpenAPI 和 `/v1/usage`，不得向 `/backend-api/codex/realtime/calls` 提交探测 SDP 或创建测试通话。
- 当前检测不等于 ChatGPT 账户权益检测；后续实现真实建联时仍需归一化账户无 Live Voice 权限的上游错误。
- codex-LB 的私有控制侧事件不作为唯一状态来源；renderer 同时使用 WebRTC 连接状态、远端真实音量和已识别的实时事件驱动视觉。未识别事件必须安全忽略。
- 当前仅完成 WebRTC 媒体/数据通道和私有通话创建；codex-LB 文档要求的账户绑定 WebSocket sideband 仍未实现，因此不能把当前实现声明为完整的私有 Codex Live Voice 客户端。

## 验证要求

- 录音状态转换测试或手动验证。
- TTS 停止和静音验证。
- ASR 失败、无麦克风、权限拒绝路径验证。
- 当前已有 ASR 输入校验测试；浏览器麦克风权限路径需要 Electron 手动验证。
- 当前已有 TTS 自动播报开关、能力检测和 utterance 生命周期单元测试；真实系统语音播放效果需要 Electron 手动验证。
- GPT-Live 前置能力需要覆盖配置缺失、服务不兼容、密钥无效、网络失败、检测成功和主进程启用门禁测试。
- 实时通话创建需要覆盖禁用门禁、SDP 校验、私有 JSON 请求体与查询参数、鉴权失败、上游会话参数拒绝、无效远端 SDP 和成功返回；真实麦克风权限、远端音频和账户权益仍需 Electron 手动验证。
- 实时通话错误展示需要覆盖麦克风权限拒绝、代理鉴权、上游实时语音不可用、HTTP 网关错误、无效 SDP、WebRTC/ICE 失败和数据通道错误，并验证诊断信息保持脱敏。
