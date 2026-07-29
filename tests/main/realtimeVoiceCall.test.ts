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
  it('posts the private Codex session JSON through the configured codex-LB route', async () => {
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
    ).resolves.toEqual({ ok: true, sdp: 'v=0\r\na=answer\r\n' })

    expect(requestedUrl).toBe(
      'https://voice.example.com/backend-api/codex/realtime/calls?intent=quicksilver&architecture=avas'
    )
    expect(requestedInit).toMatchObject({
      method: 'POST'
    })
    expect(requestedInit?.headers).toMatchObject({
      Authorization: 'Bearer private-key',
      'Content-Type': 'application/json'
    })
    expect(JSON.parse(String(requestedInit?.body))).toEqual({
      sdp: 'v=0\r\na=offer\r\n',
      session: {
        type: 'quicksilver',
        model: 'gpt-realtime',
        instructions: expect.stringContaining('ArcMind'),
        audio: {
          input: {
            format: {
              type: 'audio/pcm',
              rate: 24000
            }
          },
          output: {
            voice: 'cove'
          }
        }
      }
    })
    expect(requestedInit?.body).not.toBe('v=0\r\na=offer\r\n')
  })

  it('fails closed when realtime voice is disabled or SDP is invalid', async () => {
    await expect(
      createRealtimeVoiceCall({ ...config, enabled: false }, { sdp: 'v=0\r\n' })
    ).rejects.toMatchObject({ code: 'validation_failed' })
    await expect(
      createRealtimeVoiceCall(config, { sdp: 'not-sdp' })
    ).rejects.toMatchObject({ code: 'validation_failed' })
  })

  it('preserves safe proxy diagnostics without exposing response bodies', async () => {
    await expect(
      createRealtimeVoiceCall(
        config,
        { sdp: 'v=0\r\n' },
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                error: {
                  code: 'invalid_api_key',
                  type: 'authentication_error',
                  message: 'secret upstream body'
                }
              }),
              { status: 401 }
            )
        ) as typeof fetch
      )
    ).rejects.toMatchObject({
      code: 'auth_failed',
      details: {
        stage: 'call_creation',
        httpStatus: 401,
        upstreamCode: 'invalid_api_key',
        upstreamType: 'authentication_error'
      }
    })

    await expect(
      createRealtimeVoiceCall(
        config,
        { sdp: 'v=0\r\n' },
        vi.fn(async () => new Response('{"unexpected":true}', { status: 200 })) as typeof fetch
      )
    ).rejects.toMatchObject({ code: 'protocol_failed' })
  })

  it('distinguishes upstream Live Voice unavailability from proxy-key authentication', async () => {
    await expect(
      createRealtimeVoiceCall(
        config,
        { sdp: 'v=0\r\n' },
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                error: {
                  code: 'realtime_call_unavailable',
                  type: 'server_error',
                  message: 'private upstream detail'
                }
              }),
              { status: 403 }
            )
        ) as typeof fetch
      )
    ).rejects.toMatchObject({
      code: 'realtime_unavailable',
      details: {
        stage: 'call_creation',
        httpStatus: 403,
        upstreamCode: 'realtime_call_unavailable'
      }
    })
  })

  it('classifies an upstream HTTP 400 as rejected session parameters', async () => {
    await expect(
      createRealtimeVoiceCall(
        config,
        { sdp: 'v=0\r\n' },
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                error: {
                  code: 'upstream_error',
                  type: 'server_error',
                  message: 'private upstream detail'
                }
              }),
              { status: 400 }
            )
        ) as typeof fetch
      )
    ).rejects.toMatchObject({
      code: 'upstream_request_rejected',
      details: {
        stage: 'call_creation',
        httpStatus: 400,
        upstreamCode: 'upstream_error',
        upstreamType: 'server_error'
      }
    })
  })
})
