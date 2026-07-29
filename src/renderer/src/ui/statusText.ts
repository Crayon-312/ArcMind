import type { CoreMode } from '../../../shared'

const CORE_MODE_LABELS: Record<CoreMode, string> = {
  idle: '待机',
  ready: '等待开始',
  connecting: '连接',
  listening: '聆听',
  transcribing: '转写',
  thinking: '思考',
  speaking: '回应',
  muted: '静音',
  connection_error: '连接失败',
  error: '异常'
}

export function coreModeLabel(mode: CoreMode): string {
  return CORE_MODE_LABELS[mode]
}

export function statusText(mode: CoreMode, micStatus: string): string {
  if (micStatus === 'requesting') {
    return '请求麦克风权限'
  }
  if (mode === 'listening') {
    return '正在聆听'
  }
  if (mode === 'ready') {
    return '等待开始'
  }
  if (mode === 'connecting') {
    return '正在连接'
  }
  if (mode === 'transcribing') {
    return '正在转写'
  }
  if (mode === 'thinking') {
    return '正在思考'
  }
  if (mode === 'speaking') {
    return '回应就绪'
  }
  if (mode === 'muted') {
    return '静音待机'
  }
  if (mode === 'error') {
    return '需要处理'
  }
  if (mode === 'connection_error') {
    return '连接失败，可重试'
  }
  return '待机'
}
