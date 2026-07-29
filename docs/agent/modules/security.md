# 模块：安全与隐私

## 模块职责

安全与隐私模块负责 API Key 存储边界、敏感数据处理、权限提示、日志脱敏、隐私开关和危险能力确认。

## 公共接口

- API Key 保存、读取、验证和删除。
- 隐私设置读取和更新。
- 敏感日志脱敏工具。
- 权限确认流程。

## 数据与状态

- API Key 应使用系统安全存储或受保护配置，不进入 renderer 状态树。
- 对话、记忆和语音数据必须有明确保存位置和删除路径。
- 当前模型配置由 main process 写入 Electron `userData` 下的本机配置文件；preload 只向 renderer 返回 `hasApiKey`，不返回密钥值。
- 模型连接测试可以通过 preload 向 main process 传递当前表单草稿；main process 只临时用于测试，不写入日志或配置文件，除非用户显式保存。
- 当前运行日志由 main process 写入本机应用数据目录下的日志文件，日志字段会对 API Key、Authorization、token、对话内容、语音样本和本地路径做脱敏。
- 当前 BrowserWindow 启用 renderer sandbox、`contextIsolation`，并禁用 `nodeIntegration`；renderer 只能通过 preload 暴露的 typed API 访问桌面能力。
- 当前系统状态遥测只返回聚合级 CPU、内存、磁盘容量和 GPU feature status，不返回本地绝对路径、用户名、主机名、进程列表或窗口标题，也不写入日志。

## 边界规则

- 文档、测试、日志和错误报告不得包含真实 API Key、token、私密对话、语音样本或本地隐私路径。
- 任何系统级操作能力必须先有权限模型和用户确认。
- 默认不启用持续麦克风监听。
- 系统状态展示属于只读态势能力，不得扩展为文件访问、进程管理或硬件控制，除非先补齐权限和确认设计。

## 验证要求

- 敏感字段脱敏测试。
- API Key 不出现在 renderer、日志和错误对象的检查。
- 隐私删除流程测试。
- 日志脱敏测试，确保敏感字段不会以明文进入日志行。
