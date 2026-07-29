import { describe, expect, it, vi } from 'vitest'
import type { RealtimeVoiceCapabilityResult, RealtimeVoiceConfig } from '../../src/shared'
import {
  assertRealtimeVoiceCanEnable,
  probeRealtimeVoiceCapability
} from '../../src/main/voice/realtimeVoiceCapability'

const config: RealtimeVoiceConfig = {
  provider: 'codex-lb-live',
  enabled: false,
  baseUrl: 'https://voice.example.com/proxy',
  apiKey: 'placeholder-voice-credential'
}

describe('probeRealtimeVoiceCapability', () => {
  it('accepts only codex-LB with the private Live Voice route and a registered key', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          info: { title: 'codex-lb' },
          paths: {
            '/backend-api/codex/realtime/calls': { post: {} }
          }
        })
      )
      .mockResolvedValueOnce(jsonResponse({ key: { id: 'redacted' } }))

    const capability = await probeRealtimeVoiceCapability(config, fetchMock)

    expect(capability).toMatchObject({ ok: true, status: 'available' })
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://voice.example.com/proxy/openapi.json')
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe('https://voice.example.com/proxy/v1/usage')
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('realtime/calls'))).toBe(true)
  })

  it('rejects an OpenAI-compatible service without the codex-LB Live Voice route', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        info: { title: 'another-proxy' },
        paths: { '/v1/models': { get: {} } }
      })
    )

    await expect(probeRealtimeVoiceCapability(config, fetchMock)).resolves.toMatchObject({
      ok: false,
      status: 'unsupported'
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports a missing OpenAPI capability endpoint as unsupported', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ detail: 'Not Found' }, 404))

    await expect(probeRealtimeVoiceCapability(config, fetchMock)).resolves.toMatchObject({
      ok: false,
      status: 'unsupported'
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports an unregistered codex-LB proxy key as an authentication failure', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          info: { title: 'codex-lb' },
          paths: {
            '/backend-api/codex/realtime/calls': { post: {} }
          }
        })
      )
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'invalid_api_key' } }, 401))

    await expect(probeRealtimeVoiceCapability(config, fetchMock)).resolves.toMatchObject({
      ok: false,
      status: 'auth_failed'
    })
  })

  it('treats a forbidden registered-key check as an authentication failure', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          info: { title: 'codex-lb' },
          paths: {
            '/backend-api/codex/realtime/calls': { post: {} }
          }
        })
      )
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'forbidden' } }, 403))

    await expect(probeRealtimeVoiceCapability(config, fetchMock)).resolves.toMatchObject({
      ok: false,
      status: 'auth_failed'
    })
  })

  it('reports network failures without exposing credentials', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error('fetch failed'))

    const capability = await probeRealtimeVoiceCapability(config, fetchMock)

    expect(capability).toMatchObject({ ok: false, status: 'network_failed' })
    expect(capability.message).not.toContain(config.apiKey)
  })

  it('does not send a request when configuration is incomplete', async () => {
    const fetchMock = vi.fn<typeof fetch>()

    await expect(
      probeRealtimeVoiceCapability({ ...config, apiKey: '' }, fetchMock)
    ).resolves.toMatchObject({
      ok: false,
      status: 'not_configured'
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('assertRealtimeVoiceCanEnable', () => {
  it('blocks enabled configuration when the capability probe fails', async () => {
    const probe = vi.fn().mockResolvedValue(capability('unsupported'))

    await expect(assertRealtimeVoiceCanEnable({ ...config, enabled: true }, probe)).rejects.toMatchObject({
      code: 'validation_failed',
      recoverable: true
    })
  })

  it('does not probe when realtime voice is disabled', async () => {
    const probe = vi.fn().mockResolvedValue(capability('available'))

    await assertRealtimeVoiceCanEnable({ ...config, enabled: false }, probe)

    expect(probe).not.toHaveBeenCalled()
  })
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function capability(status: RealtimeVoiceCapabilityResult['status']): RealtimeVoiceCapabilityResult {
  return {
    ok: status === 'available',
    status,
    message: status,
    checkedAt: new Date(0).toISOString()
  }
}
