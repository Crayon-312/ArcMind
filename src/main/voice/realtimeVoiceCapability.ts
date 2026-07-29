import type { AppError, RealtimeVoiceCapabilityResult, RealtimeVoiceConfig } from '../../shared'
import { appError } from '../ai/errors'

type FetchImplementation = typeof fetch

interface OpenApiDocument {
  info?: {
    title?: unknown
  }
  paths?: Record<string, Record<string, unknown> | undefined>
}

const LIVE_CALL_PATH = '/backend-api/codex/realtime/calls'
const PROBE_TIMEOUT_MS = 10000

export async function probeRealtimeVoiceCapability(
  config: RealtimeVoiceConfig,
  fetchImplementation: FetchImplementation = fetch
): Promise<RealtimeVoiceCapabilityResult> {
  const checkedAt = new Date().toISOString()
  const validationMessage = validateProbeConfig(config)
  if (validationMessage) {
    return result('not_configured', validationMessage, checkedAt)
  }

  let baseUrl: URL
  try {
    baseUrl = serviceBaseUrl(config.baseUrl)
  } catch {
    return result('not_configured', 'codex-LB 服务根地址无效，请填写 http:// 或 https:// 地址。', checkedAt)
  }

  try {
    const openApiResponse = await fetchImplementation(new URL('openapi.json', baseUrl), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    })

    if (openApiResponse.status === 401 || openApiResponse.status === 403) {
      return result('auth_failed', 'codex-LB 拒绝了接口结构检测，请检查代理 API Key。', checkedAt)
    }
    if (!openApiResponse.ok) {
      return result('unsupported', '未发现可验证的 codex-LB 接口结构，实时语音不能启用。', checkedAt)
    }

    let openApi: OpenApiDocument
    try {
      openApi = (await openApiResponse.json()) as OpenApiDocument
    } catch {
      return result('unsupported', '服务没有返回有效的 codex-LB 接口结构，实时语音不能启用。', checkedAt)
    }
    const title = typeof openApi.info?.title === 'string' ? openApi.info.title.trim().toLowerCase() : ''
    const liveCallRoute = openApi.paths?.[LIVE_CALL_PATH]
    if (title !== 'codex-lb' || !liveCallRoute || !('post' in liveCallRoute)) {
      return result('unsupported', '该服务不是支持 Live Voice 路由的 codex-LB，实时语音不能启用。', checkedAt)
    }

    const usageResponse = await fetchImplementation(new URL('v1/usage', baseUrl), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    })

    if (usageResponse.status === 401 || usageResponse.status === 403) {
      return result('auth_failed', '代理 API Key 未在 codex-LB 中注册或已失效。', checkedAt)
    }
    if (usageResponse.status === 404) {
      return result('unsupported', 'codex-LB 缺少实时语音检测所需的密钥接口，请先更新中转服务。', checkedAt)
    }
    if (!usageResponse.ok) {
      return result('network_failed', `codex-LB 密钥检测失败（HTTP ${usageResponse.status}）。`, checkedAt)
    }

    return result(
      'available',
      '检测通过：codex-LB Live Voice 路由存在，代理 API Key 有效。',
      checkedAt
    )
  } catch {
    return result('network_failed', '无法连接 codex-LB，请检查服务地址、网络和证书。', checkedAt)
  }
}

export async function assertRealtimeVoiceCanEnable(
  config: RealtimeVoiceConfig,
  probe: (config: RealtimeVoiceConfig) => Promise<RealtimeVoiceCapabilityResult> = probeRealtimeVoiceCapability
): Promise<void> {
  if (!config.enabled) {
    return
  }

  const capability = await probe(config)
  if (!capability.ok) {
    throw capabilityError(capability)
  }
}

function validateProbeConfig(config: RealtimeVoiceConfig): string | null {
  if (!config.baseUrl) {
    return '请先填写 codex-LB 服务根地址。'
  }
  if (!config.apiKey) {
    return '请先填写已在 codex-LB 中注册的代理 API Key。'
  }
  return null
}

function serviceBaseUrl(value: string): URL {
  const url = new URL(`${value.replace(/\/+$/, '')}/`)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Unsupported protocol.')
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Unsupported URL components.')
  }
  return url
}

function result(
  status: RealtimeVoiceCapabilityResult['status'],
  message: string,
  checkedAt: string
): RealtimeVoiceCapabilityResult {
  return {
    ok: status === 'available',
    status,
    message,
    checkedAt
  }
}

function capabilityError(capability: RealtimeVoiceCapabilityResult): AppError {
  if (capability.status === 'auth_failed') {
    return appError('auth_failed', capability.message, true)
  }
  if (capability.status === 'network_failed') {
    return appError('network_failed', capability.message, true)
  }
  return appError('validation_failed', capability.message, true)
}
