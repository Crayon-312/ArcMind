import type { AppError } from '../../shared'

export function appError(
  code: AppError['code'],
  message: string,
  recoverable = true,
  details?: AppError['details']
): AppError {
  return { code, message, recoverable, details }
}

export function normalizeAiError(error: unknown): AppError {
  if (isAppError(error)) {
    return error
  }

  if (isAbortError(error)) {
    return appError('cancelled', '生成已停止。', true)
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (message.includes('auth') || message.includes('401') || message.includes('403')) {
      return appError('auth_failed', '模型鉴权失败，请检查 API Key。', true)
    }
    if (message.includes('timeout')) {
      return appError('timeout', '模型请求超时，请稍后重试。', true)
    }
    if (message.includes('network') || message.includes('fetch failed')) {
      return appError('network_failed', '网络请求失败，请检查 Base URL 和网络连接。', true)
    }
    return appError('unknown', error.message || '模型请求失败。', true)
  }

  return appError('unknown', '模型请求失败。', true)
}

export function toIpcError(error: unknown): Error {
  const normalized = normalizeAiError(error)
  return new Error(normalized.message)
}

export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'recoverable' in error &&
    typeof error.message === 'string' &&
    typeof error.recoverable === 'boolean'
  )
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted'))
}
