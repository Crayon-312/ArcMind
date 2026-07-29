import { describe, expect, it } from 'vitest'
import { coreModeLabel, statusText } from '../../src/renderer/src/ui/statusText'

describe('statusText', () => {
  it('describes renderer status without depending on React state', () => {
    expect(statusText('idle', 'idle')).toBe('待机')
    expect(statusText('listening', 'listening')).toBe('正在聆听')
    expect(statusText('transcribing', 'idle')).toBe('正在转写')
    expect(statusText('muted', 'idle')).toBe('静音待机')
    expect(statusText('error', 'idle')).toBe('需要处理')
    expect(statusText('ready', 'idle')).toBe('等待开始')
    expect(statusText('connecting', 'idle')).toBe('正在连接')
    expect(statusText('connection_error', 'idle')).toBe('连接失败，可重试')
  })

  it('shows microphone permission requests before the visual mode label', () => {
    expect(statusText('idle', 'requesting')).toBe('请求麦克风权限')
  })

  it('provides Chinese labels for core modes', () => {
    expect(coreModeLabel('thinking')).toBe('思考')
    expect(coreModeLabel('speaking')).toBe('回应')
    expect(coreModeLabel('ready')).toBe('等待开始')
    expect(coreModeLabel('connecting')).toBe('连接')
    expect(coreModeLabel('connection_error')).toBe('连接失败')
    expect(coreModeLabel('error')).toBe('异常')
  })
})
