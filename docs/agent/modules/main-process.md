# 模块：Electron Main Process

## 模块职责

Main process 负责桌面窗口、IPC handlers、应用生命周期、模型请求代理、配置读取、本地存储写入、密钥访问和服务编排。

不负责直接渲染 UI、不承载视觉动画逻辑。

## 公共接口

- 通过 preload 暴露 typed `window.arcMind`。
- 对 renderer 提供聊天、设置、语音、历史、记忆和状态订阅接口。
- 对 AI Runtime、Voice Runtime 和存储层进行服务编排。
- 当前已提供模型配置 IPC、聊天发送/取消 IPC，并由 main process 负责读取 API Key 与发起模型请求。
- “测试连接”IPC 可接收 renderer 当前设置草稿，由 main process 临时合并后测试，不要求用户先保存配置，也不把测试草稿落盘。
- 当前提供独立的实时语音配置读取、保存和检测 IPC。检测通过 codex-LB OpenAPI 路由声明和只读 `/v1/usage` 完成，不创建通话。

## 数据与状态

- 管理应用级状态、运行日志、模型请求生命周期、取消信号和错误归一化。
- 持久化写入必须通过明确 repository 或配置服务。
- 当前 main process 已提供脱敏运行日志，记录应用启动、窗口就绪、renderer 进程退出、窗口无响应、未捕获异常和退出事件。
- 当前 renderer 进程异常时 main process 最多自动 reload 一次，避免持续崩溃时无限重启。

## 边界规则

- 不把 API Key、模型请求细节或文件系统能力直接暴露给 renderer。
- IPC handler 必须验证输入，并返回结构化错误。
- 长耗时模型请求必须支持取消、超时和用户可见错误。
- 保存实时语音 `enabled: true` 前必须在 main process 重新检测；renderer 传入的检测状态不能作为授权依据。
- 日志不得记录 API Key、Authorization、token、对话内容、语音样本或本地隐私路径。

## 验证要求

- IPC contract 测试。
- 模型代理和错误归一化单元测试。
- 修改 main/preload 后需要重启应用验证。
- 实时语音配置和检测 IPC 需要覆盖配置缺失、不兼容服务、鉴权失败、网络失败、成功和启用门禁。
- 产品化 smoke 使用 `npm run smoke` 启动生产 renderer，检查启动、输入、模型设置入口和 canvas 非空白。
