import { describe, expect, it } from 'vitest'
import { realtimeVoiceStatusFromServerEvent } from '../../src/renderer/src/voice/realtimeVoiceSession'

describe('realtimeVoiceStatusFromServerEvent', () => {
  it('maps server activity to the realtime voice visual lifecycle', () => {
    expect(
      realtimeVoiceStatusFromServerEvent('{"type":"input_audio_buffer.speech_started"}')
    ).toBe('listening')
    expect(
      realtimeVoiceStatusFromServerEvent('{"type":"input_audio_buffer.speech_stopped"}')
    ).toBe('thinking')
    expect(
      realtimeVoiceStatusFromServerEvent('{"type":"response.audio.delta"}')
    ).toBe('speaking')
    expect(
      realtimeVoiceStatusFromServerEvent('{"type":"response.done"}')
    ).toBe('listening')
    expect(realtimeVoiceStatusFromServerEvent('{"type":"error"}')).toBe(
      'connection_error'
    )
  })

  it('ignores malformed or unrelated frames', () => {
    expect(realtimeVoiceStatusFromServerEvent('not-json')).toBeNull()
    expect(realtimeVoiceStatusFromServerEvent('{"type":"session.created"}')).toBeNull()
    expect(realtimeVoiceStatusFromServerEvent(new Uint8Array())).toBeNull()
  })
})
