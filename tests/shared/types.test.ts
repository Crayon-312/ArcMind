import { describe, expectTypeOf, it } from 'vitest'
import type { AiStreamEvent, AppError, AudioSignal, ChatMessage, ConversationState, CoreMode, LongTermMemory, SystemTelemetrySnapshot, VisualSignal } from '../../src/shared'

describe('shared type contracts', () => {
  it('keeps the baseline shared contracts importable from src/shared', () => {
    expectTypeOf<CoreMode>().toEqualTypeOf<'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'muted' | 'error'>()
    expectTypeOf<ChatMessage>().toHaveProperty('content').toEqualTypeOf<string>()
    expectTypeOf<ConversationState>().toHaveProperty('activeRequestId').toEqualTypeOf<string | null>()
    expectTypeOf<LongTermMemory>().toHaveProperty('enabled').toEqualTypeOf<boolean>()
    expectTypeOf<AudioSignal>().toHaveProperty('rhythm').toEqualTypeOf<number>()
    expectTypeOf<VisualSignal>().toHaveProperty('tokenPulse').toEqualTypeOf<number>()
    expectTypeOf<SystemTelemetrySnapshot>().toHaveProperty('cpu')
    expectTypeOf<SystemTelemetrySnapshot>().toHaveProperty('gpu')
    expectTypeOf<AiStreamEvent>().toHaveProperty('type')
    expectTypeOf<AppError>().toHaveProperty('recoverable').toEqualTypeOf<boolean>()
  })
})
