# 业务内容地图

状态：current
最后校验日期：2026-08-03

业务文档描述用户行为如何跨模块形成状态变化、执行结果和通知。

## 上下游

- 上级依据：[产品内容地图](../product/00-product-map.md)、[领域内容地图](../domain/00-domain-map.md)
- 上级入口：[项目文档总索引](../00-index.md)
- 协作实现：[模块内容地图](../modules/00-modules-map.md)
- 消息边界：[契约内容地图](../contracts/00-contracts-map.md)

## 核心流程

1. [实时对话与任务形成](01-conversation-flow.md)：从用户表达、澄清到任务确认。
2. [任务生命周期](02-task-lifecycle.md)：从任务创建、执行到完成或失败。
3. [提醒与通知](03-reminder-and-notification.md)：计划触发、投递和完成通知。
4. [身份与工作机绑定](04-identity-and-device-flow.md)：登录、设备注册和执行授权。

## 关系规则

- 流程中的状态名称来自领域模型。
- 跨端步骤必须关联契约；模块内部步骤必须关联对应模块职责。
