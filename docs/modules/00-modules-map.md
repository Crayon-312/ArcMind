# 模块内容地图

状态：current
最后校验日期：2026-08-03

模块卡片把架构职责落实为可开发、可测试的边界，并明确允许依赖和禁止依赖。

## 上下游

- 上级依据：[领域内容地图](../domain/00-domain-map.md)、[架构内容地图](../architecture/00-architecture-map.md)
- 上级入口：[项目文档总索引](../00-index.md)
- 行为协作：[业务内容地图](../business/00-business-map.md)
- 对外边界：[契约内容地图](../contracts/00-contracts-map.md)

## 入口与身份

- [手机 Web 模块](mobile-web.md)
- [身份与访问模块](identity-access.md)
- [会话与实时交互模块](conversation-runtime.md)

## 智能与任务

- [主 Agent Runtime 模块](agent-orchestration.md)
- [任务编排模块](task-orchestration.md)
- [记忆服务模块](memory-service.md)

## 提醒与执行

- [提醒与通知模块](reminder-notification.md)
- [工作机网关模块](workstation-gateway.md)

## 关系规则

- 模块卡片描述职责边界，业务流程描述多模块如何协作，两者不能互相替代。
- 跨端调用必须经过公开契约，禁止直接依赖其他应用的内部实现。
