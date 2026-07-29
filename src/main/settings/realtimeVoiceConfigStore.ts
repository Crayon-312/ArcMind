import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { PublicRealtimeVoiceConfig, RealtimeVoiceConfig } from '../../shared'

const DEFAULT_CONFIG: RealtimeVoiceConfig = {
  provider: 'codex-lb-live',
  enabled: false,
  baseUrl: '',
  apiKey: ''
}

interface StoredRealtimeVoiceConfig {
  realtimeVoiceConfig?: Partial<RealtimeVoiceConfig>
}

export class RealtimeVoiceConfigStore {
  private readonly filePath: string

  constructor(userDataPath: string) {
    this.filePath = join(userDataPath, 'realtime-voice-config.json')
  }

  async get(): Promise<RealtimeVoiceConfig> {
    const stored = await this.read()
    return normalizeRealtimeVoiceConfig({ ...DEFAULT_CONFIG, ...stored.realtimeVoiceConfig })
  }

  async getPublic(): Promise<PublicRealtimeVoiceConfig> {
    return toPublicRealtimeVoiceConfig(await this.get())
  }

  async set(input: Partial<RealtimeVoiceConfig>): Promise<PublicRealtimeVoiceConfig> {
    const next = await this.preview(input)

    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, `${JSON.stringify({ realtimeVoiceConfig: next }, null, 2)}\n`, 'utf8')
    return toPublicRealtimeVoiceConfig(next)
  }

  async preview(input: Partial<RealtimeVoiceConfig>): Promise<RealtimeVoiceConfig> {
    const current = await this.get()
    return normalizeRealtimeVoiceConfig({
      ...current,
      ...input,
      apiKey: input.apiKey === undefined ? current.apiKey : input.apiKey
    })
  }

  private async read(): Promise<StoredRealtimeVoiceConfig> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as StoredRealtimeVoiceConfig
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return {}
      }
      throw error
    }
  }
}

export function normalizeRealtimeVoiceConfig(input: RealtimeVoiceConfig): RealtimeVoiceConfig {
  const baseUrl = input.baseUrl.trim().replace(/\/+$/, '').replace(/\/v1$/i, '')
  return {
    provider: 'codex-lb-live',
    enabled: Boolean(input.enabled),
    baseUrl,
    apiKey: input.apiKey.trim()
  }
}

export function toPublicRealtimeVoiceConfig(config: RealtimeVoiceConfig): PublicRealtimeVoiceConfig {
  const { apiKey: _apiKey, ...publicConfig } = config
  return {
    ...publicConfig,
    hasApiKey: config.apiKey.length > 0
  }
}
