---
id: "arcmind-doc-quality-01-documentation-acceptance"
type: "project_fact"
status: "current"
summary: "质量标准《验收口径：V2 文档基线》的当前事实、边界与关联依据。"
scope: ["quality"]
tags: ["arcmind-v2", "quality"]
confidence: "high"
last_verified: "2026-08-03"
---

# 验收口径：V2 文档基线

状态：current
最后校验日期：2026-08-03

## 关系导航

- 所属领域：[质量内容地图](00-quality-map.md)
- 知识入口：[项目文档总索引](../00-index.md)
- 关系决策：[知识关系分层模型](../decisions/0011-knowledge-relationship-model.md)
- 落实台账：[知识关系重构](../plans/0008-knowledge-relationship-reconstruction.md)
- 自动检查：[项目协作检查脚本](../../scripts/check-agent.ps1)

## 验收标准

| 编号 | 标准 | 验证方式 |
|---|---|---|
| DA-001 | V2 是无 `main` 提交祖先的独立分支 | `git merge-base v2 main` 应无共同祖先 |
| DA-002 | Agent Context OS 采用极薄启动器，不复制完整引擎 | 检查根入口、配置和目录结构 |
| DA-003 | 开发协作引擎与产品运行时职责明确分离 | 检查 README、AGENTS 和决策 0003 |
| DA-004 | 项目背景、范围、需求、用户和路线完整 | 检查 `docs/product/` |
| DA-005 | 手机、云端、工作机和主 Agent 职责及非职责明确 | 检查 `docs/architecture/` |
| DA-006 | 对话、任务、提醒和跨端事件具有可执行基线 | 检查 `docs/business/` 与 `docs/contracts/` |
| DA-007 | 当前事实和开放问题没有混写 | 检查文档状态与项目记忆状态 |
| DA-008 | Obsidian 正式知识具有唯一 ID、合法类型/状态/摘要且无敏感标记 | 运行 `pnpm context:validate` |
| DA-009 | 本地索引和运行配置被 Git 忽略 | 检查 `.gitignore` 和配置 |
| DA-010 | 文档无空白错误，交叉引用目标存在 | `git diff --check` 加自动链接检查 |
| DA-011 | `docs/` 可作为 Obsidian 知识库打开，且个人工作区和下载扩展不进入 Git | 检查 `.obsidian/app.json` 与 `.gitignore` |
| DA-012 | 非平凡任务具有单文件任务舱、状态门禁和有序任务清单 | 检查 `docs/plans/`、任务舱模板和 AGENTS 入口 |
| DA-013 | 未验证实现不会被正式文档提前声明为当前事实 | 检查任务舱发布记录、实现证据与正式文档状态一致 |
| DA-014 | 总索引、领域内容地图和跨领域语义关系形成可导航知识网络 | 运行项目检查并量化内部文档关系 |
| DA-015 | 当前有效和已接受的正式文档不得成为关系孤岛 | 运行 `scripts/check-agent.ps1` 的知识关系检查 |
| DA-016 | 新增正式文档必须被对应领域内容地图收录 | 检查正式目录的 `00-*-map.md` 与文档入度 |
| DA-017 | Agent Context OS 能从唯一 Obsidian 来源重建索引并检索产品、架构和历史问题 | 运行 `pnpm context:index` 和固定检索用例 |
| DA-018 | schema 1、旧 `engine`、JSONL 记忆源和旧索引 provider 不得复活 | 运行 `scripts/check-agent.ps1` |

## 本阶段不适用

- 业务单元测试、集成测试和端到端测试：尚无业务代码。
- 构建和开发服务重启：尚无应用运行态。
- 实时语音质量验收：供应商尚未选择。

## 失败处理

任何检查失败时必须记录失败文件、实际输出、期望结果和修正方式。不得通过删除门禁或把未确认内容改成 `current` 来让检查通过。
