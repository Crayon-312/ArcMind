import { describe, expect, it } from 'vitest'
import { desktopBridgeUnavailableMessage, hasModelSettingsBridge } from '../../src/renderer/src/ui/runtimeBridge'

describe('runtime bridge checks', () => {
  it('reports unavailable settings bridge outside Electron preload', () => {
    expect(hasModelSettingsBridge(undefined)).toBe(false)
    expect(desktopBridgeUnavailableMessage).toContain('浏览器预览环境')
  })

  it('accepts a bridge with the model settings contract', () => {
    expect(
      hasModelSettingsBridge({
        settings: {
          getModelConfig: async () => ({
            provider: 'openai-compatible',
            baseUrl: 'https://api.deepseek.com',
            model: 'deepseek-chat',
            temperature: 0.7,
            maxContextMessages: 12,
            timeoutMs: 60000,
            hasApiKey: true
          }),
          setModelConfig: async () => ({
            provider: 'openai-compatible',
            baseUrl: 'https://api.deepseek.com',
            model: 'deepseek-chat',
            temperature: 0.7,
            maxContextMessages: 12,
            timeoutMs: 60000,
            hasApiKey: true
          }),
          testModelConfig: async () => ({ ok: true }),
          getRealtimeVoiceConfig: async () => ({
            provider: 'codex-lb-live',
            enabled: false,
            baseUrl: 'https://voice.example.com',
            hasApiKey: true
          }),
          setRealtimeVoiceConfig: async () => ({
            provider: 'codex-lb-live',
            enabled: false,
            baseUrl: 'https://voice.example.com',
            hasApiKey: true
          }),
          testRealtimeVoiceConfig: async () => ({
            ok: true,
            status: 'available',
            message: '检测通过',
            checkedAt: new Date(0).toISOString()
          })
        }
      } as never)
    ).toBe(true)
  })
})
