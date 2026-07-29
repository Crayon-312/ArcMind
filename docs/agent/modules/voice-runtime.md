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
