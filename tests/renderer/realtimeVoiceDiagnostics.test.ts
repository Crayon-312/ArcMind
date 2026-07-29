import { describe, expect, it } from 'vitest'
import {
  normalizeRealtimeVoiceError,
  realtimeVoiceDiagnosticFromError
} from '../../src/renderer/src/voice/realtimeVoiceDiagnostics'

describe('realtime voice diagnostics', () => {
  it('explains a denied microphone permission with a concrete recovery action', () => {
    const error = normalizeRealtimeVoiceError(
      new DOMException('Permission denied', 'NotAllowedError'),
      'microphone_access'
    )
    const diagnostic = realtimeVoiceDiagnosticFromError(error)

    expect(diagnostic).toMatchObject({
      stage: 'microphone_access',
      stageLabel: '麦克风授权',
      code: 'permission_denied'
    })
    expect(diagnostic.action).toContain('Windows')
    expect(diagnostic.technicalDetails).toContain('浏览器异常：NotAllowedError')
  })

  it('keeps safe HTTP and upstream error metadata for technical users', () => {
    const diagnostic = realtimeVoiceDiagnosticFromError({
      code: 'realtime_unavailable',
      message: 'codex-LB 已收到请求，但上游账户未能创建通话。',
      recoverable: true,
      details: {
        stage: 'call_creation',
        httpStatus: 403,
        upstreamCode: 'realtime_call_unavailable'
      }
    })

    expect(diagnostic.stageLabel).toContain('codex-LB')
    expect(diagnostic.codeLabel).toBe('上游实时语音不可用')
    expect(diagnostic.technicalDetails).toEqual([
      'HTTP 状态：403',
      '上游错误码：realtime_call_unavailable'
    ])
  })

  it('explains an upstream request rejection instead of reporting a network failure', () => {
    const diagnostic = realtimeVoiceDiagnosticFromError({
      code: 'upstream_request_rejected',
      message: '上游拒绝了 codex-LB 转发的实时会话参数（HTTP 400）。',
      recoverable: true,
      details: {
        stage: 'call_creation',
        httpStatus: 400,
        upstreamCode: 'upstream_error',
        upstreamType: 'server_error'
      }
    })

    expect(diagnostic.codeLabel).toBe('上游拒绝实时会话参数')
    expect(diagnostic.action).toContain('请求格式和会话配置')
    expect(diagnostic.technicalDetails).toEqual([
      'HTTP 状态：400',
      '上游错误码：upstream_error',
      '上游错误类型：server_error'
    ])
  })
})
