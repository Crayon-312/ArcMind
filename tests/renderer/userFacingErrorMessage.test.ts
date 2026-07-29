import { describe, expect, it } from 'vitest'
import { userFacingErrorMessage } from '../../src/renderer/src/ui/userFacingErrorMessage'

describe('userFacingErrorMessage', () => {
  it('removes Electron IPC wrapper text from a readable error', () => {
    const error = new Error(
      "Error invoking remote method 'voice:transcribe': Error: 请先在设置中配置 API Key。"
    )

    expect(userFacingErrorMessage(error)).toBe('请先在设置中配置 API Key。')
  })

  it('does not expose an object string as the user-facing error', () => {
    const error = new Error("Error invoking remote method 'voice:transcribe': [object Object]")

    expect(userFacingErrorMessage(error)).toBe('请求失败，请检查模型配置。')
  })
})
