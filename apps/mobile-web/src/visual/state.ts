export type ChatRole = 'system' | 'user' | 'assistant';

export type ConversationStatus = 'idle' | 'streaming' | 'cancelled' | 'error';

export type CoreMode =
  | 'idle'
  | 'ready'
  | 'connecting'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'muted'
  | 'connection_error'
  | 'error';

export type RealtimeVoiceSessionStatus =
  | 'ready'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'muted'
  | 'connection_error';

export interface AudioSignal {
  level: number;
  low: number;
  mid: number;
  high: number;
  rhythm: number;
}

export interface VisualSignal {
  audio: AudioSignal;
  tokenPulse: number;
  errorPulse: number;
  thinkingLevel: number;
  speakingLevel: number;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface CoreModeInput {
  conversationStatus?: ConversationStatus;
  microphoneStatus?: 'idle' | 'requesting' | 'listening' | 'denied' | 'error';
  muted?: boolean;
  lastMessage?: Pick<ChatMessage, 'role'> | null;
  transcribing?: boolean;
  speaking?: boolean;
  realtimeVoiceStatus?: RealtimeVoiceSessionStatus;
}

export function deriveCoreMode(input: CoreModeInput): CoreMode {
  if (input.realtimeVoiceStatus) {
    return input.realtimeVoiceStatus;
  }

  if (
    input.microphoneStatus === 'error' ||
    input.microphoneStatus === 'denied'
  ) {
    return 'error';
  }

  if (input.transcribing) {
    return 'transcribing';
  }

  if (input.conversationStatus === 'streaming') {
    return 'thinking';
  }

  if (
    input.microphoneStatus === 'listening' ||
    input.microphoneStatus === 'requesting'
  ) {
    return 'listening';
  }

  if (input.muted) {
    return 'muted';
  }

  if (input.speaking || input.lastMessage?.role === 'assistant') {
    return 'speaking';
  }

  return 'idle';
}
