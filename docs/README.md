---
id: "arcmind-doc-readme"
type: "project_fact"
status: "current"
summary: "ArcMind V2 Obsidian 知识库的人类阅读入口与使用边界。"
scope: ["knowledge-base"]
tags: ["arcmind-v2", "knowledge-base"]
confidence: "high"
last_verified: "2026-08-03"
---

# ArcMind V2 知识库

状态：current
最后校验日期：2026-08-03

这里是 ArcMind V2 的 Obsidian（本地 Markdown 知识库工具）首页。直接在 Obsidian 中打开 `D:\ArcMind\docs` 即可查看；Git（版本控制工具）中的 Markdown 文件始终是事实源，Obsidian 只负责阅读、链接和检索。

## 从这里开始

- [项目文档总索引](00-index.md)
- [产品内容地图](product/00-product-map.md)
- [领域内容地图](domain/00-domain-map.md)
- [架构内容地图](architecture/00-architecture-map.md)
- [模块内容地图](modules/00-modules-map.md)
- [业务内容地图](business/00-business-map.md)
- [契约内容地图](contracts/00-contracts-map.md)
- [决策内容地图](decisions/00-decisions-map.md)
- [计划内容地图](plans/00-plans-map.md)
- [质量内容地图](quality/00-quality-map.md)
- [项目记忆内容地图](project-memory/00-project-memory-map.md)
- [本次任务舱](plans/0008-knowledge-relationship-reconstruction.md)
- [任务舱模板](templates/task-capsule.md)

关系图应呈现“总索引—领域内容地图—领域文档—跨领域语义关系”四层结构。目录只负责分类，Markdown 链接负责表达依据、细化、实现、约束、发布和验收关系。

## 文档分层

| 层级 | 位置 | 用途 | 能否作为当前事实 |
|---|---|---|---|
| 正式知识库 | `product/`、`architecture/`、`business/`、`contracts/`、`domain/`、`modules/`、`decisions/`、`quality/`、`project-memory/` | 已确认、待确认或保留追溯的项目知识 | 仅 `current` 可以直接作为当前事实 |
| 隔离任务舱 | `plans/` | 保存讨论证据、批准方案、有序清单、执行与发布记录 | `draft` 不可以；`confirmed` 和 `active` 只作为本任务的执行依据 |
| 项目附件 | `assets/` | 图片、图表和其他必要资料 | 取决于引用它的文档状态 |
| 本地界面状态 | `.obsidian/` 中被忽略的文件 | 个人布局、插件、主题和缓存 | 不可以，也不提交 |

## 最小闭环

1. 为任务复制一个[任务舱模板](templates/task-capsule.md)，状态保持 `draft`；只在任务舱讨论，不改正式文档和代码。
2. 用户确认完整方案和任务清单后，将状态改为 `confirmed`；未确认部分继续标为开放问题，不得悄悄带入实施。
3. 开始实施时改为 `active`，严格按任务 ID、依赖和验收口径执行。是否使用 Git worktree（Git 独立工作树）由隔离风险决定，不按任务数量机械创建。
4. 任务舱先定义目标契约和验收口径；实现代码与正式文档在同一任务内同步完成。正式文档不得提前把尚未验证的行为写成当前事实。
5. 验证通过后填写发布记录，将任务舱改为 `done`，代码和正式知识在同一个本地提交中形成闭环。

## Agent 检索

```powershell
pnpm context:validate
pnpm context:index
pnpm context:search -- "任务调度"
```

Agent Context OS 只读正式知识并生成本地 embedded-json 索引。`plans/`、`templates/` 和 `assets/` 不进入知识索引；本地索引可以删除重建，不是事实源。

这不是简单的“永远先写文档”或“永远先写代码”。固定先完成的是已批准的任务舱；随后可以先在任务舱内明确契约，再实现和验证，最后把真实行为与正式文档一起发布。纯文档任务则在文档验收后直接闭环。

## 画布与大文件

- Canvas（Obsidian 可视化画布）可以按需添加，但只作为导航或说明视图，不能代替任务清单、状态和验收记录。
- 不安装仓库级社区插件，不依赖插件才能阅读核心文档。
- Obsidian 应用本体不会复制进仓库；共享配置只有小型 JSON（JavaScript 对象表示法）文本。
- 音视频、安装包、数据库和大体积生成物默认不进入知识库。确需提交时，应在任务舱说明用途、体积和存储方式，并评估 Git LFS（Git 大文件存储扩展）或外部对象存储。
