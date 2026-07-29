import type {
  CreateRealtimeVoiceCallInput,
  CreateRealtimeVoiceCallResult,
  RealtimeVoiceConfig
} from '../../shared'
import { appError, isAbortError } from '../ai/errors'

type FetchImplementation = typeof fetch

const LIVE_CALL_PATH = '/backend-api/codex/realtime/calls'
const CALL_TIMEOUT_MS = 30000
const MAX_SDP_LENGTH = 1_000_000

export async function createRealtimeVoiceCall(
  config: RealtimeVoiceConfig,
  input: CreateRealtimeVoiceCallInput,
  fetchImplementation: FetchImplementation = fetch
): Promise<CreateRealtimeVoiceCallResult> {
  validateRealtimeVoiceCall(config, input)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS)

  try {
    const response = await fetchImplementation(new URL(LIVE_CALL_PATH, `${config.baseUrl.replace(/\/+$/, '')}/`), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/sdp',
        'Content-Type': 'application/sdp'
      },
      body: input.sdp,
      signal: controller.signal
    })

    if (response.status === 401 || response.status === 403) {
      throw appError('auth_failed', 'codex-LB 拒绝创建实时通话，请检查代理密钥或账户语音权限。', true)
    }
    if (response.status === 429) {
      throw appError('rate_limited', '实时语音当前受限，请稍后重试。', true)
    }
    if (!response.ok) {
      throw appError('network_failed', `实时通话建联失败（HTTP ${response.status}）。`, true)
    }

    const sdp = await response.text()
    if (!sdp.trim().startsWith('v=')) {
      throw appError('network_failed', 'codex-LB 没有返回有效的实时通话协商结果。', true)
    }

    return { sdp }
  } catch (error) {
    if (isAbortError(error)) {
      throw appError('timeout', '实时通话建联超时，请重试。', true)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function validateRealtimeVoiceCall(
  config: RealtimeVoiceConfig,
  input: CreateRealtimeVoiceCallInput
): void {
  if (!config.enabled) {
    throw appError('validation_failed', '请先在设置中启用 GPT-Live 实时语音。', true)
  }
  if (config.provider !== 'codex-lb-live' || !config.baseUrl || !config.apiKey) {
    throw appError('validation_failed', '实时语音配置不完整，请重新检测并保存 codex-LB 设置。', true)
  }
  if (
    typeof input.sdp !== 'string' ||
    input.sdp.length === 0 ||
    input.sdp.length > MAX_SDP_LENGTH ||
    !input.sdp.trim().startsWith('v=')
  ) {
    throw appError('validation_failed', '实时通话协商内容无效。', true)
  }
}
