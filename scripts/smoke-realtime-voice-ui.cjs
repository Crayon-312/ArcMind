const { app, BrowserWindow, ipcMain } = require('electron')
const { existsSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const root = join(__dirname, '..')
const rendererEntry = join(root, 'out', 'renderer', 'index.html')
const preloadEntry = join(root, 'out', 'preload', 'index.cjs')
const smokeWidth = Number(process.env.ARCMIND_SMOKE_WIDTH) || 1280
const smokeHeight = Number(process.env.ARCMIND_SMOKE_HEIGHT) || 820

async function main() {
  if (!existsSync(rendererEntry) || !existsSync(preloadEntry)) {
    throw new Error('Build output is missing. Run npm run build first.')
  }

  await app.whenReady()
  registerIpc()
  const window = new BrowserWindow({
    width: smokeWidth,
    height: smokeHeight,
    show: false,
    backgroundColor: '#030607',
    webPreferences: {
      preload: preloadEntry,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })

  await window.loadFile(rendererEntry)
  await waitFor(window, () => `
    Boolean(
      document.querySelector('canvas') &&
      document.querySelector('.voice-call-panel') &&
      document.querySelector('.voice-primary-button')?.textContent?.includes('开始实时通话')
    )
  `)
  if (process.env.ARCMIND_SMOKE_SCREENSHOT) {
    window.showInactive()
  }
  await new Promise((resolve) => setTimeout(resolve, 650))

  const checks = await window.webContents.executeJavaScript(`
    (() => {
      const panel = document.querySelector('.voice-call-panel');
      const start = document.querySelector('.voice-primary-button');
      const core = document.querySelector('.particle-core');
      const dot = document.querySelector('.status-dot');
      const panelRect = panel?.getBoundingClientRect();
      const startStyle = start ? getComputedStyle(start) : null;
      return {
        panelPresent: Boolean(panel),
        readyState: panel?.classList.contains('is-ready') ?? false,
        explicitStartPresent: start?.textContent?.includes('开始实时通话') ?? false,
        startEnabled: start ? !start.disabled : false,
        textComposerAbsent: !document.querySelector('input[aria-label="输入消息"]'),
        coreModeReady: document.querySelector('.core-readout strong')?.textContent?.trim() === '等待开始',
        statusDotReady: dot?.classList.contains('status-ready') ?? false,
        canvasPresent: Boolean(document.querySelector('canvas')),
        wrappedCore: core?.getAttribute('data-core-shell') === 'wrapped',
        panelFitsViewport: panelRect
          ? panelRect.left >= 0 && panelRect.right <= innerWidth && panelRect.bottom <= innerHeight
          : false,
        startVisible: startStyle ? startStyle.opacity !== '0' && startStyle.pointerEvents !== 'none' : false,
        callBridgePresent: typeof window.arcMind?.voice?.createRealtimeCall === 'function'
      };
    })()
  `)

  assert(checks.panelPresent, 'Realtime voice panel is missing.')
  assert(checks.readyState, 'Realtime voice should wait in the ready state.')
  assert(checks.explicitStartPresent && checks.startEnabled, 'Explicit start control is unavailable.')
  assert(checks.textComposerAbsent, 'Text composer must be hidden while realtime voice is enabled.')
  assert(checks.coreModeReady && checks.statusDotReady, 'Ready visual state is not exposed.')
  assert(checks.canvasPresent && checks.wrappedCore, 'Particle core is missing.')
  assert(checks.panelFitsViewport && checks.startVisible, 'Realtime voice controls are not visibly usable.')
  assert(checks.callBridgePresent, 'Realtime voice call bridge is missing.')

  await window.webContents.executeJavaScript(`
    (() => {
      const audioContext = new AudioContext();
      const silentStream = audioContext.createMediaStreamDestination().stream;
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        configurable: true,
        value: async () => silentStream
      });
      document.querySelector('.voice-primary-button')?.click();
    })()
  `)
  await waitFor(window, () => `
    Boolean(
      document.querySelector('.voice-call-panel.is-connection_error') &&
      document.querySelector('.voice-diagnostic') &&
      document.querySelector('.voice-diagnostic')?.textContent?.includes('realtime_call_unavailable')
    )
  `)
  const failureChecks = await window.webContents.executeJavaScript(`
    (() => {
      const diagnostic = document.querySelector('.voice-diagnostic');
      const diagnosticRect = diagnostic?.getBoundingClientRect();
      return {
        stageVisible: diagnostic?.textContent?.includes('codex-LB 通话创建') ?? false,
        chineseErrorVisible: diagnostic?.textContent?.includes('上游实时语音不可用') ?? false,
        internalCodeVisible: diagnostic?.textContent?.includes('realtime_unavailable') ?? false,
        upstreamCodeVisible: diagnostic?.textContent?.includes('realtime_call_unavailable') ?? false,
        recoveryVisible: document.querySelector('.voice-recovery-actions')?.textContent?.includes('重试') ?? false,
        diagnosticFitsViewport: diagnosticRect
          ? diagnosticRect.left >= 0 && diagnosticRect.right <= innerWidth && diagnosticRect.bottom <= innerHeight
          : false
      };
    })()
  `)
  assert(failureChecks.stageVisible, 'Realtime failure stage is not visible.')
  assert(failureChecks.chineseErrorVisible && failureChecks.internalCodeVisible, 'Realtime error code is incomplete.')
  assert(failureChecks.upstreamCodeVisible, 'Safe upstream error code is not visible.')
  assert(failureChecks.recoveryVisible, 'Realtime recovery controls are missing.')
  assert(failureChecks.diagnosticFitsViewport, 'Realtime diagnostic panel does not fit the viewport.')

  if (process.env.ARCMIND_SMOKE_SCREENSHOT) {
    writeFileSync(process.env.ARCMIND_SMOKE_SCREENSHOT, (await window.capturePage()).toPNG())
  }

  console.log(JSON.stringify({ ok: true, checks, failureChecks }, null, 2))
  window.destroy()
  app.quit()
}

function registerIpc() {
  ipcMain.handle('app:get-version', () => '0.1.0')
  ipcMain.handle('app:get-runtime-info', () => ({
    version: '0.1.0',
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    platform: process.platform,
    arch: process.arch,
    packaged: false
  }))
  ipcMain.handle('system:get-telemetry-snapshot', () => ({
    capturedAt: new Date(0).toISOString(),
    cpu: { usagePct: 20, cores: 8, status: 'ok' },
    memory: { usedBytes: 8, totalBytes: 16, usagePct: 50, status: 'ok' },
    disk: { usedBytes: 40, totalBytes: 100, usagePct: 40, status: 'ok' },
    gpu: { name: 'Smoke GPU', usagePct: null, featureStatus: 'enabled', status: 'ok' }
  }))
  ipcMain.handle('settings:get-model-config', () => ({
    provider: 'openai-compatible',
    baseUrl: '',
    model: '',
    temperature: 0.7,
    maxContextMessages: 12,
    timeoutMs: 60000,
    hasApiKey: false
  }))
  ipcMain.handle('settings:get-realtime-voice-config', () => ({
    provider: 'codex-lb-live',
    enabled: true,
    baseUrl: 'https://voice.example.com',
    hasApiKey: true
  }))
  ipcMain.handle('settings:test-realtime-voice-config', () => ({
    ok: true,
    status: 'available',
    message: '实时语音能力可用。',
    checkedAt: new Date(0).toISOString()
  }))
  ipcMain.handle('storage:get-most-recent-conversation', () => null)
  ipcMain.handle('storage:list-conversations', () => [])
  ipcMain.handle('storage:list-memories', () => [])
  ipcMain.handle('voice:create-realtime-call', () => ({
    ok: false,
    error: {
      code: 'realtime_unavailable',
      message: 'codex-LB 已收到请求，但上游 ChatGPT 账户未能创建 Live Voice 通话。',
      recoverable: true,
      details: {
        stage: 'call_creation',
        httpStatus: 403,
        upstreamCode: 'realtime_call_unavailable'
      }
    }
  }))
}

async function waitFor(window, expression) {
  const started = Date.now()
  while (Date.now() - started < 12000) {
    if (await window.webContents.executeJavaScript(expression())) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 120))
  }
  throw new Error('Timed out waiting for realtime voice UI.')
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

main().catch((error) => {
  console.error(error)
  app.quit()
  process.exitCode = 1
})
