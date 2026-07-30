# 依赖安全审计记录

本文记录 ArcMind 当前依赖树的已知安全风险、处置状态和复查入口。它只保存可公开的包名、版本、风险与修复建议，不保存账号、密钥、日志正文或本机隐私路径。

## 2026-07-29 审计基线

- 审计命令：`npm audit --json`、`npm audit --omit=dev --json`。
- 锁定版本：Git 提交 `2676381` 对应的 `package-lock.json`。
- 汇总：21 个受影响包，其中 2 个 `critical`、15 个 `high`、4 个 `moderate`，无 `low`。
- 生产依赖审计：仅 `electron` 保留 1 个 `high` 条目；其余风险来自测试、开发服务器或打包工具链。
- 当前处置：已知、暂缓修复。首要任务改为调通首页实时语音，不执行 `npm audit fix` 或强制跨大版本升级。

## Critical

| 包 | 当前版本 | 风险摘要 | 当前暴露面 |
| --- | --- | --- | --- |
| `vitest` | `2.1.9` | Vitest UI server 启用时可能读取并执行任意文件，GHSA-5xrq-8626-4rwp | 当前只运行 `vitest run`，未启用 UI server |
| `tar` | `6.2.1` | 特制归档可能造成无限解析、拒绝服务、路径穿越或文件覆盖，包含 GHSA-23hp-3jrh-7fpw 等公告 | `electron-builder` 间接依赖，仅安装、原生模块重建或打包时使用 |

## High

| 包 | 当前版本 | 风险来源或摘要 |
| --- | --- | --- |
| `electron` | `33.4.11` | 生产运行环境风险；包含内存释放后使用、渲染器命令行参数注入等公告 |
| `electron-builder` | `25.1.8` | 直接开发依赖；聚合 `tar` 与打包链风险 |
| `@electron/rebuild` | `3.6.1` | 通过 `node-gyp`、`tar` 继承风险 |
| `app-builder-lib` | `25.1.8` | AppImage 构建存在不受控搜索路径问题；Windows 当前不直接触发 |
| `builder-util` | `25.1.7` | 通过 `builder-util-runtime` 继承风险 |
| `builder-util-runtime` | `9.2.10` | 跨域重定向可能泄露认证请求头 |
| `electron-builder-squirrel-windows` | `25.1.8` | Windows 安装包构建链继承风险 |
| `electron-publish` | `25.1.7` | 发布链继承认证头泄露与构建依赖风险 |
| `dmg-builder` | `25.1.8` | macOS 打包链继承风险；Windows 当前不直接使用 |
| `node-gyp` | `9.4.1` | 原生模块构建链通过 `tar` 继承风险 |
| `make-fetch-happen` | `10.2.1` | 下载与缓存链通过 `cacache`、`tar` 继承风险 |
| `cacache` | `16.1.3` | 缓存链通过 `tar` 继承风险 |
| `brace-expansion` | `1.1.15`、`2.1.1`、`5.0.7` | 恶意模式可能导致指数级展开、内存耗尽或拒绝服务 |
| `postcss` | `8.5.16` | Source Map 自动加载可能导致路径穿越和本地 `.map` 文件泄露 |
| `vite` | `5.4.21` | Windows 替代路径可能绕过开发服务器 `server.fs.deny` |

## Moderate

| 包 | 当前版本 | 风险来源 |
| --- | --- | --- |
| `@vitest/mocker` | `2.1.9` | 继承 `vite` 风险 |
| `electron-vite` | `2.3.0` | 继承 `vite`、`esbuild` 风险 |
| `esbuild` | `0.21.5` | 开发服务器请求风险 |
| `vite-node` | `2.1.9` | 继承 `vite` 风险 |

## 后续修复入口

恢复修复时按以下顺序评估，不直接运行破坏性自动升级：

1. 优先升级 `electron`，并验证 main、preload、renderer、WebRTC、打包和安装行为。
2. 升级 `electron-builder`，确认 `tar` 与构建链风险被消除。
3. 升级 `vitest`、`vite`、`electron-vite`，补跑全部测试和开发服务器检查。
4. 重新运行生产依赖和完整依赖审计，更新本文件的版本、数量和剩余风险。

2026-07-29 的 `npm audit` 建议目标包括 `electron@43.2.0`、`electron-builder@26.15.3`、`vitest@4.1.10`、`vite@8.1.5` 和 `electron-vite@5.0.0`；这些均涉及跨大版本变化，进入实施前必须重新核对最新版本和迁移说明。
