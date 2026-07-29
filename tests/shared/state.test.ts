import { describe, expect, it } from 'vitest'
import { deriveCoreMode } from '../../src/shared'

describe('deriveCoreMode', () => {
  it('prioritizes recoverable activity states before idle', () => {
    expect(
      deriveCoreMode({
        conversationStatus: 'streaming',
        microphoneStatus: 'idle',
        muted: false
      })
    ).toBe('thinking')

    expect(
      deriveCoreMode({
        conversationStatus: 'idle',
        microphoneStatus: 'idle',
        muted: false,
        transcribing: true
      })
    ).toBe('transcribing')
  })

  it('maps microphone and mute states to visual modes', () => {
    expect(
      deriveCoreMode({
        conversationStatus: 'idle',
        microphoneStatus: 'listening',
        muted: false
      })
    ).toBe('listening')

    expect(
      deriveCoreMode({
        conversationStatus: 'idle',
        microphoneStatus: 'idle',
        muted: true,
        lastMessage: { role: 'assistant' }
      })
    ).toBe('muted')
  })

  it('keeps errors visible above other modes', () => {
    expect(
      deriveCoreMode({
        conversationStatus: 'streaming',
        microphoneStatus: 'denied',
        muted: false
      })
    ).toBe('error')
  })

  it('uses the realtime voice lifecycle as the visual source of truth', () => {
    expect(
      deriveCoreMode({
        conversationStatus: 'streaming',
        microphoneStatus: 'error',
        muted: false,
        realtimeVoiceStatus: 'connecting'
      })
    ).toBe('connecting')

    expect(
      deriveCoreMode({
        conversationStatus: 'idle',
        microphoneStatus: 'idle',
        muted: false,
        realtimeVoiceStatus: 'connection_error'
      })
    ).toBe('connection_error')
  })
})

