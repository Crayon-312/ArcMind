const DEFAULT_ERROR_MESSAGE = '请求失败，请检查模型配置。'

export function userFacingErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object' || !('message' in error) || typeof error.message !== 'string') {
    return DEFAULT_ERROR_MESSAGE
  }

  const message = error.message
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '')
    .trim()

  return message && message !== '[object Object]' ? message : DEFAULT_ERROR_MESSAGE
}
