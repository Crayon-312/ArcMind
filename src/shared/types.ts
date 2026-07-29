export type ChatRole = 'system' | 'user' | 'assistant'

export type CoreMode = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'muted' | 'error'

export type ConversationStatus = 'idle' | 'streaming' | 'cancelled' | 'error'

export type ModelProvider = 'openai-compatible'

export type RealtimeVoiceProvider = 'codex-lb-live'

export type RealtimeVoiceCapabilityStatus =
  | 'not_configured'
  | 'available'
  | 'unsupported'
  | 'auth_failed'
  | 'network_failed'

export type AppErrorCode =
  | 'unknown'
  | 'validation_failed'
  | 'network_failed'
  | 'auth_failed'
  | 'rate_limited'
  | 'timeout'
  | 'cancelled'
  | 'microphone_unavailable'
  | 'storage_failed'

export interface AppError {
  code: AppErrorCode
  message: string
  recoverable: boolean
  details?: Record<string, string | number | boolean | null>
}

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: string
  error?: AppError
}

export interface ConversationState {
  id: string
  title: string
  messages: ChatMessage[]
  status: ConversationStatus
  activeRequestId: string | null
  updatedAt: string
}

export interface ConversationSummary {
  id: string
  title: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

export interface RuntimeInfo {
  version: string
  electron: string
  chrome: string
  platform: string
  arch: string
  packaged: boolean
}

export type SystemMetricStatus = 'ok' | 'busy' | 'critical' | 'unknown'

export interface SystemPercentMetric {
  usagePct: number | null
  status: SystemMetricStatus
}

export interface SystemCpuMetric extends SystemPercentMetric {
  cores: number
}

export interface SystemMemoryMetric extends SystemPercentMetric {
  usedBytes: number
  totalBytes: number
}

export interface SystemDiskMetric extends SystemPercentMetric {
  usedBytes: number | null
  totalBytes: number | null
}

export interface SystemGpuMetric extends SystemPercentMetric {
  name: string
  featureStatus: string
}

export interface SystemTelemetrySnapshot {
  capturedAt: string
  cpu: SystemCpuMetric
  memory: SystemMemoryMetric
  disk: SystemDiskMetric
  gpu: SystemGpuMetric
}

export interface AudioSignal {
  level: number
  low: number
  mid: number
  high: number
  rhythm: number
}

export interface VisualSignal {
  audio: AudioSignal
  tokenPulse: number
  errorPulse: number
  thinkingLevel: number
  speakingLevel: number
}

export interface LongTermMemory {
  id: string
  content: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateMemoryInput {
  content: string
}

export interface UpdateMemoryInput {
  id: string
  content: string
}

export interface SetMemoryEnabledInput {
  id: string
  enabled: boolean
}

export interface CreateConversationInput {
  title?: string
}

export interface RenameConversationInput {
  id: string
  title: string
}

export interface ModelConfig {
  provider: ModelProvider
  baseUrl: string
  model: string
  apiKey: string
  temperature: number
  maxContextMessages: number
  timeoutMs: number
}

export type PublicModelConfig = Omit<ModelConfig, 'apiKey'> & {
  hasApiKey: boolean
}

export interface RealtimeVoiceConfig {
  provider: RealtimeVoiceProvider
  enabled: boolean
  baseUrl: string
  apiKey: string
}

export type PublicRealtimeVoiceConfig = Omit<RealtimeVoiceConfig, 'apiKey'> & {
  hasApiKey: boolean
}

export interface RealtimeVoiceCapabilityResult {
  ok: boolean
  status: RealtimeVoiceCapabilityStatus
  message: string
  checkedAt: string
}

export interface SendChatMessageInput {
  requestId: string
  conversationId: string
  messages: ChatMessage[]
}

export interface SendChatMessageResult {
  requestId: string
}

export interface ModelConfigTestResult {
  ok: boolean
  error?: AppError
}

export interface TranscribeAudioInput {
  audio: ArrayBuffer
  mimeType: string
  fileName?: string
}

export interface TranscribeAudioResult {
  text: string
}

export interface SpeakTextInput {
  text: string
  voice?: string
}

export type AiStreamEvent =
  | {
      type: 'metadata'
      requestId: string
      model?: string
      conversationId?: string
    }
  | {
      type: 'token'
      requestId: string
      delta: string
    }
  | {
      type: 'done'
      requestId: string
      message: ChatMessage
    }
  | {
      type: 'cancelled'
      requestId: string
      reason?: string
    }
  | {
      type: 'error'
      requestId: string
      error: AppError
    }
