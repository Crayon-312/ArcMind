# 决策 0015：首个主 Agent 模型使用 DeepSeek V4 Pro

状态：accepted
日期：2026-08-06

## 关系导航

- 所属领域：[决策内容地图](00-decisions-map.md)
- 运行时边界：[产品 Agent Runtime 协作模型](../architecture/05-agent-runtime.md)
- 技术入口：[技术选型与决策门禁](../architecture/08-technology-selection.md)
- 事件通道：[文字闭环使用 SSE 事件通道](0014-sse-text-event-channel.md)
- 落实台账：[第一阶段开发入口门禁](../plans/0009-phase-1-entry-gate.md)

## 背景

LangGraph（有状态 Agent 编排框架）已经确定，但文字纵向切片仍需要一个真实主 Agent（智能任务编排助手）模型。首版目标是中文对话、流式输出、工具调用和结构化任务草稿，不需要同时维护多家自动路由。

## 决策

- 首个供应商使用 DeepSeek（深度求索模型服务），首个模型使用 `deepseek-v4-pro`。
- 云端通过 ArcMind 自有 `ModelProvider` 端口接入 OpenAI 兼容的 Chat Completions（聊天补全）接口；领域服务、LangGraph 节点和公开事件不得依赖 DeepSeek 私有类型。
- 首版使用流式响应、工具调用和 JSON Output（JSON 结构化输出），但所有工具参数仍必须经过本地 JSON Schema（JSON 数据结构规范）校验，不能因供应商 `strict`（严格模式）仍为 Beta（测试阶段）而省略校验。
- 默认使用思考模式和 `high` 推理强度；具体温度、输出上限和超时在模型适配器配置中锁定并通过固定评测集调整。
- 供应商失败时保存用户轮次、失败类别、关联标识和可重试性，允许用户手动重试；首版不自动切换第二家模型，避免重复计费、重复工具调用和语义漂移。
- API 密钥只进入服务器部署环境，不写入数据库正文、仓库、日志或手机端。记录供应商请求 ID、耗时、用量和错误类别，但不默认记录完整私密提示词。

## 选择证据

- DeepSeek 官方 API 支持 `deepseek-v4-pro`、SSE（服务器发送事件）流式增量、工具调用、JSON Output 和 OpenAI 兼容格式。
- 官方定价页在 2026-08-06 显示 V4 Pro 上下文长度 1M、最大输出 384K；每百万输入 Token（模型文本计量单位）缓存命中 0.025 元、未命中 3 元、输出 6 元，高峰时段为平时价格 2 倍。价格属于外部运营事实，部署前必须再次核对，不写死到业务代码。
- 从目标 VPS（虚拟专用服务器）只读探测：DeepSeek 和阿里云百炼端点均返回正常的未授权响应，证明网络路径可达；OpenAI API（OpenAI 应用程序接口）明确返回 `unsupported_country_region_territory`，当前服务器地区不受支持，不能作为首个稳定生产供应商。

## 候选比较

| 候选 | 结论 |
|---|---|
| DeepSeek V4 Pro | 采用；目标网络可达，中文、流式、工具和结构化输出满足首个闭环，成本可控 |
| DeepSeek V4 Flash | 保留为未来低成本候选；首版不增加自动模型路由 |
| 阿里云百炼 Qwen | 接口可达且提供 OpenAI 兼容接口；作为后续替代候选，但当前没有足够收益同时维护第二适配器 |
| OpenAI GPT-5.6 | 官方能力强，但目标 VPS 实测返回地区不支持；当前不能进入生产默认路径 |

## 失败与迁移

- 将 401/403、429、超时、连接失败、内容过滤、工具参数非法和供应商资源不足映射为 ArcMind 稳定错误，不向手机暴露供应商原始结构。
- 超时、限流和暂时资源不足可由用户发起新重试；认证、余额或地区错误标记为运维阻塞，不自动循环重试。
- 工具调用先落为待验证提议，只有领域服务校验权限、参数和任务状态后才能产生副作用。
- 更换供应商时实现新的 `ModelProvider` 适配器并运行同一评测与契约测试；历史会话只保存 ArcMind 轮次和必要供应商元数据。

## 尚未完成的实测

云端镜像已经包含可注入的 DeepSeek 非流式客户端、HTTPS 端点约束，以及认证、限流、超时、不可用和非法响应的稳定错误分类；无网络单元测试已经通过。该客户端尚未接入当前模型生成请求路径，生产仍使用确定性测试模型。

当前没有生产 DeepSeek API 密钥，因此尚未完成真实中文质量、流式取消、工具调用和 JSON 结构化输出测试。当前同步请求事务也不满足耐久流式生成要求，不能用非流式客户端绕过；在文字纵向切片验收前，必须先接入耐久生成执行器，再使用用户提供的部署密钥完成固定用例和故障注入。

## 官方证据

- [DeepSeek：模型与价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)
- [DeepSeek：Chat Completions API](https://api-docs.deepseek.com/zh-cn/api/create-chat-completion/)
- [DeepSeek：JSON Output](https://api-docs.deepseek.com/zh-cn/guides/json_mode/)
- [DeepSeek：Tool Calls](https://api-docs.deepseek.com/zh-cn/guides/function_calling)
- [阿里云百炼：文本生成模型 API 参考](https://help.aliyun.com/zh/model-studio/qwen-api-reference)
- [OpenAI：Model guidance](https://developers.openai.com/api/docs/guides/latest-model)
