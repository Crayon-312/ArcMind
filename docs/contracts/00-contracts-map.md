---
id: "arcmind-doc-contracts-00-contracts-map"
type: "architecture_rule"
status: "current"
summary: "公开契约《契约内容地图》的当前事实、边界与关联依据。"
scope: ["contracts"]
tags: ["arcmind-v2", "contracts"]
confidence: "high"
last_verified: "2026-08-06"
---

# 契约内容地图

状态：current
最后校验日期：2026-08-06

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
- [第一阶段机器契约](04-phase-1-machine-contracts.md)：身份与文字闭环的 OpenAPI（开放接口描述规范）和事件 Schema（数据结构规范）事实源。

## 关系规则

- 契约只暴露公开语义，不泄漏模块内部模型。
- 业务状态变化、重试和幂等规则变更时，必须同步检查相关契约和质量标准。
