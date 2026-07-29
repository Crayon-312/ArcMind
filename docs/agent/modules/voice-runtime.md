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

## 数据与状态

- 音频临时文件或 buffer 必须有生命周期和清理策略。
- TTS 播放必须支持停止和切换静音。
- 当前录音不落盘，`MediaRecorder` 停止后立即释放媒体轨道，ASR 请求使用内存中的 `ArrayBuffer`。录音与音量分析复用同一条 `MediaStream`，避免一次点击说话触发两路麦克风采集。
- 当前 TTS 不生成或保存音频文件；模型回复完成后可自动播报，静音或停止播报会调用 `speechSynthesis.cancel()` 并驱动 `speaking` 视觉状态退出。

## 边界规则

- v1 优先点击说话，不默认持续监听麦克风。
- 不保存用户语音样本，除非后续明确设计并获得用户可见开关。
- 录音权限和失败原因必须能反馈给用户。
- renderer 可以负责浏览器内置播放生命周期，但不得读取 API Key、直接调用云端 TTS 或保存音频样本。

## 验证要求

- 录音状态转换测试或手动验证。
- TTS 停止和静音验证。
- ASR 失败、无麦克风、权限拒绝路径验证。
- 当前已有 ASR 输入校验测试；浏览器麦克风权限路径需要 Electron 手动验证。
- 当前已有 TTS 自动播报开关、能力检测和 utterance 生命周期单元测试；真实系统语音播放效果需要 Electron 手动验证。
