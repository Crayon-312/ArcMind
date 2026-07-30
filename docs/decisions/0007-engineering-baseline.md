# 决策 0007：跨端工程与工作机基线

状态：accepted
日期：2026-07-30

## 决策

### 依赖与仓库

- TypeScript 应用和包使用 Node.js LTS 与 pnpm workspace。
- Python 云端使用 uv 管理解释器要求、依赖和锁文件。
- 首阶段不引入 Turborepo、Nx 或 Bazel；根目录 PowerShell 脚本负责统一调用各端命令。
- 只有出现可测量的构建缓存或任务编排瓶颈时，再引入额外 Monorepo（单体仓库）任务工具。

### 契约

- HTTP API 以 FastAPI 生成的 OpenAPI 3.1 为机器事实源。
- WebSocket、任务和工作机事件使用独立 JSON Schema，并带事件版本。
- 由 Schema 生成 TypeScript 类型和客户端；禁止手工复制同名接口。
- 不把 Python Pydantic 类、数据库实体或 Electron IPC 类型作为跨端公共契约。

### 质量与部署

- Python 使用 Ruff、Pyright、pytest；异步和数据库集成测试在对应阶段补齐插件。
- TypeScript 使用 ESLint、TypeScript 严格模式和 Vitest。
- Web 端到端测试使用 Playwright，并保留真实手机验收。
- 本地依赖和单 VPS 部署使用 Docker Compose；应用镜像分别构建和回滚。
- CI（持续集成）首选 GitHub Actions，按路径运行应用检查，并始终运行契约检查。

### 工作机 MVP

- 工作机客户端使用 Electron + TypeScript；渲染层复用 React + Vite。
- 只加载随安装包发布的本地页面，不将云端网页直接作为拥有 Node.js 权限的界面加载。
- `nodeIntegration` 保持关闭，启用 `contextIsolation` 和渲染进程沙箱。
- Preload（预加载脚本）只暴露白名单 API；所有 IPC 消息校验来源和结构。
- 本地执行器由主进程适配并施加能力清单、工作目录、超时、取消和审批约束。

## 候选取舍

| 领域 | 未选方案 | 原因 |
|---|---|---|
| Monorepo 任务层 | Turborepo / Nx | 当前只有少量应用且包含 Python，额外抽象收益不足 |
| 工作机 | Tauri 2 | 体积与安全基础优秀，但首版引入 Rust 学习和调试成本 |
| 工作机 | .NET 原生 | Windows 集成强，但无法复用 React/TypeScript，跨平台和单人维护成本更高 |
| 部署 | Kubernetes | 单 VPS 和个人项目阶段过重，Docker Compose 已满足可复现编排 |

## 版本策略

- 架构文档只规定受支持的主版本边界；脚手架创建时锁定准确版本和校验和。
- Node.js 使用当时 Active LTS（活跃长期支持版），Python 固定 3.12 小版本线。
- 依赖升级通过自动化检查和回归测试进行，不使用浮动的 `latest` 作为部署输入。

## 官方证据

- [pnpm workspace](https://pnpm.io/workspaces)
- [uv projects](https://docs.astral.sh/uv/concepts/projects/)
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- [Docker Compose](https://docs.docker.com/compose/)
- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Tauri introduction](https://v2.tauri.app/start/)
- [pytest](https://pytest.org/en/stable/)
- [Vitest](https://vitest.dev/guide/)
- [Playwright](https://playwright.dev/docs/intro)
