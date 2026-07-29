# 技术栈约定

## 当前状态

项目技术栈暂定为 Windows 优先的本地桌面 AI 终端：

- 桌面壳：Electron + electron-vite。
- 语言：TypeScript strict mode。
- 前端：React + Vite + Tailwind CSS + Zustand + TanStack Query + lucide-react。
- 视觉：Three.js/WebGL + GSAP 或 Framer Motion；粒子核心优先使用 Three.js。
- 本地后端：Electron main process。
- 模型：云端大模型 API 优先，通过 AI Runtime 适配；供应商不直接耦合 UI。
- 语音：实时通话使用浏览器原生 WebRTC，由 main process 代理私有 SDP 创建请求；ASR/TTS 继续通过 Voice Runtime 适配，不为实时通话新增第三方前端依赖。
- 数据库：SQLite 文件；当前通过 `sql.js` 在 main process 中读写本地 SQLite 文件，后续产品化可评估 native SQLite。
- 测试：Vitest、React Testing Library、后续 Electron smoke tests 和视觉截图检查。
- 打包：electron-builder，Windows 优先。

## 技术选择原则

- 优先选择项目已经使用的技术和工具。
- 新增依赖必须解决真实复杂度，不能只为个人偏好引入。
- 对模型、语音、WebGL、加密和数据库等核心能力优先选择成熟库。
- 工具链必须支持类型检查、测试、格式化和本地可复现运行。
- 模型供应商、ASR、TTS 和数据库实现必须可替换。

## 计划命令

代码工程初始化后应提供以下命令：

- 安装依赖：`npm install`
- 开发启动：`npm run dev`
- 类型检查：`npm run typecheck`
- 测试：`npm test`
- Electron smoke：`npm run smoke`
- 构建：`npm run build`
- Windows 打包：`npm run package:win`
- AGENT 结构检查：`npm run agent:check`

如果命令尚未建立，agent 最终报告必须说明“项目尚未建立验证命令”。

## 依赖引入规则

- 修改前检查是否已有等价依赖。
- 新依赖必须写明用途、替代方案和影响范围。
- 公共依赖变化必须更新测试和文档。
- 不得引入会泄露 API Key、对话内容、语音样本或本地隐私路径的工具。

## 禁止或谨慎事项

- Renderer 禁止直接依赖 Node、Electron main API、SQLite、系统密钥或模型 API Key。
- v1 不默认要求 CUDA、本地大模型运行时或专用显卡。
- 不把 API Key、私密对话、语音样本或本地绝对路径写入仓库。
- 不在未验证性能前堆叠多个持续动画库。
