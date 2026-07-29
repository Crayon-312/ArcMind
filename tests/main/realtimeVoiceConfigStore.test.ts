import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  normalizeRealtimeVoiceConfig,
  RealtimeVoiceConfigStore,
  toPublicRealtimeVoiceConfig
} from '../../src/main/settings/realtimeVoiceConfigStore'
import { saveRealtimeVoiceConfig } from '../../src/main/settings/realtimeVoiceSettings'

let tempDir: string | null = null

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true })
    tempDir = null
  }
})

describe('RealtimeVoiceConfigStore', () => {
  it('does not expose the codex-LB proxy API key', () => {
    const publicConfig = toPublicRealtimeVoiceConfig(
      normalizeRealtimeVoiceConfig({
        provider: 'codex-lb-live',
        enabled: true,
        baseUrl: 'https://voice.example.com/',
        apiKey: 'placeholder-voice-credential'
      })
    )

    expect(publicConfig).not.toHaveProperty('apiKey')
    expect(publicConfig).toEqual({
      provider: 'codex-lb-live',
      enabled: true,
      baseUrl: 'https://voice.example.com',
      hasApiKey: true
    })
  })

  it('persists realtime voice configuration separately from the text model', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'arcmind-realtime-voice-'))
    const store = new RealtimeVoiceConfigStore(tempDir)

    await store.set({
      enabled: true,
      baseUrl: 'https://voice.example.com',
      apiKey: 'placeholder-voice-credential'
    })

    expect(await store.getPublic()).toMatchObject({
      provider: 'codex-lb-live',
      enabled: true,
      baseUrl: 'https://voice.example.com',
      hasApiKey: true
    })
    expect((await store.get()).apiKey).toBe('placeholder-voice-credential')
  })

  it('previews a draft without persisting it and preserves an omitted API key', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'arcmind-realtime-voice-'))
    const store = new RealtimeVoiceConfigStore(tempDir)
    await store.set({
      baseUrl: 'https://saved.example.com',
      apiKey: 'saved-voice-credential'
    })

    const preview = await store.preview({
      baseUrl: 'https://draft.example.com',
      enabled: true
    })

    expect(preview).toMatchObject({
      baseUrl: 'https://draft.example.com',
      apiKey: 'saved-voice-credential',
      enabled: true
    })
    expect(await store.get()).toMatchObject({
      baseUrl: 'https://saved.example.com',
      apiKey: 'saved-voice-credential',
      enabled: false
    })
  })

  it('does not persist enabled state when the main-process capability gate fails', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'arcmind-realtime-voice-'))
    const store = new RealtimeVoiceConfigStore(tempDir)
    await store.set({
      baseUrl: 'https://voice.example.com',
      apiKey: 'placeholder-voice-credential'
    })

    await expect(
      saveRealtimeVoiceConfig(store, { enabled: true }, async () => ({
        ok: false,
        status: 'unsupported',
        message: 'unsupported',
        checkedAt: new Date(0).toISOString()
      }))
    ).rejects.toMatchObject({ code: 'validation_failed' })

    expect((await store.get()).enabled).toBe(false)
  })
})
