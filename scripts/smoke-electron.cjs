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
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })

  await window.loadFile(rendererEntry)
  await waitForRenderedApp(window)
  const initialCanvasPixelEvidence = await sampleCapturedCanvas(window)

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
  const composerBehaviorChecks = await verifyComposerBehavior(window)
  const checks = await window.webContents.executeJavaScript(`
    (async () => {
      const canvas = document.querySelector('canvas');
      const input = document.querySelector('input[aria-label="输入消息"]');
      const conversationList = document.querySelector('.conversation-list');
      const conversationHotspot = document.querySelector('.corner-hotspot-left');
      const toolRail = document.querySelector('.tool-rail');
      const workbench = document.querySelector('.workbench-panel');
      const composer = document.querySelector('.composer');
      const particleCore = document.querySelector('.particle-core');
      const systemPanel = document.querySelector('.system-mini-panel');
      const systemPanelRect = systemPanel?.getBoundingClientRect();
      const systemPanelStyle = systemPanel ? getComputedStyle(systemPanel) : null;
      const systemProjection = document.querySelector('.system-telemetry-projection');
      const systemProjectionStyle = systemProjection ? getComputedStyle(systemProjection) : null;
      const conversationZoneRect = document.querySelector('.conversation-drawer-zone')?.getBoundingClientRect();
      const toolZoneRect = document.querySelector('.tool-rail-zone')?.getBoundingClientRect();
      const composerZoneRect = document.querySelector('.composer-zone')?.getBoundingClientRect();
      const systemTelemetryPresentBeforePanels = Boolean(systemPanel);
      const systemTelemetryTiny = systemPanelRect ? systemPanelRect.width <= 210 && systemPanelRect.height <= 170 : false;
      const systemTelemetryTransparent = systemPanelStyle
        ? (systemPanelStyle.backdropFilter === 'none' || systemPanelStyle.backdropFilter === '') && systemPanelStyle.backgroundColor.includes('rgba')
        : false;
      const systemTelemetryProjectionVisible = systemProjectionStyle ? systemProjectionStyle.opacity !== '0' && systemProjectionStyle.pointerEvents === 'auto' : false;
      const drawerHiddenBeforeOpen = conversationList ? getComputedStyle(conversationList).opacity === '0' : false;
      conversationHotspot?.click();
      await new Promise((resolve) => setTimeout(resolve, 520));
      const openedConversationList = document.querySelector('.conversation-list');
      const drawerOpenAfterClick = openedConversationList
        ? openedConversationList.classList.contains('is-open') && getComputedStyle(openedConversationList).pointerEvents === 'auto'
        : false;
      const toolRailHiddenBeforeOpen = toolRail ? getComputedStyle(toolRail).opacity === '0' : false;
      const toolHotspot = document.querySelector('.corner-hotspot-right');
      toolHotspot?.click();
      await new Promise((resolve) => setTimeout(resolve, 520));
      const openedToolRail = document.querySelector('.tool-rail');
      const toolRailOpenAfterClick = openedToolRail
        ? openedToolRail.classList.contains('is-open') && getComputedStyle(openedToolRail).pointerEvents === 'auto'
        : false;
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
      const memoryButton = document.querySelector('button[title^="记忆"]');
      const responseButton = document.querySelector('button[title^="回应"]');
      responseButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 260));
      const workbenchOpenAfterClick = workbench ? workbench.classList.contains('is-open') && getComputedStyle(workbench).pointerEvents === 'auto' : false;
      const systemTelemetryHiddenWhenWorkbenchOpen = systemProjection ? systemProjection.classList.contains('is-hidden') && getComputedStyle(systemProjection).pointerEvents === 'none' : false;
      const composerHiddenBeforeOpen = composer ? getComputedStyle(composer).opacity === '0' : false;
      document.querySelector('button[title="关闭工作台"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 240));
      document.querySelector('.composer-handle')?.click();
      await new Promise((resolve) => setTimeout(resolve, 260));
      const composerOpenAfterClick = composer ? composer.classList.contains('is-open') && getComputedStyle(composer).pointerEvents === 'auto' : false;
      const messageInput = document.querySelector('input[aria-label="输入消息"]');
      if (messageInput) {
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        valueSetter?.call(messageInput, '测试自动弹出工作台');
        messageInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      document.querySelector('.send-button')?.click();
      await new Promise((resolve) => setTimeout(resolve, 170));
      const earlyWorkbenchText = document.querySelector('.markdown-body')?.textContent ?? '';
      const typewriterPartialBeforeCompletion = earlyWorkbenchText.includes('Smoke') && !earlyWorkbenchText.includes('Smoke link');
      await new Promise((resolve) => setTimeout(resolve, 1700));
      const autoWorkbench = document.querySelector('.workbench-panel');
      const autoWorkbenchOpenAfterSend = autoWorkbench
        ? autoWorkbench.classList.contains('is-open') && getComputedStyle(autoWorkbench).pointerEvents === 'auto'
        : false;
      const markdownBody = document.querySelector('.markdown-body');
      const autoWorkbenchRenderedReply = Boolean(markdownBody?.textContent?.includes('Smoke response'));
      const markdownHeadingRendered = document.querySelector('.markdown-body h2')?.textContent?.trim() === 'Smoke response';
      const markdownTableRendered = Boolean(document.querySelector('.markdown-body table td')?.textContent?.includes('Markdown'));
      const markdownCodeRendered = Boolean(document.querySelector('.markdown-body pre code')?.textContent?.includes('const visible = true'));
      const markdownLinkRendered = document.querySelector('.markdown-body a')?.getAttribute('href') === 'https://example.com';
      const choiceButtons = Array.from(document.querySelectorAll('.choice-list button')).map((button) => button.textContent?.trim());
      document.querySelector('.choice-list button')?.click();
      await new Promise((resolve) => setTimeout(resolve, 220));
      const choiceFilledDraft = document.querySelector('input[aria-label="输入消息"]')?.value === '选择快速原型路线';
      const choiceOpenedComposer = Boolean(document.querySelector('.composer')?.classList.contains('is-open'));
      const brandAnchor = document.querySelector('.brand-anchor h1')?.textContent?.trim() ?? null;
      return {
        title: document.querySelector('.brand-anchor h1')?.textContent ?? null,
        brandAnchor,
        inputPresent: Boolean(input),
        arcMindBridgePresent: Boolean(window.arcMind?.settings?.testModelConfig),
        realtimeVoiceBridgePresent: Boolean(window.arcMind?.settings?.testRealtimeVoiceConfig),
        coreDragStarted: ${JSON.stringify(coreDragStarted)},
        drawerHiddenBeforeOpen,
        drawerOpenAfterClick,
        conversationHotspotEmpty: Boolean(conversationHotspot) && conversationHotspot.textContent.trim() === '' && !conversationHotspot.querySelector('svg'),
        conversationZoneSize: conversationZoneRect ? { width: conversationZoneRect.width, height: conversationZoneRect.height } : null,
        toolRailHiddenBeforeOpen,
        toolRailOpenAfterClick,
        toolRailIconOnly: Boolean(openedToolRail) && openedToolRail.textContent.trim() === '',
        toolZoneSize: toolZoneRect ? { width: toolZoneRect.width, height: toolZoneRect.height } : null,
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
        responseButtonPresent: Boolean(responseButton),
        workbenchOpenAfterClick,
        systemTelemetryPresentBeforePanels,
        systemTelemetryTiny,
        systemTelemetryTransparent,
        systemTelemetryProjectionVisible,
        systemTelemetryHiddenWhenWorkbenchOpen,
        systemTelemetryRows: document.querySelectorAll('.system-mini-metric').length,
        systemTelemetrySource: systemPanel?.textContent?.includes('LIVE') ? 'LIVE' : systemPanel?.textContent?.includes('DEMO') ? 'DEMO' : null,
        systemTelemetrySize: systemPanelRect ? { width: systemPanelRect.width, height: systemPanelRect.height } : null,
        composerHiddenBeforeOpen: ${JSON.stringify(composerBehaviorChecks.hiddenBefore)} && composerHiddenBeforeOpen,
        composerAutoOpenOnHover: ${JSON.stringify(composerBehaviorChecks.autoOpen)},
        composerEmptyHiddenAfterLeave: ${JSON.stringify(composerBehaviorChecks.emptyHiddenAfterLeave)},
        composerDraftStaysOpenAfterLeave: ${JSON.stringify(composerBehaviorChecks.draftStaysOpenAfterLeave)},
        composerManualCollapseKeepsDraft: ${JSON.stringify(composerBehaviorChecks.manualCollapseKeepsDraft)},
        composerCollapseButtonPresent: ${JSON.stringify(composerBehaviorChecks.collapseButtonPresent)},
        composerCoreRippleActiveAfterOpen: ${JSON.stringify(composerBehaviorChecks.coreRippleActiveAfterOpen)},
        composerCoreRippleSettledAfterDecay: ${JSON.stringify(composerBehaviorChecks.coreRippleSettledAfterDecay)},
        composerEdgeWavePresent: ${JSON.stringify(composerBehaviorChecks.edgeWavePresent)},
        composerImpactLayerPresent: ${JSON.stringify(composerBehaviorChecks.impactLayerPresent)},
        composerSourceRipplePresent: ${JSON.stringify(composerBehaviorChecks.sourceRipplePresent)},
        composerVisualImpactEvidence: ${JSON.stringify(composerBehaviorChecks.visualImpactEvidence)},
        composerOpenAfterClick,
        autoWorkbenchOpenAfterSend,
        autoWorkbenchRenderedReply,
        typewriterPartialBeforeCompletion,
        markdownHeadingRendered,
        markdownTableRendered,
        markdownCodeRendered,
        markdownLinkRendered,
        choiceButtons,
        choiceFilledDraft,
        choiceOpenedComposer,
        composerZoneSize: composerZoneRect ? { width: composerZoneRect.width, height: composerZoneRect.height } : null,
        particleCoreWrappedShell: particleCore?.getAttribute('data-core-shell') === 'wrapped',
        canvasPresent: Boolean(canvas),
        canvasSize: canvas ? { width: canvas.width, height: canvas.height, clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight } : null
      };
    })()
  `)
  checks.canvasPixelEvidence = initialCanvasPixelEvidence

  assert(checks.title === 'ArcMind', 'ArcMind title is missing.')
  assert(checks.inputPresent, 'Composer input is missing.')
  assert(checks.arcMindBridgePresent, 'ArcMind preload bridge is missing.')
  assert(checks.realtimeVoiceBridgePresent, 'Realtime voice preload bridge is missing.')
  assert(checks.coreDragStarted, 'Particle core did not enter drag interaction state.')
  assert(checks.drawerHiddenBeforeOpen, 'Conversation drawer should be hidden before interaction.')
  assert(checks.drawerOpenAfterClick, 'Conversation drawer did not open from the edge hotspot.')
  assert(checks.conversationHotspotEmpty, 'Conversation drawer hotspot should not show a history icon.')
  assert(checks.conversationZoneSize?.width <= 70 && checks.conversationZoneSize?.height <= 80, 'Conversation trigger zone is too large.')
  assert(checks.toolRailHiddenBeforeOpen, 'Tool rail should be hidden before interaction.')
  assert(checks.toolRailOpenAfterClick, 'Tool rail did not open from the edge hotspot.')
  assert(checks.toolRailIconOnly, 'Tool rail should use icon-only buttons.')
  assert(checks.toolZoneSize?.width <= 70 && checks.toolZoneSize?.height <= 70, 'Tool rail trigger zone is too large.')
  assert(checks.settingsButtonPresent, 'Settings button is missing.')
  assert(checks.settingsPanelPresent, 'Settings panel did not open.')
  assert(checks.settingsPanelFitsViewport, 'Settings panel overflows the viewport without a scroll boundary.')
  assert(checks.realtimeVoiceDeclarationPresent, 'Realtime voice codex-LB limitation is missing.')
  assert(checks.realtimeVoiceDisabledBeforeProbe, 'Realtime voice should be disabled before capability detection.')
  assert(checks.settingsBottomContentReachable, 'Realtime voice controls cannot be reached by scrolling.')
  assert(checks.memoryButtonPresent, 'Memory button is missing.')
  assert(checks.responseButtonPresent, 'Response/workbench button is missing.')
  assert(checks.workbenchOpenAfterClick, 'Workbench did not open from the response button.')
  assert(checks.systemTelemetryPresentBeforePanels, 'System telemetry projection is missing from the main UI.')
  assert(checks.systemTelemetryTiny, `System telemetry projection is too large. ${JSON.stringify(checks.systemTelemetrySize)}`)
  assert(checks.systemTelemetryTransparent, 'System telemetry projection should be transparent and must not use frosted blur.')
  assert(checks.systemTelemetryProjectionVisible, 'System telemetry projection should be visible before side panels open.')
  assert(checks.systemTelemetryHiddenWhenWorkbenchOpen, 'System telemetry projection should hide when the workbench opens.')
  assert(checks.systemTelemetryRows === 4, 'System telemetry projection should render CPU/RAM/Disk/GPU rows.')
  assert(checks.systemTelemetrySource === 'LIVE', 'Main UI system telemetry should use live IPC data, not demo fallback.')
  assert(checks.composerHiddenBeforeOpen, 'Composer should be hidden before interaction.')
  assert(checks.composerAutoOpenOnHover, 'Composer did not auto-open from the bottom hover/focus zone.')
  assert(checks.composerEmptyHiddenAfterLeave, 'Composer did not hide immediately after leaving with an empty draft.')
  assert(checks.composerDraftStaysOpenAfterLeave, 'Composer should stay open after leaving when a draft exists.')
  assert(checks.composerManualCollapseKeepsDraft, 'Composer manual collapse did not preserve the draft text.')
  assert(checks.composerCollapseButtonPresent, 'Composer collapse arrow button is missing.')
  assert(checks.composerCoreRippleActiveAfterOpen, 'Composer did not trigger the ParticleCore ripple impulse.')
  assert(checks.composerCoreRippleSettledAfterDecay, 'Composer ParticleCore ripple impulse did not settle after opening.')
  assert(checks.composerEdgeWavePresent, 'Composer top-edge wave animation is missing.')
  assert(checks.composerImpactLayerPresent, 'Composer impact edge/spark layer is missing.')
  assert(checks.composerSourceRipplePresent, 'Composer source ripple perspective layer is missing.')
  assert(
    checks.composerVisualImpactEvidence?.impactEdgeStyleWidth >= 600 &&
      checks.composerVisualImpactEvidence?.sourceRippleStyleWidth >= 600 &&
      checks.composerVisualImpactEvidence?.impactEdgeDuration >= 0.85 &&
      checks.composerVisualImpactEvidence?.sourceRippleDuration >= 1.1 &&
      checks.composerVisualImpactEvidence?.impactEdgeGlowPresent,
    `Composer ripple visual impact is too weak. ${JSON.stringify(checks.composerVisualImpactEvidence)}`
  )
  assert(checks.composerOpenAfterClick, 'Composer did not open from the bottom handle.')
  assert(checks.autoWorkbenchOpenAfterSend, 'Workbench did not auto-open after sending a message.')
  assert(checks.autoWorkbenchRenderedReply, 'Workbench did not render the streamed reply.')
  assert(checks.typewriterPartialBeforeCompletion, 'Workbench did not reveal a large stream delta through the typewriter queue.')
  assert(checks.markdownHeadingRendered, 'Workbench did not render the Markdown heading.')
  assert(checks.markdownTableRendered, 'Workbench did not render the Markdown table.')
  assert(checks.markdownCodeRendered, 'Workbench did not render the Markdown code block.')
  assert(checks.markdownLinkRendered, 'Workbench did not render the Markdown link.')
  assert(checks.choiceButtons?.length === 2 && checks.choiceButtons[0] === '快速原型', 'Workbench did not render choices as buttons.')
  assert(checks.choiceFilledDraft, 'Choice button did not write its value into the composer draft.')
  assert(checks.choiceOpenedComposer, 'Choice button did not reopen the composer.')
  assert(checks.composerZoneSize?.width <= 150 && checks.composerZoneSize?.height <= 40, 'Composer trigger zone is too large.')
  assert(checks.particleCoreWrappedShell, 'ParticleCore should expose the wrapped shell visual mode.')
  assert(checks.canvasPresent, 'Particle canvas is missing.')
  assert(
    checks.canvasSize?.clientWidth >= Math.min(900, smokeWidth - 40) &&
      checks.canvasSize?.clientHeight >= Math.min(600, smokeHeight - 80),
    'Particle canvas has an unexpected size.'
  )
  assert(checks.canvasPixelEvidence.brightPixels > 6, 'Particle canvas appears blank.')

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
  ipcMain.handle('system:get-telemetry-snapshot', () => ({
    capturedAt: new Date(0).toISOString(),
    cpu: {
      usagePct: 38,
      cores: 12,
      status: 'ok'
    },
    memory: {
      usedBytes: 16 * 1024 ** 3,
      totalBytes: 32 * 1024 ** 3,
      usagePct: 50,
      status: 'ok'
    },
    disk: {
      usedBytes: 420 * 1024 ** 3,
      totalBytes: 960 * 1024 ** 3,
      usagePct: 44,
      status: 'ok'
    },
    gpu: {
      name: 'Smoke GPU',
      usagePct: null,
      featureStatus: 'enabled',
      status: 'ok'
    }
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
  ipcMain.handle('chat:send-message', (event, input) => {
    const channel = `chat:stream:${input.requestId}`
    const content = [
      ':::report',
      '# Smoke response',
      '',
      '| 项目 | 结论 |',
      '| --- | --- |',
      '| Markdown | 已渲染 |',
      '',
      '```ts',
      'const visible = true',
      '```',
      '',
      '[Smoke link](https://example.com)',
      ':::',
      '',
      ':::choices',
      '[fast] 快速原型 | 选择快速原型路线',
      '[careful] 稳妥验证 | 选择稳妥验证路线',
      ':::'
    ].join('\n')
    setTimeout(() => {
      event.sender.send(channel, { type: 'token', requestId: input.requestId, delta: content })
    }, 40)
    setTimeout(() => {
      event.sender.send(channel, {
        type: 'done',
        requestId: input.requestId,
        message: {
          id: input.requestId,
          role: 'assistant',
          content,
          createdAt: new Date(0).toISOString()
        }
      })
    }, 80)
    return { requestId: input.requestId }
  })
  ipcMain.handle('chat:cancel-message', () => undefined)
  ipcMain.handle('storage:get-most-recent-conversation', () => null)
  ipcMain.handle('storage:list-conversations', () => [])
  ipcMain.handle('storage:list-memories', () => [])
}

async function verifyComposerBehavior(window) {
  const before = await window.webContents.executeJavaScript(`
    (() => {
      const composer = document.querySelector('.composer');
      const zone = document.querySelector('.composer-zone')?.getBoundingClientRect();
      return {
        hidden: composer ? getComputedStyle(composer).opacity === '0' : false,
        zone: zone ? { x: Math.round(zone.left + zone.width / 2), y: Math.round(zone.top + zone.height / 2) } : null
      };
    })()
  `)

  if (!before.zone) {
    return {
      hiddenBefore: false,
      autoOpen: false,
      emptyHiddenAfterLeave: false,
      draftStaysOpenAfterLeave: false,
      manualCollapseKeepsDraft: false,
      collapseButtonPresent: false,
      coreRippleActiveAfterOpen: false,
      coreRippleSettledAfterDecay: false,
      edgeWavePresent: false,
      impactLayerPresent: false,
      sourceRipplePresent: false,
      visualImpactEvidence: { brightPixelDelta: 0, maxBrightnessDelta: 0 }
    }
  }

  const beforeVisualImpact = await sampleComposerWaveRegion(window)
  window.webContents.sendInputEvent({ type: 'mouseMove', x: 640, y: 360 })
  await new Promise((resolve) => setTimeout(resolve, 80))
  window.webContents.sendInputEvent({ type: 'mouseMove', x: before.zone.x, y: before.zone.y, movementX: before.zone.x - 640, movementY: before.zone.y - 360 })
  await new Promise((resolve) => setTimeout(resolve, 80))
  window.webContents.sendInputEvent({ type: 'mouseMove', x: before.zone.x + 1, y: before.zone.y, movementX: 1, movementY: 0 })
  await window.webContents.executeJavaScript(`
    (() => {
      const x = ${JSON.stringify(before.zone.x)};
      const y = ${JSON.stringify(before.zone.y)};
      const target = document.elementFromPoint(x, y);
      if (!target) return false;
      if (typeof PointerEvent === 'function') {
        target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y }));
      }
      target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }));
      return true;
    })()
  `)
  await waitForComposerOpen(window)
  await new Promise((resolve) => setTimeout(resolve, 520))
  const afterVisualImpact = await sampleComposerWaveRegion(window)
  const opened = await window.webContents.executeJavaScript(`
    (() => {
      const composer = document.querySelector('.composer');
      const particleCore = document.querySelector('.particle-core');
      const impactEdge = document.querySelector('.impact-edge');
      const sourceRipple = document.querySelector('.composer-source-ripple span');
      const edgeWaveAnimation = composer ? getComputedStyle(composer, '::after').animationName : '';
      const impactEdgeStyle = getComputedStyle(impactEdge ?? document.body);
      const sourceRippleStyle = getComputedStyle(sourceRipple ?? document.body);
      const impactEdgeRect = impactEdge?.getBoundingClientRect();
      return {
        autoOpen: composer ? composer.classList.contains('is-open') && getComputedStyle(composer).pointerEvents === 'auto' : false,
        collapseButtonPresent: Boolean(document.querySelector('.composer-collapse-button')),
        coreRippleActiveAfterOpen: Boolean(particleCore?.classList.contains('is-composer-ripple-active')),
        edgeWavePresent: edgeWaveAnimation.includes('composer-edge-wave'),
        impactLayerPresent: impactEdgeStyle.animationName.includes('composer-impact-edge') && document.querySelectorAll('.impact-spark').length === 3,
        sourceRipplePresent: sourceRippleStyle.animationName.includes('composer-source-ring') && document.querySelectorAll('.composer-source-ripple span').length === 3,
        impactEdgeOpacity: Number.parseFloat(impactEdgeStyle.opacity) || 0,
        sourceRippleOpacity: Number.parseFloat(sourceRippleStyle.opacity) || 0,
        impactEdgeWidth: impactEdgeRect?.width ?? 0,
        impactEdgeStyleWidth: Number.parseFloat(impactEdgeStyle.width) || 0,
        sourceRippleStyleWidth: Number.parseFloat(sourceRippleStyle.width) || 0,
        impactEdgeDuration: Number.parseFloat(impactEdgeStyle.animationDuration) || 0,
        sourceRippleDuration: Number.parseFloat(sourceRippleStyle.animationDuration) || 0,
        impactEdgeGlowPresent: impactEdgeStyle.boxShadow.includes('46px') && impactEdgeStyle.boxShadow.includes('18px')
      };
    })()
  `)

  window.webContents.sendInputEvent({ type: 'mouseMove', x: 640, y: 360 })
  await window.webContents.executeJavaScript(`
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 640, clientY: 360 }))
  `)
  await new Promise((resolve) => setTimeout(resolve, 360))
  const emptyHiddenAfterLeave = await window.webContents.executeJavaScript(`
    (() => {
      const composer = document.querySelector('.composer');
      return composer ? !composer.classList.contains('is-open') && getComputedStyle(composer).pointerEvents === 'none' : false;
    })()
  `)

  await window.webContents.executeJavaScript(`
    (() => {
      document.querySelector('.composer-handle')?.click();
      const input = document.querySelector('input[aria-label="输入消息"]');
      if (input) {
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        valueSetter?.call(input, '保留的草稿');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()
  `)
  await new Promise((resolve) => setTimeout(resolve, 260))
  window.webContents.sendInputEvent({ type: 'mouseMove', x: 640, y: 360 })
  await window.webContents.executeJavaScript(`
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 640, clientY: 360 }))
  `)
  await new Promise((resolve) => setTimeout(resolve, 420))
  const draftStaysOpenAfterLeave = await window.webContents.executeJavaScript(`
    (() => {
      const composer = document.querySelector('.composer');
      const input = document.querySelector('input[aria-label="输入消息"]');
      return Boolean(composer?.classList.contains('is-open') && input?.value === '保留的草稿');
    })()
  `)

  const manualCollapseKeepsDraft = await window.webContents.executeJavaScript(`
    (async () => {
      document.querySelector('.composer-collapse-button')?.click();
      await new Promise((resolve) => setTimeout(resolve, 260));
      const composer = document.querySelector('.composer');
      const input = document.querySelector('input[aria-label="输入消息"]');
      return Boolean(!composer?.classList.contains('is-open') && input?.value === '保留的草稿');
    })()
  `)

  await new Promise((resolve) => setTimeout(resolve, 1050))
  const coreRippleSettledAfterDecay = await window.webContents.executeJavaScript(`
    (() => {
      const particleCore = document.querySelector('.particle-core');
      return Boolean(particleCore && !particleCore.classList.contains('is-composer-ripple-active'));
    })()
  `)

  return {
    hiddenBefore: Boolean(before.hidden),
    autoOpen: Boolean(opened.autoOpen),
    emptyHiddenAfterLeave: Boolean(emptyHiddenAfterLeave),
    draftStaysOpenAfterLeave: Boolean(draftStaysOpenAfterLeave),
    manualCollapseKeepsDraft: Boolean(manualCollapseKeepsDraft),
    collapseButtonPresent: Boolean(opened.collapseButtonPresent),
    coreRippleActiveAfterOpen: Boolean(opened.coreRippleActiveAfterOpen),
    coreRippleSettledAfterDecay: Boolean(coreRippleSettledAfterDecay),
    edgeWavePresent: Boolean(opened.edgeWavePresent),
    impactLayerPresent: Boolean(opened.impactLayerPresent),
    sourceRipplePresent: Boolean(opened.sourceRipplePresent),
    visualImpactEvidence: {
      brightPixelDelta: afterVisualImpact.brightPixels - beforeVisualImpact.brightPixels,
      maxBrightnessDelta: afterVisualImpact.maxBrightness - beforeVisualImpact.maxBrightness,
      impactEdgeOpacity: opened.impactEdgeOpacity,
      sourceRippleOpacity: opened.sourceRippleOpacity,
      impactEdgeWidth: opened.impactEdgeWidth,
      impactEdgeStyleWidth: opened.impactEdgeStyleWidth,
      sourceRippleStyleWidth: opened.sourceRippleStyleWidth,
      impactEdgeDuration: opened.impactEdgeDuration,
      sourceRippleDuration: opened.sourceRippleDuration,
      impactEdgeGlowPresent: opened.impactEdgeGlowPresent,
      before: beforeVisualImpact,
      after: afterVisualImpact
    }
  }
}

async function sampleComposerWaveRegion(window) {
  const captureBounds = await window.webContents.executeJavaScript(`
    (() => {
      const width = Math.max(1, Math.min(780, window.innerWidth - 72));
      const impact = document.querySelector('.composer-impact');
      const impactBottom = impact ? Number.parseFloat(getComputedStyle(impact).bottom) || 80 : 80;
      return {
        x: Math.max(0, Math.round((window.innerWidth - width) / 2)),
        y: Math.max(0, Math.round(window.innerHeight - impactBottom - 74)),
        width,
        height: Math.max(1, Math.min(136, window.innerHeight))
      };
    })()
  `)
  return sampleCapturedBounds(window, captureBounds)
}

async function waitForComposerOpen(window) {
  const started = Date.now()
  while (Date.now() - started < 1500) {
    const open = await window.webContents.executeJavaScript(`
      Boolean(document.querySelector('.composer')?.classList.contains('is-open'))
    `)
    if (open) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 40))
  }
}

async function sampleCapturedCanvas(window) {
  const rect = await window.webContents.executeJavaScript(`
    (() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      };
    })()
  `)

  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return { brightPixels: 0, sampledPixels: 0, maxBrightness: 0 }
  }

  await new Promise((resolve) => setTimeout(resolve, 180))
  const captureBounds = {
    x: Math.max(0, Math.floor(rect.left + rect.width * 0.22)),
    y: Math.max(0, Math.floor(rect.top + rect.height * 0.2)),
    width: Math.max(1, Math.floor(rect.width * 0.5)),
    height: Math.max(1, Math.floor(rect.height * 0.56))
  }
  return sampleCapturedBounds(window, captureBounds)
}

async function sampleCapturedBounds(window, captureBounds) {
  const image = await window.webContents.capturePage(captureBounds)
  const sample = image.resize({ width: 96, height: 72, quality: 'best' })
  const { width, height } = sample.getSize()
  const bitmap = sample.toBitmap()
  let brightPixels = 0
  let maxBrightness = 0

  for (let index = 0; index < bitmap.length; index += 4) {
    const brightness = bitmap[index] + bitmap[index + 1] + bitmap[index + 2]
    maxBrightness = Math.max(maxBrightness, brightness)
    if (brightness > 55) {
      brightPixels += 1
    }
  }

  return {
    brightPixels,
    sampledPixels: width * height,
    maxBrightness
  }
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
