# ArcMind V2

ArcMind V2 是一个以实时语音为主要入口、以云端任务中枢为核心、以个人工作机为可选执行扩展的个人 AI 助理项目。

当前分支处于文档先行阶段，只定义产品目标、业务规则、架构边界和开发协作门禁，暂不包含业务实现代码。

## 产品组成

- 手机 Web 端：实时对话、任务确认、进度查看和消息提醒。
- 云端后端：身份、会话、记忆、任务编排、定时提醒和跨端消息中继。
- 工作机端：可选安装，通过安全的出站连接接收任务，调用本地执行工具并回传结果。
- 实时语音层：供应商可替换，只承担低延迟听说和对话控制，不垄断任务规划与执行。

## 两套 Engine 的边界

- `Agent Context OS` 是开发协作 Engine（开发协作引擎），用于约束 Codex 等开发工具如何读取上下文、规划、修改和验收本仓库。
- `ArcMind Runtime` 是产品运行时，未来负责用户对话、主 Agent、任务编排和工作机执行。
- 前者不进入产品运行链路，后者也不能替代仓库开发规范。

## 文档入口

- 开发协作入口：[AGENTS.md](AGENTS.md)
- 项目文档索引：[docs/00-index.md](docs/00-index.md)
- 项目上下文配置：[.agent-context/config.json](.agent-context/config.json)
- 项目记忆源：[.agent-context/memory-sources/README.md](.agent-context/memory-sources/README.md)

## 分支策略

- `main`：旧版项目，暂时冻结，不作为 V2 的开发基础。
- `v2`：新版长期开发主线，以孤儿分支形式从零开始。
- 后续功能分支从 `v2` 创建，并合并回 `v2`。
