---
id: "arcmind-known-issue-legacy-response-timestamp-order"
type: "known_issue"
status: "current"
summary: "旧版 ORM 写入会让响应时间比对应用户轮次早数毫秒，历史迁移必须按会话内稳定序号配对，不能依赖时间先后。"
scope: ["database", "migration", "conversation"]
tags: ["arcmind-v2", "known-issue", "legacy-response", "timestamp-order", "migration"]
confidence: "high"
last_verified: "2026-08-07"
---

# 历史响应时间倒序导致迁移配对失败

## 已确认根因

ArcMind 旧版 ORM（对象关系映射）默认时间赋值顺序会使 `assistant_responses.created_at` 比对应用户轮次早约 0.8 至 4 毫秒。首次生产迁移若要求用户轮次时间早于响应，会导致 8 条历史响应全部无法回填，并在添加非空约束前失败。

## 稳定处理规则

- 历史响应与用户轮次按同一会话内的稳定序号配对：第 N 个响应对应第 N 个用户轮次。
- 不以旧记录的毫秒级时间先后作为业务因果关系。
- 迁移必须保持事务性；回填、非空约束、外键和唯一约束在同一升级中完成。
- 专项回归必须覆盖响应时间早于用户轮次的真实旧顺序数据，以及升级、降级和再次升级。

## 证据

- [生产文字闭环任务舱](../plans/0012-production-text-runtime.md)
- [数据存储、事务与检索设计](../architecture/11-data-storage-and-transactions.md)
- [第一阶段测试矩阵](../quality/03-phase-1-test-matrix.md)
