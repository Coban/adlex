import { NextResponse } from 'next/server'

import { ErrorFactory } from './factory'
import { AppError, ErrorCode } from './types'

/**
 * エラーハンドリングユーティリティ
 */
export class ErrorHandler {
  /**
   * API レスポンス用のエラー処理
   */
  static createApiErrorResponse(error: unknown): NextResponse {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          error: error.getUserMessage(),
          code: error.code,
          details: process.env.NODE_ENV === 'development' ? error.getDebugInfo() : undefined,
        },
        { status: ErrorHandler.getHttpStatusForErrorCode(error.code) }
      )
    }

    // 標準 Error の場合
    if (error instanceof Error) {
      const appError = ErrorHandler.convertToAppError(error)
      return ErrorHandler.createApiErrorResponse(appError)
    }

    // 不明なエラーの場合
    const unknownError = ErrorFactory.createInternalError('不明なエラーが発生しました')
    return ErrorHandler.createApiErrorResponse(unknownError)
  }

  /**
   * エラーコードから HTTP ステータスコードを取得
   */
  private static getHttpStatusForErrorCode(code: ErrorCode): number {
    switch (code) {
      case 'AUTHENTICATION_ERROR':
        return 401
      case 'AUTHORIZATION_ERROR':
        return 403
      case 'NOT_FOUND_ERROR':
        return 404
      case 'VALIDATION_ERROR':
        return 400
      case 'QUOTA_EXCEEDED_ERROR':
        return 429
      case 'TIMEOUT_ERROR':
        return 408
      case 'EXTERNAL_SERVICE_ERROR':
      case 'AI_SERVICE_ERROR':
        return 502
      case 'NETWORK_ERROR':
        return 503
      case 'DATABASE_ERROR':
      case 'FILE_PROCESSING_ERROR':
      case 'API_ERROR':
      case 'INTERNAL_ERROR':
      default:
        return 500
    }
  }

  /**
   * 標準 Error を AppError に変換
   */
  static convertToAppError(error: Error): AppError {
    const message = error.message.toLowerCase()

    // 認証関連エラー
    if (message.includes('認証') || message.includes('auth')) {
      return ErrorFactory.createAuthenticationError(error.message, error)
    }

    // 権限関連エラー
    if (message.includes('権限') || message.includes('permission') || message.includes('unauthorized')) {
      return ErrorFactory.createAuthorizationError(error.message, error)
    }

    // バリデーションエラー
    if (message.includes('invalid') || message.includes('required') || message.includes('validation')) {
      return ErrorFactory.createValidationError(error.message)
    }

    // 見つからないエラー
    if (message.includes('not found') || message.includes('見つかりません')) {
      return ErrorFactory.createNotFoundError('リソース', undefined, error)
    }

    // ネットワークエラー
    if (message.includes('network') || message.includes('connection') || message.includes('fetch')) {
      return ErrorFactory.createNetworkError(error.message, error)
    }

    // タイムアウトエラー
    if (message.includes('timeout') || message.includes('タイムアウト')) {
      return ErrorFactory.createTimeoutError('処理', 0, error)
    }

    // クォータエラー
    if (message.includes('quota') || message.includes('limit') || message.includes('制限')) {
      return ErrorFactory.createQuotaExceededError('リソース')
    }

    // AI サービスエラー
    if (message.includes('openai') || message.includes('lm studio') || message.includes('openrouter')) {
      return ErrorFactory.createAIServiceError('AI', '処理', error.message, error)
    }

    // デフォルトは内部エラー
    return ErrorFactory.createInternalError(error.message, error)
  }

  /**
   * エラーログ出力（開発・デバッグ用）
   */
  static logError(error: unknown, context?: Record<string, unknown>): void {
    if (error instanceof AppError) {
      console.error(`[${error.code}] ${error.message}`, {
        userMessage: error.userMessage,
        context: { ...error.context, ...context },
        cause: error.cause?.message,
      })
    } else if (error instanceof Error) {
      console.error(`[UNKNOWN_ERROR] ${error.message}`, {
        stack: error.stack,
        context,
      })
    } else {
      console.error('[UNKNOWN_ERROR] Unknown error occurred', {
        error,
        context,
      })
    }
  }

  /**
   * フロントエンド用のエラー表示メッセージを取得
   */
  static getDisplayMessage(error: unknown): string {
    if (error instanceof AppError) {
      return error.getUserMessage()
    }

    if (error instanceof Error) {
      const appError = ErrorHandler.convertToAppError(error)
      return appError.getUserMessage()
    }

    return '予期しないエラーが発生しました'
  }
}
