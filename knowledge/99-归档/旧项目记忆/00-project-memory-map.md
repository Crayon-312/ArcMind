---
id: "arcmind-project-memory-map"
type: "project_fact"
status: "current"
summary: "ArcMind V2 可审查项目记忆的 Obsidian 内容地图与迁移入口。"
scope: ["project-memory"]
tags: ["arcmind-v2", "project-memory", "knowledge-map"]
confidence: "high"
last_verified: "2026-08-13"
---

# 项目记忆内容地图

本目录保存从旧记忆格式迁入 Obsidian 的稳定项目事实、规则、决策、实现说明和开放问题。每条知识使用独立 Markdown 文件与稳定 ID，可由 Agent Context OS 直接校验、索引和检索。

## 知识记录

- [Agent Context OS schema 3 升级实现事实](../../15-发布记录/implementation-agent-context-os-v3-upgrade.md)：记录固定版本、唯一知识源和可执行检索验收。
- [历史响应时间倒序导致迁移配对失败](../../13-已知问题/01-历史响应时间倒序迁移问题.md)：记录旧 ORM 时间赋值顺序和稳定迁移配对规则。
- [mem-20260730-001](./mem-20260730-001.md)：ArcMind V2 is a voice-first personal AI assistant that can remember, track tasks and optionally coordinate a personal workstation.
- [mem-20260730-002](../../21-实时语音/01-前台语音与用户打断规则.md)：The first mobile client is a foreground Web experience and realtime speech must support user interruption.
- [mem-20260730-003](./mem-20260730-003.md)：The product is not limited to companionship or programming and does not rebuild a dedicated coding model.
- [mem-20260730-004](./mem-20260730-004.md)：Conversation context, long-term memory, tasks, reminders and interaction preferences are cloud responsibilities.
- [mem-20260730-005](./mem-20260730-005.md)：The mobile Web client uses an email-based identity and an optional workstation attaches to the same user subject.
- [mem-20260730-101](./mem-20260730-101.md)：The frozen main line and the independent v2 orphan line coexist; all new product work targets v2.
- [mem-20260730-102](./mem-20260730-102.md)：Agent Context OS governs development collaboration only and is not part of the ArcMind product runtime.
- [mem-20260730-103](./mem-20260730-103.md)：V2 starts from project documents and architecture contracts; business implementation is deferred until the documentation baseline is accepted.
- [mem-20260730-104](./mem-20260730-104.md)：Old project files and old project facts are not inherited by V2 unless the user confirms them again for the new product.
- [mem-20260730-201](./mem-20260730-201.md)：The cloud backend is the durable coordination hub; the mobile Web client and optional workstation connect to it.
- [mem-20260730-202](./mem-20260730-202.md)：Realtime voice is a replaceable low-latency interaction layer; the main Agent and task orchestrator own planning and execution state.
- [mem-20260730-203](./mem-20260730-203.md)：The optional workstation initiates an encrypted outbound connection and does not require a public IP or inbound port.
- [mem-20260730-204](./mem-20260730-204.md)：Realtime speech, reasoning models and workstation executors must be isolated behind replaceable adapters.
- [mem-20260730-205](./mem-20260730-205.md)：Workstation actions use least privilege and explicit confirmation for destructive, publishing or external-send operations.
- [mem-20260730-206](./mem-20260730-206.md)：ArcMind V2 has three independent code and deployment units: mobile Web, cloud server and optional workstation client.
- [mem-20260730-207](./mem-20260730-207.md)：ArcMind V2 uses one monorepo for three independently deployable applications and develops cloud foundations before end-to-end vertical slices.
- [mem-20260730-208](./mem-20260730-208.md)：The cloud baseline is Python 3.12 with FastAPI and Pydantic; the product main Agent uses LangGraph while ArcMind domain services and the database own business facts.
- [mem-20260730-209](./mem-20260730-209.md)：The mobile Web baseline is React, TypeScript and Vite with React Router, TanStack Query and Tailwind CSS; PWA and Web Push are deferred.
- [mem-20260730-210](./mem-20260730-210.md)：The workstation MVP uses Electron and TypeScript with a React/Vite renderer and strict renderer isolation, allowlisted IPC and local packaged content.
- [mem-20260730-211](../../15-发布记录/mem-20260730-211.md)：Cross-end contracts use OpenAPI 3.1 and versioned JSON Schema; TypeScript uses pnpm, Python uses uv, tests use pytest/Vitest/Playwright, and local or single-VPS orchestration uses Docker Compose.
- [mem-20260730-212](./mem-20260730-212.md)：PostgreSQL 18 is the single cloud source-of-truth database; Python uses SQLAlchemy 2.0, psycopg 3 and Alembic, with the same PostgreSQL major in development and production.
- [mem-20260730-213](./mem-20260730-213.md)：Business facts use relational tables and transactional outbox/inbox records; LangGraph checkpoints and pgvector embeddings remain framework-owned or rebuildable data and never replace task or memory facts.
- [mem-20260730-214](./mem-20260730-214.md)：The first durable internal job stack uses Procrastinate with PostgreSQL 18 and does not add Redis or RabbitMQ; cloud code depends on an ArcMind JobQueue adapter rather than Procrastinate types.
- [mem-20260730-215](./mem-20260730-215.md)：User Tasks, internal Jobs, workstation ExecutionLeases and ReminderOccurrences have separate lifecycles; delivery is at least once, consumers are idempotent, long workstation executions do not occupy a cloud Job worker, and reminders are generated by durable database scans.
- [mem-20260730-301](../../21-实时语音/02-实时语音供应商待决.md)：The first realtime speech provider remains undecided and requires quality-first evaluation with interruption tests.
- [mem-20260730-302](./mem-20260730-302.md)：The HTTPS approach is resolved in favor of a fixed public IPv4, Caddy and Let's Encrypt short-lived IP certificate; real mobile secure-context and microphone acceptance remains an execution gate.
- [mem-20260730-303](./mem-20260730-303.md)：The broad runtime technology-stack question was split and resolved for mobile, cloud, Agent, engineering and workstation baselines; data and infrastructure choices remain separate open questions.
- [mem-20260730-304](../../13-已知问题/mem-20260730-304.md)：Default retention periods and the confirmation threshold for long-term memory remain undecided.
- [mem-20260730-305](./mem-20260730-305.md)：The identity mechanism is resolved for the first version with one allowlisted email, short-lived one-time codes, revocable server-side sessions and email-based recovery.
- [mem-20260730-306](./mem-20260730-306.md)：The mobile text event transport is resolved with HTTPS commands and SSE delivery; workstation and realtime voice transports remain separate later-stage questions.
- [mem-20260730-307](./mem-20260730-307.md)：The monorepo question is resolved: one repository contains three independently deployable applications.
- [mem-20260730-308](./mem-20260730-308.md)：The delivery sequence is resolved: cloud foundations first, then mobile-integrated vertical slices, with the workstation phase later.
- [mem-20260730-309](./mem-20260730-309.md)：The primary data question is resolved with PostgreSQL, Alembic, pgvector and a defined backup baseline; retention, object storage, queueing and checkpoint lifecycle remain separate open questions.
- [mem-20260730-310](./mem-20260730-310.md)：The durable queue and scheduler question is resolved for the first version with Procrastinate, PostgreSQL-backed Jobs, database-driven reminder scans, at-least-once delivery and idempotent consumers.
- [mem-20260730-311](../../13-已知问题/mem-20260730-311.md)：LangGraph PostgreSQL checkpoint table initialization, schema ownership, retention and cleanup require a focused technical spike before implementation.
- [mem-20260730-401](../../13-已知问题/mem-20260730-401.md)：Task, task step and execution attempt are separate domain objects; one step may have multiple execution attempts.
- [mem-20260730-402](../../13-已知问题/mem-20260730-402.md)：Conversation turns, conversation summaries and long-term memory have distinct lifecycles and ownership.
- [mem-20260730-403](../../13-已知问题/mem-20260730-403.md)：Reminder triggering and notification delivery are separate facts and failures must not overwrite each other.
- [mem-20260803-001](./mem-20260803-001.md)：ArcMind V2 uses docs as an Obsidian vault while Git-tracked Markdown remains the source of truth; personal workspace state and downloaded extensions are not committed.
- [mem-20260803-002](./mem-20260803-002.md)：Each non-trivial change uses one plan ledger as an isolated task capsule; draft discussion cannot modify formal facts, and approved ordered tasks drive implementation before verified code and formal documents are published together.
- [mem-20260803-003](./mem-20260803-003.md)：Git worktrees are enabled by isolation risk rather than created for every task; parallel, long-running, high-risk, experimental, dirty-workspace, or independent-runtime work should be isolated when it materially improves stability.
- [mem-20260803-004](./mem-20260803-004.md)：ArcMind V2 knowledge uses a global index, domain content maps, semantic cross-domain links, and plan history links; published knowledge documents must not be isolated and every domain document must be listed by its domain map.
- [mem-20260806-216](./mem-20260806-216.md)：The first identity path allows one configured email, uses six-digit one-time codes and stores only challenge and session proof digests; sessions are revocable and no public registration, role or tenant system is included.
- [mem-20260806-217](./mem-20260806-217.md)：The first trusted HTTPS path uses a fixed public IPv4, Caddy and Let's Encrypt short-lived IP certificates with explicit default SNI, persistent certificate state and expiry monitoring; real mobile acceptance is still required.
- [mem-20260806-218](./mem-20260806-218.md)：Mobile text control uses ordinary HTTPS requests and server-to-client updates use SSE with snapshots, monotonic response sequence numbers, Last-Event-ID reconnect and durable final turns.
- [mem-20260806-219](./mem-20260806-219.md)：The first main-Agent provider is DeepSeek using deepseek-v4-pro behind the ArcMind ModelProvider port; provider failures are normalized and do not automatically switch to a second model in the first version.
- [mem-20260806-220](./mem-20260806-220.md)：Text generation persists response state, ordered delivery events and periodic full snapshots, while only a completed response creates the final assistant turn; deltas are durable reconnect and diagnostic records rather than conversation facts, and unfinished generation becomes a retryable failure after Worker recovery.
- [mem-20260806-312](../../13-已知问题/mem-20260806-312.md)：The workstation long-lived bidirectional transport, device authentication and lease renewal protocol remains undecided and is intentionally separate from the mobile SSE decision.
- [mem-20260806-313](../../13-已知问题/mem-20260806-313.md)：DeepSeek V4 Pro is selected, but production credentials and real Chinese quality, streaming cancellation, tool-call and structured-output tests remain required before the text slice can pass.
- [mem-20260806-314](./mem-20260806-314.md)：The shared-VPS high-port production-path question is resolved by moving ArcMind to a dedicated VPS that owns ports 80 and 443; the historical shared server must remain untouched.
- [mem-20260807-221](../../15-发布记录/mem-20260807-221.md)：The first ArcMind identity-and-text runtime slice is publicly reachable on a dedicated 2-vCPU, 4-GiB-class Tencent Cloud VPS with PostgreSQL 18, Mailpit, FastAPI, React and Caddy; GitHub Actions builds commit-pinned images, and direct public Chrome acceptance covers login, SSE, refresh recovery and logout.
- [mem-20260807-222](../../15-发布记录/mem-20260807-222.md)：The dedicated ArcMind VPS runs daily systemd certificate-lifetime checks and PostgreSQL custom-format backups with restricted permissions and archive-structure validation; SMTP TLS/authentication and a non-streaming DeepSeek client are implemented, but production still uses Mailpit and the deterministic model until external provider credentials are supplied and accepted.
- [mem-20260807-223](../../15-发布记录/mem-20260807-223.md)：Production commit 60d8856 runs a separate durable model Worker and PostgreSQL-backed response event stream; all eight legacy responses were migrated to their corresponding user turns, and public acceptance verified deltas, snapshots, Last-Event-ID recovery, persisted final turns, cancellation terminal protection and logout while production remains on the deterministic model.
- [mem-20260807-315](../../13-已知问题/mem-20260807-315.md)：The dedicated ArcMind VPS public HTTPS, direct Chrome path, daily certificate check and local logical backup are verified; real-phone acceptance, one actual certificate renewal, external alert delivery, encrypted off-host backup and independent-database restore rehearsal remain required.

## 维护规则

- 新增可复用事实时直接创建符合知识契约的 Markdown 文件，不再创建 JSONL 记忆记录。
- 当前实现、代码和用户确认与记忆冲突时，以当前实现、测试和用户确认为准。
- 本地检索索引只是可重建缓存，不是事实源。
