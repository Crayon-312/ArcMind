---
type: task-capsule
status: done
task_id: "0013"
created: 2026-08-13
updated: 2026-08-13
change_level: S3
---

# 方案落实台账：Agent Context OS 新版完整升级

## 关系导航

- 所属领域：[计划内容地图](00-plans-map.md)
- 协作边界：[开发协作引擎与产品运行时分离](../decisions/0003-development-engine-boundary.md)
- 知识库决策：[Obsidian 知识库与任务隔离发布](../decisions/0010-obsidian-task-publication.md)
- 知识关系：[知识关系分层模型](../decisions/0011-knowledge-relationship-model.md)
- 发布决策：[完整使用 Agent Context OS schema 3 与 Obsidian 唯一知识源](../decisions/0016-agent-context-os-v3-obsidian-source.md)
- 验收入口：[V2 文档基线验收](../quality/01-documentation-acceptance.md)

## 目标与边界

### 业务目标

把 ArcMind 的开发协作层从旧 schema 1 和 JSONL 记忆源完整升级到 Agent Context OS 0.2.0：`docs/` 是唯一 Obsidian 项目知识源，Agent 可以真实执行校验、建立本地索引和搜索，不长期保留新旧双轨。

### 本次包含

- 固定 Agent Context OS 上游提交 `fd84369ae9fd1d88df222d18a8519fba87592f4e`。
- 配置升级为 schema 3，只使用 `agent`、Obsidian provider 和 embedded-json 本地索引。
- 为正式知识补齐 `id`、`type`、`status`、`summary` 等 Frontmatter。
- 把旧 JSONL 项目记忆迁移为 Obsidian Markdown 知识条目，然后删除旧记忆源目录。
- 更新极薄入口、知识导航和项目门禁，执行 `validate → index → search` 完整验收。

### 本次不包含

- 不修改 ArcMind 产品运行时代码、接口、数据库或部署配置。
- 不操作生产服务器，不重启产品容器。
- 不保留 schema 1、`engine`、`memory.source_paths`、JSONL provider 或旧索引格式作为兼容路径。
- 不把任务舱、模板和附件当作正式知识记录索引；它们继续保存在同一 Vault 中承担各自职责。
- 不把完整 Agent Context OS 源码复制到 ArcMind 仓库。

## 已确认事实

- 用户明确要求摒弃旧版并完整使用新版，不做兼容修复。
- ArcMind 当前锁定 `b6de397b...`，上游最新是 `fd84369...`，新增可执行 Obsidian 校验、索引和搜索运行层。
- 当前 79 篇 Markdown 已形成九领域知识网络且无关系孤岛，但正式文档没有新版必需的 `id` 和 `summary`。
- 旧配置只声明 JSONL 记忆源；最新版运行时直接校验会因旧索引 provider 失败。
- 当前工作区仅有用户的未跟踪 `.claude/`，本任务不得触碰或提交。

## 用户批准的方案

- 2026-08-13，用户批准完整升级并摒弃旧版，不维护兼容路径。
- 继续使用当前 `v2` 分支和工作区；不创建新分支或 Git worktree。
- 有效项目事实必须迁移，旧承载格式必须删除。

## 有序任务清单

| 顺序 | ID | 任务 | 依赖 | 验收口径 | 状态 |
|---:|---|---|---|---|---|
| 1 | U1 | 固化最新版、差距、边界和迁移映射 | 无 | 本任务舱可独立指导升级 | done |
| 2 | U2 | 固定新版 Agent 包并切换 schema 3 配置 | U1 | 配置中不存在旧 `engine`、`source_paths` 或旧索引 provider | done |
| 3 | U3 | 迁移正式文档和旧项目记忆到 Obsidian 知识契约 | U2 | 所有配置来源文档具有唯一 ID 和合法元数据，旧 JSONL 目录删除 | done |
| 4 | U4 | 更新入口、导航和门禁 | U3 | 入口只描述新版路径，门禁能阻止旧结构复活 | done |
| 5 | U5 | 执行新版运行层与项目质量验收 | U4 | validate、index、三类 search、项目门禁和全仓检查通过 | done |
| 6 | U6 | 写回发布事实并创建本地提交 | U5 | 任务舱闭环、提交只包含本任务改动 | done |

## 知识源边界

- 索引来源：`docs/` 中的正式产品、领域、架构、模块、业务、契约、决策、质量和 `project-memory/` 知识。
- 排除目录：`.obsidian`、`plans`、`templates`、`assets`。
- 任务舱使用 `draft → confirmed → active → done` 执行状态，不与知识记录的 `current → stale → deprecated` 状态混用。
- Markdown 与 Obsidian 双向链接都是人类事实关系；当前 Agent 索引以正文检索为主，关系图仍由标准 Markdown 链接表达。

## 发布条件

- 新版运行层能从干净安装复现。
- 本地索引是被 Git 忽略的可重建产物，删除后能重新生成。
- 搜索至少覆盖产品定位、架构边界和历史问题，并返回正确证据路径。
- 旧 JSONL 记忆源、旧配置字段和旧 provider 不再存在。
- 项目产品运行态不受影响，服务器操作不适用。

## 执行记录

| 时间 | 任务 ID | 动作与证据 | 结果 |
|---|---|---|---|
| 2026-08-13 | U1 | 对比旧提交 `b6de397b...` 与上游 `fd84369...`，量化 79 篇文档、54 条旧记忆和 schema 差距 | 完整升级边界与迁移映射确认 |
| 2026-08-13 | U2 | 以工作区开发依赖固定 Agent Context OS 0.2.0 提交 `fd84369...`，配置切换到 schema 3、唯一 Obsidian 来源和 embedded-json 索引 | 旧 `engine`、`source_paths` 和旧 provider 从唯一配置入口移除 |
| 2026-08-13 | U3 | 64 篇正式文档补齐知识契约，54 条 JSONL 记录迁入独立 Markdown；新增项目记忆地图、历史迁移根因、升级决策和实现事实 | 最终 122 条知识，0 缺失核心字段、0 重复 ID；旧 JSONL 文件和目录删除 |
| 2026-08-13 | U4 | 更新 AGENTS、README、知识入口、质量标准和项目门禁；负向创建旧目录时门禁退出码为 1，清理后恢复通过 | 旧结构复活会被自动阻止 |
| 2026-08-13 | U5 | 执行 `validate → index → search`，覆盖产品、架构、历史问题及状态过滤；运行锁文件安装、项目门禁、契约生成、前端/工作机 lint、类型、测试和构建 | 122 条知识索引成功，搜索证据正确，全仓门禁通过；仅有既有前端包体积警告 |
| 2026-08-13 | U6 | 写回决策 0016、升级实现事实与本任务舱 | 升级闭环，产品服务器和运行容器零操作 |

## 发布结果

- 协作层：完整使用 Agent Context OS 0.2.0 schema 3，不保留旧配置和 JSONL provider。
- 知识库：`docs/` 是唯一项目知识源；正式知识、项目记忆和开放问题均可校验与检索。
- 本地索引：`.agent-context/local-index/index.json` 已重建为 122 条记录，保持 Git 忽略。
- 产品运行态：不适用；本任务没有修改 ArcMind 业务代码、部署配置或服务器。
- 远端状态：本任务只创建本地提交，不自动推送。
