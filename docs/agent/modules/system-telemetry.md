# 模块：系统状态遥测

## 模块职责

系统状态遥测模块负责读取本机聚合级 CPU、内存、磁盘和 GPU 可用状态，并通过 main process 的只读 IPC 提供给 renderer 用于智能终端态势展示。

不负责系统控制、进程管理、文件访问、硬件调优或长期保存遥测历史。

## 公共接口

- main process 提供 `system:get-telemetry-snapshot` IPC。
- preload 暴露 `window.arcMind.system.getTelemetrySnapshot()`。
- 共享类型使用 `SystemTelemetrySnapshot`，包含 `cpu`、`memory`、`disk`、`gpu` 和 `capturedAt`。

## 数据与状态

- CPU 使用率通过短间隔采样 `os.cpus()` 聚合计算。
- 内存使用率通过 `os.totalmem()` 和 `os.freemem()` 聚合计算。
- 磁盘使用率通过 `fs.statfs()` 读取应用选择的本机磁盘容量，不把实际本地路径返回给 renderer。
- GPU 当前只暴露 Electron GPU feature status 和设备名称，不暴露驱动路径或供应商私有诊断信息；GPU 实时占用率暂无跨平台实现，使用 `usagePct: null` 表示待接入。
- 当前不持久化遥测快照，不写入运行日志。
- 当前系统状态空间实验台采用单个小型透明 3D 投影面板承载 CPU、内存、磁盘和 GPU 摘要，避免多面板干扰弦核主视觉。

## 边界规则

- Renderer 不得直接访问 Node、文件系统、系统命令或硬件 API。
- 不暴露本地绝对路径、用户名、主机名、进程列表、窗口标题或其他可识别隐私信息。
- 不使用系统状态遥测推断模型进度或伪造 AI 计算状态；视觉层只能把遥测作为本地终端状态输入。
- 任何后续系统控制能力必须另行设计权限模型和用户确认流程。

## 验证要求

- 修改采样计算时运行 `tests/main/systemTelemetry.test.ts`。
- 修改 shared contract、preload 或 IPC 时运行类型检查。
- 涉及界面展示时进行桌面和窄窗口视觉检查，确认玻璃窗不遮挡输入和核心视觉。
