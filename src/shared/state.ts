import type { ChatMessage, ConversationState, CoreMode, RealtimeVoiceSessionStatus } from './types'

export interface CoreModeInput {
  conversationStatus: ConversationState['status']
  microphoneStatus: 'idle' | 'requesting' | 'listening' | 'denied' | 'error'
  muted: boolean
  lastMessage?: Pick<ChatMessage, 'role'> | null
  transcribing?: boolean
  speaking?: boolean
  realtimeVoiceStatus?: RealtimeVoiceSessionStatus
}

export function deriveCoreMode(input: CoreModeInput): CoreMode {
  if (input.realtimeVoiceStatus) {
    return input.realtimeVoiceStatus
  }

  if (input.microphoneStatus === 'error' || input.microphoneStatus === 'denied' || input.conversationStatus === 'error') {
    return 'error'
  }

  if (input.transcribing) {
    return 'transcribing'
  }

  if (input.conversationStatus === 'streaming') {
    return 'thinking'
  }

  if (input.microphoneStatus === 'listening' || input.microphoneStatus === 'requesting') {
    return 'listening'
  }

  if (input.muted) {
    return 'muted'
  }

  if (input.speaking || input.lastMessage?.role === 'assistant') {
    return 'speaking'
  }

  return 'idle'
}

