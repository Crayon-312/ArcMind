# ArcMind V2 项目记忆源

本目录保存团队可审查、可合并、可追溯的 ArcMind V2 项目事实。它不是原始对话存档，也不是向量数据库。

## 主题划分

- `memory-product.jsonl`：产品定位、用户价值、范围和交互原则。
- `memory-architecture.jsonl`：手机端、云端、工作机端和运行时边界。
- `memory-collaboration.jsonl`：分支策略和开发协作约束。
- `memory-open-questions.jsonl`：尚未定案但值得持续跟踪的问题。

## 记录规则

- 每行是一条合法 JSON（JavaScript 对象表示法）记录。
- 正式文件使用 `memory-<主题>.jsonl` 命名。
- 已确认并仍有效的事实使用 `current`；未确认内容使用 `draft` 或 `assumption`。
- 同一事实发生变化时保留历史记录，将旧记录标为 `stale` 或 `deprecated` 并指向新记录。
- `evidence` 必须指向当前仓库文档、代码、测试或明确的用户确认说明。
- 不保存原始私密对话、真实身份数据、安全凭据或本机隐私路径。
- 本地检索索引由这些文件生成，存放于 `.agent-context/local-index/`，不得进入 Git。

## 最小字段

```json
{
  "id": "mem-YYYYMMDD-001",
  "status": "current",
  "type": "business_rule",
  "scope": ["模块", "对象"],
  "summary": "一句话摘要",
  "source": {
    "kind": "user_confirmed",
    "ref": "来源说明",
    "date": "YYYY-MM-DD"
  },
  "evidence": ["docs/路径.md"],
  "confidence": "high",
  "last_verified": "YYYY-MM-DD",
  "tags": ["标签"]
}
```
