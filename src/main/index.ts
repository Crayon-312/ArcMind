import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import type {
  CreateMemoryInput,
  ModelConfig,
  RealtimeVoiceConfig,
  SendChatMessageInput,
  SetMemoryEnabledInput,
  TranscribeAudioInput,
  UpdateMemoryInput
} from '../shared'
import { ChatRuntime, validateChatMessages } from './ai/chatRuntime'
import { normalizeAiError } from './ai/errors'
import { AppLogger } from './logging/appLogger'
import { ModelConfigStore } from './settings/modelConfigStore'
import { RealtimeVoiceConfigStore } from './settings/realtimeVoiceConfigStore'
import { saveRealtimeVoiceConfig } from './settings/realtimeVoiceSettings'
import { ConversationRepository } from './storage/conversationRepository'
import { getSystemTelemetrySnapshot } from './system/systemTelemetry'
import { transcribeOpenAiCompatibleAudio } from './voice/asrRuntime'
import { probeRealtimeVoiceCapability } from './voice/realtimeVoiceCapability'

const chatRuntime = new ChatRuntime()
let modelConfigStore: ModelConfigStore | null = null
let realtimeVoiceConfigStore: RealtimeVoiceConfigStore | null = null
let conversationRepository: ConversationRepository | null = null
let logger: AppLogger | null = null
const rendererRecoveryCounts = new WeakMap<BrowserWindow, number>()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#030607',
    title: 'ArcMind',
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    logger?.info('window.ready', {
      version: app.getVersion(),
      packaged: app.isPackaged
    })
    mainWindow.show()
  })

  mainWindow.webContents.on('render-process-gone', (_, details) => {
    logger?.error('renderer.process.gone', new Error(details.reason), {
      exitCode: details.exitCode,
      reason: details.reason
    })
    const recoveries = rendererRecoveryCounts.get(mainWindow) ?? 0
    if (!mainWindow.isDestroyed() && recoveries < 1) {
      rendererRecoveryCounts.set(mainWindow, recoveries + 1)
      mainWindow.reload()
      return
    }
    logger?.warn('renderer.recovery.skipped', 'Renderer recovery limit reached.')
  })

  mainWindow.webContents.on('unresponsive', () => {
    logger?.warn('window.unresponsive', 'Renderer became unresponsive.')
  })

  mainWindow.webContents.on('responsive', () => {
    logger?.info('window.responsive')
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.arcmind.desktop')
  logger = new AppLogger(app.getPath('userData'))
  logger.info('app.start', {
    version: app.getVersion(),
    electron: process.versions.electron,
    platform: process.platform,
    arch: process.arch,
    packaged: app.isPackaged
  })
  registerProcessGuards()
  modelConfigStore = new ModelConfigStore(app.getPath('userData'))
  realtimeVoiceConfigStore = new RealtimeVoiceConfigStore(app.getPath('userData'))
  conversationRepository = new ConversationRepository(app.getPath('userData'))
  await conversationRepository.initialize()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('app:get-runtime-info', () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    platform: process.platform,
    arch: process.arch,
    packaged: app.isPackaged
  }))
  ipcMain.handle('system:get-telemetry-snapshot', async () => {
    const gpuInfo = await app.getGPUInfo('basic').catch(() => null)
    return getSystemTelemetrySnapshot({
      diskPath: app.getPath('home'),
      gpuInfo,
      gpuFeatureStatus: app.getGPUFeatureStatus() as unknown as Record<string, string>
    })
  })
  ipcMain.handle('settings:get-model-config', async () => {
    return modelConfigStore?.getPublic()
  })
  ipcMain.handle('settings:set-model-config', async (_, input: Partial<ModelConfig>) => {
    return modelConfigStore?.set(input)
  })
  ipcMain.handle('settings:test-model-config', async (_, input?: Partial<ModelConfig>) => {
    try {
      const config = input ? await requireModelConfigStore().preview(input) : await requireModelConfigStore().get()
      await chatRuntime.testConnection(config)
      return { ok: true }
    } catch (error) {
      return { ok: false, error: normalizeAiError(error) }
    }
  })
  ipcMain.handle('settings:get-realtime-voice-config', async () => {
    return requireRealtimeVoiceConfigStore().getPublic()
  })
  ipcMain.handle('settings:set-realtime-voice-config', async (_, input: Partial<RealtimeVoiceConfig>) => {
    try {
      return await saveRealtimeVoiceConfig(requireRealtimeVoiceConfigStore(), input)
    } catch (error) {
      return Promise.reject(normalizeAiError(error))
    }
  })
  ipcMain.handle('settings:test-realtime-voice-config', async (_, input?: Partial<RealtimeVoiceConfig>) => {
    const config = input
      ? await requireRealtimeVoiceConfigStore().preview(input)
      : await requireRealtimeVoiceConfigStore().get()
    return probeRealtimeVoiceCapability(config)
  })
  ipcMain.handle('chat:send-message', async (event, input: SendChatMessageInput) => {
    try {
      validateChatMessages(input.messages)
      const config = await requireModelConfigStore().get()
      chatRuntime.validateConfig(config)
      const memories = await requireConversationRepository().listEnabledMemories()
      await requireConversationRepository().saveConversationMessages(input.conversationId, input.messages)
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window) {
        throw new Error('Window is unavailable.')
      }
      chatRuntime.send({
        requestId: input.requestId,
        messages: input.messages,
        memories,
        config,
        window,
        conversationId: input.conversationId,
        onDone: async (message) => {
          await requireConversationRepository().appendMessage(input.conversationId, message)
        }
      })
      return { requestId: input.requestId }
    } catch (error) {
      return Promise.reject(normalizeAiError(error))
    }
  })
  ipcMain.handle('chat:cancel-message', (_, requestId: string) => {
    chatRuntime.cancel(requestId)
  })
  ipcMain.handle('storage:list-conversations', async () => {
    return requireConversationRepository().listConversations()
  })
  ipcMain.handle('storage:get-conversation', async (_, id: string) => {
    return requireConversationRepository().getConversation(id)
  })
  ipcMain.handle('storage:get-most-recent-conversation', async () => {
    return requireConversationRepository().getMostRecentConversation()
  })
  ipcMain.handle('storage:create-conversation', async (_, title?: string) => {
    return requireConversationRepository().createConversation(title)
  })
  ipcMain.handle('storage:rename-conversation', async (_, id: string, title: string) => {
    return requireConversationRepository().renameConversation(id, title)
  })
  ipcMain.handle('storage:delete-conversation', async (_, id: string) => {
    await requireConversationRepository().deleteConversation(id)
  })
  ipcMain.handle('storage:clear-conversation', async (_, id: string) => {
    return requireConversationRepository().clearConversation(id)
  })
  ipcMain.handle('storage:list-memories', async () => {
    return requireConversationRepository().listMemories()
  })
  ipcMain.handle('storage:create-memory', async (_, input: CreateMemoryInput) => {
    return requireConversationRepository().createMemory(input.content)
  })
  ipcMain.handle('storage:update-memory', async (_, input: UpdateMemoryInput) => {
    return requireConversationRepository().updateMemory(input.id, input.content)
  })
  ipcMain.handle('storage:set-memory-enabled', async (_, input: SetMemoryEnabledInput) => {
    return requireConversationRepository().setMemoryEnabled(input.id, input.enabled)
  })
  ipcMain.handle('storage:delete-memory', async (_, id: string) => {
    await requireConversationRepository().deleteMemory(id)
  })
  ipcMain.handle('voice:transcribe', async (_, input: TranscribeAudioInput) => {
    try {
      return await transcribeOpenAiCompatibleAudio(await requireModelConfigStore().get(), input)
    } catch (error) {
      return Promise.reject(normalizeAiError(error))
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  logger?.info('app.before-quit')
  void conversationRepository?.close()
})

function registerProcessGuards(): void {
  process.on('uncaughtException', (error) => {
    logger?.error('process.uncaught-exception', error)
  })

  process.on('unhandledRejection', (reason) => {
    logger?.error('process.unhandled-rejection', reason)
  })
}

function requireModelConfigStore(): ModelConfigStore {
  if (!modelConfigStore) {
    throw new Error('Model config store is not ready.')
  }
  return modelConfigStore
}

function requireRealtimeVoiceConfigStore(): RealtimeVoiceConfigStore {
  if (!realtimeVoiceConfigStore) {
    throw new Error('Realtime voice config store is not ready.')
  }
  return realtimeVoiceConfigStore
}

function requireConversationRepository(): ConversationRepository {
  if (!conversationRepository) {
    throw new Error('Conversation repository is not ready.')
  }
  return conversationRepository
}
