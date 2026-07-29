import { describe, expect, it } from 'vitest'
import { appError, toIpcError } from '../../src/main/ai/errors'

describe('toIpcError', () => {
  it('converts a structured application error into an Error with a readable message', () => {
    const error = toIpcError(appError('validation_failed', '请先在设置中配置 API Key。', true))

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('请先在设置中配置 API Key。')
  })
})
