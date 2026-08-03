# 契约内容地图

状态：current
最后校验日期：2026-08-03

契约文档承载手机端、云端和工作机之间稳定、可测试的公开边界。

## 上下游

- 上级依据：[架构内容地图](../architecture/00-architecture-map.md)、[业务内容地图](../business/00-business-map.md)
- 上级入口：[项目文档总索引](../00-index.md)
- 责任主体：[模块内容地图](../modules/00-modules-map.md)
- 验收入口：[质量内容地图](../quality/00-quality-map.md)

## 契约主链

- [跨端事件契约基线](01-cross-end-events.md)：统一跨端事件信封和核心事件语义。
- [云端公开 API 契约草案](02-cloud-public-api.md)：手机端访问云端资源的接口边界。
- [云端与工作机通道契约草案](03-workstation-channel.md)：工作机连接、租约、执行和结果上报协议。

## 关系规则

- 契约只暴露公开语义，不泄漏模块内部模型。
- 业务状态变化、重试和幂等规则变更时，必须同步检查相关契约和质量标准。
