---
id: "arcmind-release-20260813-knowledge-retrieval-hardening"
type: "implementation_note"
status: "current"
summary: "ArcMind 知识检索已支持标准 Markdown 关系、当前事实优先、结果状态显示和跨状态门禁，四类高频问题可直接定位当前答案。"
scope: ["release", "knowledge-base", "retrieval"]
tags: ["agent-context-os", "markdown-links", "retrieval", "quality-gate"]
confidence: "high"
last_verified: "2026-08-13"
---

# 知识事实与检索质量加固发布记录

## 已发布结果

- Agent Context OS（智能协作上下文操作系统）保持上游 0.2.0 固定提交 `fd84369ae9fd1d88df222d18a8519fba87592f4e`，通过包管理器补丁增加标准 Markdown（轻量标记文档）内部链接提取、当前事实优先、结果状态显示和直接邻接低权重扩展。
- 项目版本标识更新为 `0.2.0-fd84369+arcmind-retrieval.1`；补丁和锁文件进入 Git（版本控制工具），本地索引仍保持忽略且可重建。
- 当时新增[当前事实与变更入口](../00-入口/当前事实与变更入口.md)和邮箱验证码排查；后者在账号密码决策生效后已移入归档。该次发布曾用于区分开发协作与产品 Agent、测试邮件与真实 SMTP、模型选型与生产启用。
- 当前知识指向草稿时必须显式标注状态；三个误标为业务规则的开放问题已经恢复为 `open_question`。
- 已确认根因的旧响应时间倒序问题移出已知问题，稳定规则进入[数据存储、事务与检索设计](../05-数据模型/01-数据存储事务与检索.md)。
- 当前契约、Agent Context OS 升级记录、第一阶段验收和任务地图中的旧路径、旧数量与旧实施状态已经修正。

## 验证证据

- 正式索引：103 条，87 条当前事实、16 条草稿、0 问题；101 篇文档具有 623 条标准化内部关系，任务舱和归档进入索引数量均为 0。
- 固定检索：“讨论阶段 Agent 能否修改正式文档”“邮箱验证码为什么收不到”“当前生产模型是什么”“新增 API 需要修改哪些知识”均由直接回答问题的当前知识第一命中。
- 状态边界：“长期记忆什么时候写入”和“实时语音供应商选了哪一家”同时返回当前边界与明确标记的草稿；显式状态过滤仍可只查询草稿。
- Agent Context OS 专项测试 25 项全部通过，覆盖 Markdown 路径规范化、图片和外链排除、当前事实优先、草稿过滤、关系邻接扩展以及 Windows 短路径下的索引 Git 保护。
- 项目门禁覆盖断链、孤岛、领域地图、元数据、任务舱和当前知识到草稿的未标注关系。
- ArcMind 全仓契约生成、代码规则、类型、前端与工作机测试及构建通过；Python 云端 Ruff、Pyright 和测试通过，其中测试 26 项通过、2 项按既有环境条件跳过。

## 运行态

本次只修改开发协作知识、项目门禁和本地检索依赖，不改变 ArcMind 产品代码、数据库、容器或生产服务器。没有产品开发服务需要重启，也未执行服务器操作。

## 追溯

- [知识事实与检索质量加固任务舱](../14-开发方案/0015-knowledge-retrieval-quality-hardening.md)
- [Agent Context OS 与 Obsidian 唯一知识源决策](../10-架构决策/0016-agent-context-os-v3-obsidian-source.md)
- [知识关系分层模型](../10-架构决策/0011-knowledge-relationship-model.md)
- [知识库与文档基线验收](../11-测试与验收/01-documentation-acceptance.md)
