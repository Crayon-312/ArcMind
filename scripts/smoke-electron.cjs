const { app, BrowserWindow, ipcMain } = require('electron')
const { existsSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const root = join(__dirname, '..')
const rendererEntry = join(root, 'out', 'renderer', 'index.html')
const preloadEntry = join(root, 'out', 'preload', 'index.cjs')
const smokeWidth = Number(process.env.ARCMIND_SMOKE_WIDTH) || 1280
const smokeHeight = Number(process.env.ARCMIND_SMOKE_HEIGHT) || 820

async function main() {
  if (!existsSync(rendererEntry)) {
    throw new Error('Renderer build output is missing. Run npm run build first.')
  }
  if (!existsSync(preloadEntry)) {
    throw new Error('Preload build output is missing. Run npm run build first.')
  }

  await app.whenReady()
  registerSmokeIpc()

  const window = new BrowserWindow({
    width: smokeWidth,
    height: smokeHeight,
    show: false,
    backgroundColor: '#030607',
    webPreferences: {
      preload: preloadEntry,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  await window.loadFile(rendererEntry)
  await waitForRenderedApp(window)

  const corePoint = await window.webContents.executeJavaScript(`
    (() => {
      const rect = document.querySelector('.particle-core')?.getBoundingClientRect();
      return rect ? { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height * 0.46) } : null;
    })()
  `)
  if (corePoint) {
    window.webContents.sendInputEvent({ type: 'mouseDown', x: corePoint.x, y: corePoint.y, button: 'left', clickCount: 1 })
    await new Promise((resolve) => setTimeout(resolve, 80))
  }
  const coreDragStarted = await window.webContents.executeJavaScript(`
    Boolean(document.querySelector('.particle-core')?.classList.contains('is-dragging'))
  `)
  if (corePoint) {
    window.webContents.sendInputEvent({ type: 'mouseMove', x: corePoint.x + 80, y: corePoint.y + 20 })
    window.webContents.sendInputEvent({ type: 'mouseUp', x: corePoint.x + 80, y: corePoint.y + 20, button: 'left' })
    window.webContents.sendInputEvent({ type: 'mouseWheel', x: corePoint.x, y: corePoint.y, deltaY: -260, wheelTicksY: -3 })
    await new Promise((resolve) => setTimeout(resolve, 180))
  }

  const checks = await window.webContents.executeJavaScript(`
    (async () => {
      const canvas = document.querySelector('canvas');
      const input = document.querySelector('input[aria-label="输入消息"]');
      const conversationList = document.querySelector('.conversation-list');
      const conversationEdgeTab = document.querySelector('.conversation-edge-tab');
      const drawerHiddenBeforeOpen = conversationList ? getComputedStyle(conversationList).opacity === '0' : false;
      conversationEdgeTab?.click();
      await new Promise((resolve) => setTimeout(resolve, 520));
      const openedConversationList = document.querySelector('.conversation-list');
      const drawerOpenAfterClick = openedConversationList
        ? openedConversationList.classList.contains('is-open') && getComputedStyle(openedConversationList).pointerEvents === 'auto'
        : false;
      const hudLabels = Array.from(document.querySelectorAll('.side-hud .hud-row span')).map((node) => node.textContent?.trim());
      const coreModeLabel = document.querySelector('.core-readout span')?.textContent?.trim() ?? null;
      const settings = document.querySelector('button[title="设置"]');
      settings?.click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const settingsPanel = document.querySelector('.settings-panel');
      const voiceEnable = settingsPanel?.querySelector('.voice-enable-row input');
      const voiceSectionText = settingsPanel?.querySelector('.settings-section-live')?.textContent ?? '';
      if (settingsPanel) {
        settingsPanel.scrollTop = settingsPanel.scrollHeight;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
      const voiceSaveButton = Array.from(settingsPanel?.querySelectorAll('button') ?? [])
        .find((button) => button.textContent?.includes('保存语音设置'));
      const settingsRect = settingsPanel?.getBoundingClientRect();
      const voiceSaveRect = voiceSaveButton?.getBoundingClientRect();
      const memoryButton = document.querySelector('button[title="记忆"]');
      const canvasPixels = sampleCanvasCenter(canvas);
      return {
        title: document.querySelector('h1')?.textContent ?? null,
        inputPresent: Boolean(input),
        arcMindBridgePresent: Boolean(window.arcMind?.settings?.testModelConfig),
        realtimeVoiceBridgePresent: Boolean(window.arcMind?.settings?.testRealtimeVoiceConfig),
        coreDragStarted: ${JSON.stringify(coreDragStarted)},
        drawerHiddenBeforeOpen,
        drawerOpenAfterClick,
        hudLabels,
        coreModeLabel,
        settingsButtonPresent: Boolean(settings),
        settingsPanelPresent: Boolean(settingsPanel),
        settingsPanelFitsViewport: settingsPanel
          ? settingsPanel.getBoundingClientRect().bottom <= window.innerHeight && settingsPanel.scrollHeight >= settingsPanel.clientHeight
          : false,
        realtimeVoiceDeclarationPresent: voiceSectionText.includes('仅限 codex-LB') && voiceSectionText.includes('不会创建通话'),
        realtimeVoiceDisabledBeforeProbe: Boolean(voiceEnable?.disabled),
        settingsBottomContentReachable: Boolean(
          settingsRect &&
            voiceSaveRect &&
            voiceSaveRect.top >= settingsRect.top &&
            voiceSaveRect.bottom <= settingsRect.bottom
        ),
        memoryButtonPresent: Boolean(memoryButton),
        canvasPresent: Boolean(canvas),
        canvasSize: canvas ? { width: canvas.width, height: canvas.height, clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight } : null,
        nonBlankCanvasPixels: canvasPixels
      };

      function sampleCanvasCenter(canvas) {
        if (!canvas) return 0;
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) return 0;
        const size = 32;
        const pixels = new Uint8Array(size * size * 4);
        const x = Math.max(0, Math.floor(gl.drawingBufferWidth / 2 - size / 2));
        const y = Math.max(0, Math.floor(gl.drawingBufferHeight / 2 - size / 2));
        gl.readPixels(x, y, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let count = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          if (pixels[index] !== 0 || pixels[index + 1] !== 0 || pixels[index + 2] !== 0 || pixels[index + 3] !== 0) {
            count += 1;
          }
        }
        return count;
      }
    })()
  `)

  assert(checks.title === 'ArcMind', 'ArcMind title is missing.')
  assert(checks.inputPresent, 'Composer input is missing.')
  assert(checks.arcMindBridgePresent, 'ArcMind preload bridge is missing.')
  assert(checks.realtimeVoiceBridgePresent, 'Realtime voice preload bridge is missing.')
  assert(checks.coreDragStarted, 'Particle core did not enter drag interaction state.')
  assert(checks.drawerHiddenBeforeOpen, 'Conversation drawer should be hidden before interaction.')
  assert(checks.drawerOpenAfterClick, 'Conversation drawer did not open from the edge tab.')
  assert(checks.coreModeLabel === '弦核模式', 'Core mode label is not localized.')
  assert(['模型', '会话', '记忆', '令牌'].every((label) => checks.hudLabels.includes(label)), 'HUD labels are not localized.')
  assert(checks.settingsButtonPresent, 'Settings button is missing.')
  assert(checks.settingsPanelPresent, 'Settings panel did not open.')
  assert(checks.settingsPanelFitsViewport, 'Settings panel overflows the viewport without a scroll boundary.')
  assert(checks.realtimeVoiceDeclarationPresent, 'Realtime voice codex-LB limitation is missing.')
  assert(checks.realtimeVoiceDisabledBeforeProbe, 'Realtime voice should be disabled before capability detection.')
  assert(checks.settingsBottomContentReachable, 'Realtime voice controls cannot be reached by scrolling.')
  assert(checks.memoryButtonPresent, 'Memory button is missing.')
  assert(checks.canvasPresent, 'Particle canvas is missing.')
  assert(
    checks.canvasSize?.clientWidth >= Math.min(900, smokeWidth - 40) &&
      checks.canvasSize?.clientHeight >= Math.min(600, smokeHeight - 80),
    'Particle canvas has an unexpected size.'
  )
  assert(checks.nonBlankCanvasPixels > 0, 'Particle canvas appears blank.')

  if (process.env.ARCMIND_SMOKE_SCREENSHOT) {
    writeFileSync(process.env.ARCMIND_SMOKE_SCREENSHOT, (await window.capturePage()).toPNG())
  }

  console.log(JSON.stringify({ ok: true, checks }, null, 2))
  window.destroy()
  app.quit()
}

function registerSmokeIpc() {
  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('app:get-runtime-info', () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    platform: process.platform,
    arch: process.arch,
    packaged: app.isPackaged
  }))
  ipcMain.handle('settings:get-model-config', () => ({
    provider: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxContextMessages: 12,
    timeoutMs: 60000,
    hasApiKey: false
  }))
  ipcMain.handle('settings:set-model-config', () => ({
    provider: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxContextMessages: 12,
    timeoutMs: 60000,
    hasApiKey: false
  }))
  ipcMain.handle('settings:test-model-config', () => ({
    ok: false,
    error: {
      code: 'validation_failed',
      message: 'Smoke test does not use a real model key.',
      recoverable: true
    }
  }))
  ipcMain.handle('settings:get-realtime-voice-config', () => ({
    provider: 'codex-lb-live',
    enabled: false,
    baseUrl: '',
    hasApiKey: false
  }))
  ipcMain.handle('settings:set-realtime-voice-config', () => ({
    provider: 'codex-lb-live',
    enabled: false,
    baseUrl: '',
    hasApiKey: false
  }))
  ipcMain.handle('settings:test-realtime-voice-config', () => ({
    ok: false,
    status: 'not_configured',
    message: '请先配置 codex-LB。',
    checkedAt: new Date(0).toISOString()
  }))
  ipcMain.handle('storage:get-most-recent-conversation', () => null)
  ipcMain.handle('storage:list-conversations', () => [])
  ipcMain.handle('storage:list-memories', () => [])
}

function waitForRenderedApp(window) {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const timer = setInterval(async () => {
      if (Date.now() - started > 12000) {
        clearInterval(timer)
        reject(new Error('Timed out waiting for ArcMind renderer.'))
        return
      }

      try {
        const ready = await window.webContents.executeJavaScript(`
          Boolean(document.querySelector('h1') && document.querySelector('canvas') && document.querySelector('input[aria-label="输入消息"]'))
        `)
        if (ready) {
          clearInterval(timer)
          setTimeout(resolve, 450)
        }
      } catch {
        // Keep polling while the renderer boots.
      }
    }, 120)
  })
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
