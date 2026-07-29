# 模块：AI Runtime

## 模块职责

AI Runtime 负责大模型供应商适配、请求构造、流式响应、上下文组装、系统提示词、错误归一化和取消控制。

不负责渲染 UI、不直接读取用户输入组件状态、不直接写入数据库。

## 公共接口

- `sendMessage`：接收会话上下文和用户消息，返回流式事件。
- `cancelMessage`：取消当前生成。
- `listProviders` / `validateProviderConfig`：模型配置检查。
- 事件类型应区分 token、完成、取消、错误和元数据。
- 当前 main process 已提供 OpenAI-compatible `/chat/completions` 流式适配，renderer 通过 preload 订阅 `AiStreamEvent`，不接触供应商 HTTP shape。
- 文字模型配置与 GPT-Live 实时语音配置相互独立；文字模型仍允许任意 OpenAI-compatible 供应商，不因实时语音选择 codex-LB 而被绑定。

## 数据与状态

- 处理短期上下文、长期记忆注入和模型参数。
- API Key 只能通过安全配置服务读取，不进入 renderer。
- 当前 v1 已在 AI Runtime 上下文组装中加入 ArcMind 人格 prompt，并只注入已启用的用户手动长期记忆。

## 边界规则

- 供应商 SDK 或 HTTP shape 不得泄露到 UI。
- codex-LB 私有 Live Voice 协议属于 Voice Runtime，不得混入通用文字模型适配器。
- 所有网络错误、鉴权错误、限流和超时必须归一化。
- Prompt 变化必须记录用途和影响范围。
- 长期记忆必须通过 `buildChatContext` 组装，禁用或删除的记忆不得进入模型上下文。

## 验证要求

- 上下文组装单元测试。
- 流式事件解析测试。
- 取消、超时、鉴权失败和网络失败测试。
- 人格 prompt、记忆启用/禁用过滤和上下文窗口测试。
