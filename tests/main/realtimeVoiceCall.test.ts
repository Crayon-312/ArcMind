import { describe, expect, it, vi } from 'vitest'
import { createRealtimeVoiceCall } from '../../src/main/voice/realtimeVoiceCall'
import type { RealtimeVoiceConfig } from '../../src/shared'

const config: RealtimeVoiceConfig = {
  provider: 'codex-lb-live',
  enabled: true,
  baseUrl: 'https://voice.example.com',
  apiKey: 'private-key'
}

describe('createRealtimeVoiceCall', () => {
  it('posts SDP through the configured private codex-LB route', async () => {
    let requestedUrl = ''
    let requestedInit: RequestInit | undefined
    const fetchImplementation = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      requestedUrl = String(input)
      requestedInit = init
      return new Response('v=0\r\na=answer\r\n', {
        status: 201,
        headers: { 'Content-Type': 'application/sdp' }
      })
    })

    await expect(
      createRealtimeVoiceCall(
        config,
        { sdp: 'v=0\r\na=offer\r\n' },
        fetchImplementation as typeof fetch
      )
    ).resolves.toEqual({ sdp: 'v=0\r\na=answer\r\n' })

    expect(requestedUrl).toBe('https://voice.example.com/backend-api/codex/realtime/calls')
    expect(requestedInit).toMatchObject({
      method: 'POST',
      body: 'v=0\r\na=offer\r\n'
    })
    expect(requestedInit?.headers).toMatchObject({
      Authorization: 'Bearer private-key',
      'Content-Type': 'application/sdp'
    })
  })

  it('fails closed when realtime voice is disabled or SDP is invalid', async () => {
    await expect(
      createRealtimeVoiceCall({ ...config, enabled: false }, { sdp: 'v=0\r\n' })
    ).rejects.toMatchObject({ code: 'validation_failed' })
    await expect(
      createRealtimeVoiceCall(config, { sdp: 'not-sdp' })
    ).rejects.toMatchObject({ code: 'validation_failed' })
  })

  it('normalizes authentication and invalid answer failures without exposing response bodies', async () => {
    await expect(
      createRealtimeVoiceCall(
        config,
        { sdp: 'v=0\r\n' },
        vi.fn(async () => new Response('secret upstream body', { status: 401 })) as typeof fetch
      )
    ).rejects.toMatchObject({ code: 'auth_failed' })

    await expect(
      createRealtimeVoiceCall(
        config,
        { sdp: 'v=0\r\n' },
        vi.fn(async () => new Response('{"unexpected":true}', { status: 200 })) as typeof fetch
      )
    ).rejects.toMatchObject({ code: 'network_failed' })
  })
})
