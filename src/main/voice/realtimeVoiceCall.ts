import type {
  CreateRealtimeVoiceCallInput,
  RealtimeVoiceConfig
} from '../../shared'
import { appError, isAbortError, isAppError } from '../ai/errors'

type FetchImplementation = typeof fetch

const LIVE_CALL_PATH = '/backend-api/codex/realtime/calls'
const CALL_TIMEOUT_MS = 30000
const MAX_SDP_LENGTH = 1_000_000
const PRIVATE_REALTIME_SESSION = {
  type: 'quicksilver',
  model: 'gpt-realtime',
  instructions:
    '你是 ArcMind，一个克制、可靠、注重隐私的本地桌面 AI 私人助手。默认使用简洁、自然的中文口语回答；用户明确使用其他语言时跟随用户。',
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
} as const

export async function createRealtimeVoiceCall(
  config: RealtimeVoiceConfig,
  input: CreateRealtimeVoiceCallInput,
  fetchImplementation: FetchImplementation = fetch
): Promise<{ ok: true; sdp: string }> {
  validateRealtimeVoiceCall(config, input)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS)

  try {
    const endpoint = new URL(LIVE_CALL_PATH, `${config.baseUrl.replace(/\/+$/, '')}/`)
    endpoint.searchParams.set('intent', 'quicksilver')
    endpoint.searchParams.set('architecture', 'avas')

    const response = await fetchImplementation(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/sdp',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sdp: input.sdp,
        session: PRIVATE_REALTIME_SESSION
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      const proxyError = await readProxyError(response)
      const details = responseDetails(response.status, proxyError)

      if (response.status === 401) {
        throw appError(
          'auth_failed',
          'codex-LB 拒绝了代理密钥；该密钥未注册、已失效，或没有访问私有实时语音路由。',
          true,
          details
        )
      }
      if (response.status === 403 || proxyError.code === 'realtime_call_unavailable') {
        throw appError(
          'realtime_unavailable',
          'codex-LB 已收到请求，但上游 ChatGPT 账户未能创建 Live Voice 通话。',
          true,
          details
        )
      }
      if (proxyError.code === 'realtime_call_binding_failed') {
        throw appError(
          'protocol_failed',
          '上游已经创建通话，但 codex-LB 无法安全绑定该通话与所选账户。',
          true,
          details
        )
      }
      if (response.status === 404) {
        throw appError(
          'protocol_failed',
          '当前 codex-LB 没有提供 ArcMind 所需的私有实时通话创建路由。',
          true,
          details
        )
      }
      if (response.status === 429) {
        throw appError('rate_limited', '实时语音请求频率或账户额度当前受限。', true, details)
      }
      if (response.status === 400 || response.status === 422) {
        throw appError(
          'upstream_request_rejected',
          `上游拒绝了 codex-LB 转发的实时会话参数（HTTP ${response.status}）。`,
          true,
          details
        )
      }
      throw appError(
        'network_failed',
        `codex-LB 创建实时通话失败（HTTP ${response.status}）。`,
        true,
        details
      )
    }

    const sdp = await response.text()
    if (!sdp.trim().startsWith('v=')) {
      throw appError(
        'protocol_failed',
        'codex-LB 返回成功状态，但响应不是有效的 SDP Answer（远端会话描述）。',
        true,
        {
          stage: 'call_creation',
          httpStatus: response.status,
          responseContentType: boundedToken(response.headers.get('content-type')) ?? 'unknown'
        }
      )
    }

    return { ok: true, sdp }
  } catch (error) {
    if (isAbortError(error)) {
      throw appError('timeout', '实时通话创建请求在 30 秒内没有完成。', true, {
        stage: 'call_creation'
      })
    }
    if (isAppError(error)) {
      throw error
    }
    throw appError('network_failed', '无法连接 codex-LB 实时通话路由。', true, {
      stage: 'call_creation',
      cause: error instanceof Error ? boundedToken(error.name) ?? 'Error' : 'unknown'
    })
  } finally {
    clearTimeout(timeout)
  }
}

function validateRealtimeVoiceCall(
  config: RealtimeVoiceConfig,
  input: CreateRealtimeVoiceCallInput
): void {
  if (!config.enabled) {
    throw appError('validation_failed', '请先在设置中启用 GPT-Live 实时语音。', true, {
      stage: 'configuration'
    })
  }
  if (config.provider !== 'codex-lb-live' || !config.baseUrl || !config.apiKey) {
    throw appError('validation_failed', '实时语音配置不完整，请重新检测并保存 codex-LB 设置。', true, {
      stage: 'configuration'
    })
  }
  if (
    typeof input.sdp !== 'string' ||
    input.sdp.length === 0 ||
    input.sdp.length > MAX_SDP_LENGTH ||
    !input.sdp.trim().startsWith('v=')
  ) {
    throw appError('validation_failed', '本地生成的实时通话 SDP Offer（会话描述）无效。', true, {
      stage: 'offer_creation'
    })
  }
}

interface ProxyErrorMetadata {
  code?: string
  type?: string
}

async function readProxyError(response: Response): Promise<ProxyErrorMetadata> {
  try {
    const body = (await response.json()) as {
      error?: {
        code?: unknown
        type?: unknown
      }
    }
    return {
      code: boundedToken(body.error?.code),
      type: boundedToken(body.error?.type)
    }
  } catch {
    return {}
  }
}

function responseDetails(
  httpStatus: number,
  proxyError: ProxyErrorMetadata
): Record<string, string | number> {
  return {
    stage: 'call_creation',
    httpStatus,
    ...(proxyError.code ? { upstreamCode: proxyError.code } : {}),
    ...(proxyError.type ? { upstreamType: proxyError.type } : {})
  }
}

function boundedToken(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const token = value.trim()
  return token.length > 0 && token.length <= 96 && /^[a-zA-Z0-9_./+-]+$/.test(token)
    ? token
    : undefined
}
