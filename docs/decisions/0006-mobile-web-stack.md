# 决策 0006：手机 Web 技术栈

状态：accepted
日期：2026-07-30

## 关系导航

- 所属领域：[决策内容地图](00-decisions-map.md)
- 架构结果：[手机 Web 端](../architecture/02-mobile-web.md)
- 模块落点：[手机 Web 模块](../modules/mobile-web.md)
- 落实台账：[V2 首阶段技术基线](../plans/0004-v2-technology-baseline.md)

## 背景

手机端是前台打开即用的 Web 应用，首版负责注册登录、文字与实时语音交互、任务确认、进度和消息，不需要 SEO、服务端渲染、后台持续通话或原生系统控制。

## 决策

- UI 使用 React + TypeScript。
- 构建与本地开发使用 Vite，输出可由普通静态服务器托管的前端资源。
- 页面路由使用 React Router 的客户端模式。
- 服务端状态、缓存、重试和刷新使用 TanStack Query。
- 样式使用 Tailwind CSS，并用 CSS 变量保存颜色、间距和动效等设计令牌。
- 普通组件状态使用 React 内建状态；首版不默认引入 Zustand、Redux 或其他全局状态库。
- 单元与组件测试使用 Vitest + Testing Library；真实浏览器端到端测试使用 Playwright。
- PWA（渐进式 Web 应用）和 Web Push（网页推送）后置，不阻塞首个前台页面闭环。

## 为什么不是 Next.js

首版没有服务端渲染、公开内容 SEO 或 React 服务端组件需求，后端已经由 FastAPI 独立承担。Vite 的静态产物可以减少一套 Node.js 服务端运行时和部署故障点。未来若新增公开内容站点，可以为该站点单独评估 Next.js，不要求重写现有手机应用。

## 音频与实时边界

- 麦克风、播放和设备能力优先使用浏览器标准 API。
- 业务控制事件使用云端定义的版本化事件契约；具体 WebSocket、SSE（服务器发送事件）或其他通道在实时事件专项中确定。
- 供应商需要 WebRTC 或私有 SDK 时，只能放在语音适配模块，不得渗透任务、记忆和页面领域状态。
- Playwright 的移动设备仿真只用于自动回归；麦克风、音频路由、锁屏和打断必须使用真实 iOS 与 Android 手机验收。

## 风险与控制

| 风险 | 控制 |
|---|---|
| 客户端状态与云端事实冲突 | TanStack Query 只缓存服务端事实，任务状态以云端版本为准 |
| Tailwind 类名造成组件难读 | 抽取语义组件和设计令牌，不建立任意字符串拼接规则 |
| SPA 刷新出现 404 | 静态服务器配置 History API fallback，并用部署测试覆盖深链接 |
| 现代浏览器差异 | Playwright 覆盖三引擎，关键音频能力增加真机矩阵 |

## 官方证据

- [React: Creating a React app](https://react.dev/learn/creating-a-react-app)
- [Vite guide](https://vite.dev/guide/)
- [React Router installation](https://reactrouter.com/start/declarative/installation)
- [TanStack Query overview](https://tanstack.com/query/latest/docs/framework/react/overview)
- [Tailwind CSS with Vite](https://tailwindcss.com/docs/installation/using-vite)
- [Vitest guide](https://vitest.dev/guide/)
- [Playwright installation](https://playwright.dev/docs/intro)
