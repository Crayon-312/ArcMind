import { contextBridge, ipcRenderer } from 'electron'
import type {
  AiStreamEvent,
  CreateMemoryInput,
  ConversationState,
  ConversationSummary,
  LongTermMemory,
  ModelConfig,
  ModelConfigTestResult,
  PublicModelConfig,
  PublicRealtimeVoiceConfig,
  RealtimeVoiceCapabilityResult,
  RealtimeVoiceConfig,
  RuntimeInfo,
  SendChatMessageInput,
  SendChatMessageResult,
  SetMemoryEnabledInput,
  SpeakTextInput,
  SystemTelemetrySnapshot,
  TranscribeAudioInput,
  TranscribeAudioResult,
  UpdateMemoryInput
} from '../shared'

const api = {
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),
  getRuntimeInfo: (): Promise<RuntimeInfo> => ipcRenderer.invoke('app:get-runtime-info'),
  chat: {
    sendMessage: (input: SendChatMessageInput): Promise<SendChatMessageResult> => ipcRenderer.invoke('chat:send-message', input),
    cancel: (requestId: string): Promise<void> => ipcRenderer.invoke('chat:cancel-message', requestId),
    onStream: (requestId: string, callback: (event: AiStreamEvent) => void): (() => void) => {
      const channel = `chat:stream:${requestId}`
      const listener = (_event: Electron.IpcRendererEvent, event: AiStreamEvent): void => callback(event)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    }
  },
  system: {
    getTelemetrySnapshot: (): Promise<SystemTelemetrySnapshot> => ipcRenderer.invoke('system:get-telemetry-snapshot')
  },
  settings: {
    getModelConfig: (): Promise<PublicModelConfig> => ipcRenderer.invoke('settings:get-model-config'),
    setModelConfig: (input: Partial<ModelConfig>): Promise<PublicModelConfig> => ipcRenderer.invoke('settings:set-model-config', input),
    testModelConfig: (input?: Partial<ModelConfig>): Promise<ModelConfigTestResult> => ipcRenderer.invoke('settings:test-model-config', input),
    getRealtimeVoiceConfig: (): Promise<PublicRealtimeVoiceConfig> => ipcRenderer.invoke('settings:get-realtime-voice-config'),
    setRealtimeVoiceConfig: (input: Partial<RealtimeVoiceConfig>): Promise<PublicRealtimeVoiceConfig> =>
      ipcRenderer.invoke('settings:set-realtime-voice-config', input),
    testRealtimeVoiceConfig: (input?: Partial<RealtimeVoiceConfig>): Promise<RealtimeVoiceCapabilityResult> =>
      ipcRenderer.invoke('settings:test-realtime-voice-config', input)
  },
  storage: {
    listConversations: (): Promise<ConversationSummary[]> => ipcRenderer.invoke('storage:list-conversations'),
    getConversation: (id: string): Promise<ConversationState | null> => ipcRenderer.invoke('storage:get-conversation', id),
    getMostRecentConversation: (): Promise<ConversationState> => ipcRenderer.invoke('storage:get-most-recent-conversation'),
    createConversation: (title?: string): Promise<ConversationState> => ipcRenderer.invoke('storage:create-conversation', title),
    renameConversation: (id: string, title: string): Promise<ConversationState | null> => ipcRenderer.invoke('storage:rename-conversation', id, title),
    deleteConversation: (id: string): Promise<void> => ipcRenderer.invoke('storage:delete-conversation', id),
    clearConversation: (id: string): Promise<ConversationState | null> => ipcRenderer.invoke('storage:clear-conversation', id),
    listMemories: (): Promise<LongTermMemory[]> => ipcRenderer.invoke('storage:list-memories'),
    createMemory: (input: CreateMemoryInput): Promise<LongTermMemory> => ipcRenderer.invoke('storage:create-memory', input),
    updateMemory: (input: UpdateMemoryInput): Promise<LongTermMemory | null> => ipcRenderer.invoke('storage:update-memory', input),
    setMemoryEnabled: (input: SetMemoryEnabledInput): Promise<LongTermMemory | null> => ipcRenderer.invoke('storage:set-memory-enabled', input),
    deleteMemory: (id: string): Promise<void> => ipcRenderer.invoke('storage:delete-memory', id)
  },
  voice: {
    transcribe: (input: TranscribeAudioInput): Promise<TranscribeAudioResult> => ipcRenderer.invoke('voice:transcribe', input),
    speak: (input: SpeakTextInput): Promise<void> => Promise.resolve(),
    stopSpeaking: (): Promise<void> => Promise.resolve()
  }
}

contextBridge.exposeInMainWorld('arcMind', api)

export type ArcMindApi = typeof api
