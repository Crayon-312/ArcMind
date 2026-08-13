---
id: "arcmind-doc-modules-mobile-web"
type: "architecture_rule"
status: "current"
summary: "模块边界《模块卡片：手机 Web》的当前事实、边界与关联依据。"
scope: ["modules"]
tags: ["arcmind-v2", "modules"]
confidence: "high"
last_verified: "2026-08-06"
---

# 模块卡片：手机 Web

状态：current
最后校验日期：2026-08-06

## 关系导航

- 所属领域：[模块内容地图](00-modules-map.md)
- 架构边界：[手机 Web 端](../architecture/02-mobile-web.md)
- 参与流程：[实时对话与任务形成](../business/01-conversation-flow.md)、[身份与工作机绑定](../business/04-identity-and-device-flow.md)
- 公开契约：[云端公开 API 契约草案](../contracts/02-cloud-public-api.md)
- 第一阶段页面：[第一阶段手机页面与状态地图](../product/06-phase-1-mobile-page-map.md)
- 测试门禁：[第一阶段身份与文字闭环测试矩阵](../quality/03-phase-1-test-matrix.md)

## 职责

提供身份入口、文字与实时语音交互、任务确认、进度、审批、消息和设置界面。

## 不负责

不持有长期唯一事实，不直接控制工作机，不实现主 Agent 或任务状态机。

## 允许依赖

- 云端公开 API。
- 云端实时事件和媒体会话适配接口。
- 浏览器标准媒体、存储、Service Worker 和通知能力。

## 禁止依赖

- 云端数据库和内部队列。
- 工作机私有连接协议。
- 任一模型供应商的私有事件直接进入业务组件。

## 数据流

```text
用户输入/音频 -> 页面控制器 -> 云端公开契约 -> 展示状态/音频/任务事实
```

## 验证方式

- 目标手机浏览器的权限、前后台、弱网和打断验收。
- API 契约测试、状态恢复测试和可访问性检查。

## 常见风险

- 浏览器安全上下文不足导致麦克风或推送不可用。
- 迟到音频在用户打断后继续播放。
- 本地乐观状态覆盖云端真实任务状态。
