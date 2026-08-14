import { describe, expect, it } from 'vitest'

import { EMPTY_AUDIO_SIGNAL, resolveVisualSignal } from './signal'

describe('resolveVisualSignal', () => {
  it('derives thinking and speaking levels from the visual mode', () => {
    expect(
      resolveVisualSignal({
        mode: 'thinking',
        audio: EMPTY_AUDIO_SIGNAL,
        tokenPulse: 3,
        errorPulse: 0
      })
    ).toMatchObject({
      thinkingLevel: 1,
      speakingLevel: 0,
      tokenPulse: 3
    })

    expect(
      resolveVisualSignal({
        mode: 'speaking',
        audio: EMPTY_AUDIO_SIGNAL,
        tokenPulse: 0,
        errorPulse: 0
      })
    ).toMatchObject({
      thinkingLevel: 0,
      speakingLevel: 1
    })
  })

  it('clamps audio bands and pulse counters to stable ranges', () => {
    expect(
      resolveVisualSignal({
        mode: 'idle',
        audio: {
          level: 1.8,
          low: -0.4,
          mid: Number.NaN,
          high: 0.5,
          rhythm: 2
        },
        tokenPulse: -2,
        errorPulse: -1
      })
    ).toEqual({
      audio: {
        level: 1,
        low: 0,
        mid: 0,
        high: 0.5,
        rhythm: 1
      },
      tokenPulse: 0,
      errorPulse: 0,
      thinkingLevel: 0,
      speakingLevel: 0
    })
  })
})
