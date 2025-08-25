import { AppError } from './types'

/**
 * 標準化されたエラー生成ファクトリー
 */
export class ErrorFactory {
  /**
   * 認証エラーを生成
   */
  static createAuthenticationError(message?: string, cause?: Error): AppError {
    return new AppError({
      code: 'AUTHENTICATION_ERROR',
      message: message ?? '認証に失敗しました',
      userMessage: '認証が必要です。サインインしてください。',
      cause,
    })
  }

  /**
   * 認可エラーを生成
   */
  static createAuthorizationError(message?: string, cause?: Error): AppError {
    return new AppError({
      code: 'AUTHORIZATION_ERROR',
      message: message ?? '権限が不足しています',
      userMessage: 'この操作を実行する権限がありません。',
      cause,
    })
  }

  /**
   * バリデーションエラーを生成
   */
  static createValidationError(
    message: string, 
    userMessage?: string, 
    context?: Record<string, unknown>
  ): AppError {
    return new AppError({
      code: 'VALIDATION_ERROR',
      message,
      userMessage: userMessage ?? message,
      context,
    })
  }

  /**
   * リソースが見つからないエラーを生成
   */
  static createNotFoundError(
    resource: string, 
    id?: string | number, 
    cause?: Error
  ): AppError {
    const message = id ? `${resource} (ID: ${id}) が見つかりません` : `${resource}が見つかりません`
    return new AppError({
      code: 'NOT_FOUND_ERROR',
      message,
      userMessage: message,
      context: { resource, id },
      cause,
    })
  }

  /**
   * ネットワークエラーを生成
   */
  static createNetworkError(message?: string, cause?: Error): AppError {
    return new AppError({
      code: 'NETWORK_ERROR',
      message: message ?? 'ネットワークエラーが発生しました',
      userMessage: 'ネットワーク接続を確認してください。',
      cause,
    })
  }

  /**
   * APIエラーを生成
   */
  static createApiError(
    status: number, 
    message?: string, 
    endpoint?: string, 
    cause?: Error
  ): AppError {
    const defaultMessage = `APIエラー: ${status}`
    return new AppError({
      code: 'API_ERROR',
      message: message ?? defaultMessage,
      userMessage: status >= 500 
        ? 'サーバーエラーが発生しました。しばらく待ってから再試行してください。'
        : message ?? defaultMessage,
      context: { status, endpoint },
      cause,
    })
  }

  /**
   * AI サービスエラーを生成
   */
  static createAIServiceError(
    provider: string, 
    operation: string, 
    message?: string, 
    cause?: Error
  ): AppError {
    const defaultMessage = `${provider} ${operation}に失敗しました`
    return new AppError({
      code: 'AI_SERVICE_ERROR',
      message: message ?? defaultMessage,
      userMessage: `AI処理中にエラーが発生しました。しばらく待ってから再試行してください。`,
      context: { provider, operation },
      cause,
    })
  }

  /**
   * データベースエラーを生成
   */
  static createDatabaseError(
    operation: string, 
    table?: string, 
    cause?: Error
  ): AppError {
    const message = table ? `${table}テーブルの${operation}に失敗しました` : `データベース${operation}に失敗しました`
    return new AppError({
      code: 'DATABASE_ERROR',
      message,
      userMessage: 'データベース処理中にエラーが発生しました。',
      context: { operation, table },
      cause,
    })
  }

  /**
   * ファイル処理エラーを生成
   */
  static createFileProcessingError(
    operation: string, 
    fileType?: string, 
    cause?: Error
  ): AppError {
    const message = `ファイル${operation}に失敗しました`
    return new AppError({
      code: 'FILE_PROCESSING_ERROR',
      message,
      userMessage: fileType 
        ? `${fileType}ファイルの処理中にエラーが発生しました。`
        : 'ファイル処理中にエラーが発生しました。',
      context: { operation, fileType },
      cause,
    })
  }

  /**
   * クォータ超過エラーを生成
   */
  static createQuotaExceededError(
    resource: string, 
    limit?: number, 
    current?: number
  ): AppError {
    const message = limit 
      ? `${resource}の制限を超過しました (${current}/${limit})`
      : `${resource}の制限を超過しました`
    return new AppError({
      code: 'QUOTA_EXCEEDED_ERROR',
      message,
      userMessage: `${resource}の使用量が上限に達しました。`,
      context: { resource, limit, current },
    })
  }

  /**
   * タイムアウトエラーを生成
   */
  static createTimeoutError(
    operation: string, 
    timeoutMs: number, 
    cause?: Error
  ): AppError {
    return new AppError({
      code: 'TIMEOUT_ERROR',
      message: `${operation}がタイムアウトしました (${timeoutMs}ms)`,
      userMessage: `処理がタイムアウトしました。しばらく待ってから再試行してください。`,
      context: { operation, timeoutMs },
      cause,
    })
  }

  /**
   * 外部サービスエラーを生成
   */
  static createExternalServiceError(
    service: string, 
    operation: string, 
    message?: string, 
    cause?: Error
  ): AppError {
    return new AppError({
      code: 'EXTERNAL_SERVICE_ERROR',
      message: message ?? `${service}サービスでエラーが発生しました`,
      userMessage: `外部サービス連携でエラーが発生しました。しばらく待ってから再試行してください。`,
      context: { service, operation },
      cause,
    })
  }

  /**
   * 内部エラーを生成
   */
  static createInternalError(message?: string, cause?: Error): AppError {
    return new AppError({
      code: 'INTERNAL_ERROR',
      message: message ?? '内部エラーが発生しました',
      userMessage: '予期しないエラーが発生しました。サポートにお問い合わせください。',
      cause,
    })
  }
}