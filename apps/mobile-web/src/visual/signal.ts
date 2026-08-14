import type { AudioSignal, CoreMode, VisualSignal } from './state'

export const EMPTY_AUDIO_SIGNAL: AudioSignal = {
  level: 0,
  low: 0,
  mid: 0,
  high: 0,
  rhythm: 0
}

export interface ResolveVisualSignalInput {
  mode: CoreMode
  audio?: AudioSignal
  tokenPulse: number
  errorPulse: number
}

export function resolveVisualSignal(input: ResolveVisualSignalInput): VisualSignal {
  return {
    audio: clampAudioSignal(input.audio ?? EMPTY_AUDIO_SIGNAL),
    tokenPulse: Math.max(0, input.tokenPulse),
    errorPulse: Math.max(0, input.errorPulse),
    thinkingLevel: input.mode === 'thinking' ? 1 : 0,
    speakingLevel: input.mode === 'speaking' ? 1 : 0
  }
}

function clampAudioSignal(signal: AudioSignal): AudioSignal {
  return {
    level: clamp(signal.level),
    low: clamp(signal.low),
    mid: clamp(signal.mid),
    high: clamp(signal.high),
    rhythm: clamp(signal.rhythm)
  }
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}
