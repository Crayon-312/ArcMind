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
- GPT-Live 的 codex-LB 配置使用独立的 main process 配置文件；preload 同样只返回 `hasApiKey`。实时语音检测草稿只在 main process 临时使用，不写入日志。
- 模型连接测试可以通过 preload 向 main process 传递当前表单草稿；main process 只临时用于测试，不写入日志或配置文件，除非用户显式保存。
- 当前运行日志由 main process 写入本机应用数据目录下的日志文件，日志字段会对 API Key、Authorization、token、对话内容、语音样本和本地路径做脱敏。

## 边界规则

- 文档、测试、日志和错误报告不得包含真实 API Key、token、私密对话、语音样本或本地隐私路径。
- 任何系统级操作能力必须先有权限模型和用户确认。
- 默认不启用持续麦克风监听。
- 实时语音启用是失败关闭操作：renderer 的检测结果只控制界面交互，main process 在持久化 `enabled: true` 前必须独立复检，不能信任 renderer 状态。

## 验证要求

- 敏感字段脱敏测试。
- API Key 不出现在 renderer、日志和错误对象的检查。
- 隐私删除流程测试。
- 日志脱敏测试，确保敏感字段不会以明文进入日志行。
- 实时语音公开配置和能力检测结果不得包含代理 API Key、账户标识、SDP 或通话标识。
