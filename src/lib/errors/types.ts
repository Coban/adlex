/**
 * 標準化されたエラー型定義
 */

export type ErrorCode = 
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND_ERROR'
  | 'NETWORK_ERROR'
  | 'API_ERROR'
  | 'AI_SERVICE_ERROR'
  | 'DATABASE_ERROR'
  | 'FILE_PROCESSING_ERROR'
  | 'QUOTA_EXCEEDED_ERROR'
  | 'TIMEOUT_ERROR'
  | 'INTERNAL_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'

export interface ErrorDetails {
  code: ErrorCode
  message: string
  userMessage?: string
  context?: Record<string, unknown>
  cause?: Error
}

/**
 * 標準化されたアプリケーションエラークラス
 */
export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly userMessage: string
  public readonly context?: Record<string, unknown>
  public readonly cause?: Error

  constructor(details: ErrorDetails) {
    super(details.message)
    this.name = 'AppError'
    this.code = details.code
    this.userMessage = details.userMessage ?? details.message
    this.context = details.context
    this.cause = details.cause
  }

  /**
   * ユーザー向けエラーメッセージを取得
   */
  getUserMessage(): string {
    return this.userMessage
  }

  /**
   * 開発者向けデバッグ情報を取得
   */
  getDebugInfo(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      context: this.context,
      stack: this.stack,
      cause: this.cause?.message,
    }
  }
}