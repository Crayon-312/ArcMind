import type { AppError, AppErrorCode } from '../../../shared'

export type RealtimeVoiceFailureStage =
  | 'configuration'
  | 'capability_check'
  | 'microphone_access'
  | 'offer_creation'
  | 'call_creation'
  | 'answer_application'
  | 'peer_connection'
  | 'data_channel'
  | 'remote_audio'

export interface RealtimeVoiceDiagnostic {
  stage: RealtimeVoiceFailureStage
  stageLabel: string
  code: AppErrorCode
  codeLabel: string
  message: string
  action: string
  technicalDetails: string[]
}

const STAGE_LABELS: Record<RealtimeVoiceFailureStage, string> = {
  configuration: '实时语音配置',
  capability_check: '服务能力检测',
  microphone_access: '麦克风授权',
  offer_creation: '本地 SDP Offer（会话描述）生成',
  call_creation: 'codex-LB 通话创建',
  answer_application: '远端 SDP Answer（会话描述）应用',
  peer_connection: 'WebRTC（网页实时音视频通信）建联',
  data_channel: '实时控制数据通道',
  remote_audio: '远端音频播放'
}

const CODE_LABELS: Record<AppErrorCode, string> = {
  unknown: '未知错误',
  validation_failed: '配置或输入校验失败',
  network_failed: '网络或上游网关失败',
  auth_failed: '代理鉴权失败',
  permission_denied: '系统权限被拒绝',
  rate_limited: '请求频率或额度受限',
  timeout: '连接超时',
  cancelled: '用户取消',
  microphone_unavailable: '麦克风不可用',
  realtime_unavailable: '上游实时语音不可用',
  upstream_request_rejected: '上游拒绝实时会话参数',
  protocol_failed: '实时语音协议不兼容',
  connection_failed: '实时连接失败',
  storage_failed: '本地存储失败'
}

const ACTIONS: Record<AppErrorCode, string> = {
  unknown: '打开技术详情并查看本地日志；若可复现，请记录失败阶段后再排查。',
  validation_failed: '重新打开设置，检测并保存实时语音配置。',
  network_failed: '检查 codex-LB 运行状态、反向代理和网络；若出现 HTTP 502/503，优先查看中转服务日志。',
  auth_failed: '确认使用的是已在 codex-LB 注册的代理密钥，而不是 ChatGPT 账户令牌。',
  permission_denied: '在 Windows“隐私和安全性 > 麦克风”中允许桌面应用访问，然后重启 ArcMind。',
  rate_limited: '稍后重试，并检查 codex-LB 账户池的额度或并发限制。',
  timeout: '检查中转服务到上游的网络延迟；确认没有代理或防火墙阻断实时通话。',
  cancelled: '重新点击“开始实时通话”即可。',
  microphone_unavailable: '确认麦克风已连接、未被独占，并在系统声音设置中可正常录音。',
  realtime_unavailable: '在官方 Codex 中验证所选 ChatGPT 账户是否可使用 Live Voice，并查看 codex-LB 最近请求。',
  upstream_request_rejected: '核对 ArcMind 与 codex-LB 版本，并检查私有 Live Voice 请求格式和会话配置。',
  protocol_failed: '确认 codex-LB 已更新到支持私有 Live Voice 路由的版本，并核对返回的 SDP 与控制侧协议。',
  connection_failed: '检查防火墙、VPN（虚拟专用网络）和 UDP（用户数据报协议）连通性，再查看 ICE/WebRTC 技术状态。',
  storage_failed: '检查本地应用数据目录的写入权限。'
}

export function realtimeVoiceDiagnosticFromError(
  error: AppError,
  fallbackStage: RealtimeVoiceFailureStage = 'peer_connection'
): RealtimeVoiceDiagnostic {
  const stage = stageFromDetails(error.details?.stage) ?? fallbackStage
  const details: string[] = []
  appendDetail(details, 'HTTP 状态', error.details?.httpStatus)
  appendDetail(details, '上游错误码', error.details?.upstreamCode)
  appendDetail(details, '上游错误类型', error.details?.upstreamType)
  appendDetail(details, '浏览器异常', error.details?.browserError)
  appendDetail(details, '连接状态', error.details?.connectionState)
  appendDetail(details, 'ICE 状态', error.details?.iceConnectionState)
  appendDetail(details, '响应类型', error.details?.responseContentType)

  return {
    stage,
    stageLabel: STAGE_LABELS[stage],
    code: error.code,
    codeLabel: CODE_LABELS[error.code],
    message: error.message,
    action: ACTIONS[error.code],
    technicalDetails: details
  }
}

export function normalizeRealtimeVoiceError(
  error: unknown,
  stage: RealtimeVoiceFailureStage
): AppError {
  if (isAppError(error)) {
    return {
      ...error,
      details: {
        ...error.details,
        stage: stageFromDetails(error.details?.stage) ?? stage
      }
    }
  }

  const browserError = error instanceof Error ? error.name : 'UnknownError'
  if (stage === 'microphone_access') {
    if (browserError === 'NotAllowedError' || browserError === 'SecurityError') {
      return diagnosticError(
        'permission_denied',
        '系统或 Electron（桌面应用运行框架）拒绝了麦克风权限。',
        stage,
        browserError
      )
    }
    if (
      browserError === 'NotFoundError' ||
      browserError === 'NotReadableError' ||
      browserError === 'OverconstrainedError'
    ) {
      return diagnosticError(
        'microphone_unavailable',
        '没有找到可用麦克风，或设备正被其他程序独占。',
        stage,
        browserError
      )
    }
  }

  if (browserError === 'AbortError') {
    return diagnosticError('cancelled', '实时通话连接已取消。', stage, browserError)
  }
  if (stage === 'offer_creation' || stage === 'answer_application') {
    return diagnosticError(
      'protocol_failed',
      stage === 'offer_creation'
        ? '浏览器无法生成有效的本地 SDP Offer（会话描述）。'
        : '浏览器拒绝应用 codex-LB 返回的 SDP Answer（远端会话描述）。',
      stage,
      browserError
    )
  }

  return diagnosticError(
    'connection_failed',
    '实时语音连接在浏览器运行时阶段失败。',
    stage,
    browserError
  )
}

export function realtimeVoiceConnectionError(
  stage: RealtimeVoiceFailureStage,
  message: string,
  details?: AppError['details']
): AppError {
  return {
    code: stage === 'remote_audio' ? 'permission_denied' : 'connection_failed',
    message,
    recoverable: true,
    details: { ...details, stage }
  }
}

function diagnosticError(
  code: AppErrorCode,
  message: string,
  stage: RealtimeVoiceFailureStage,
  browserError: string
): AppError {
  return {
    code,
    message,
    recoverable: true,
    details: { stage, browserError }
  }
}

function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'recoverable' in value &&
    typeof value.code === 'string' &&
    typeof value.message === 'string' &&
    typeof value.recoverable === 'boolean'
  )
}

function stageFromDetails(value: unknown): RealtimeVoiceFailureStage | null {
  return typeof value === 'string' && value in STAGE_LABELS
    ? (value as RealtimeVoiceFailureStage)
    : null
}

function appendDetail(
  target: string[],
  label: string,
  value: string | number | boolean | null | undefined
): void {
  if (value !== undefined && value !== null && value !== '') {
    target.push(`${label}：${String(value)}`)
  }
}
