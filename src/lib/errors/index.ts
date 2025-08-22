/**
 * AdLex統一エラーハンドリングシステム
 * アプリケーション全体で一貫したエラー処理を提供
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public cause?: Error
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, 'VALIDATION_ERROR', 400, cause)
  }
}

export class NetworkError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, 'NETWORK_ERROR', 503, cause)
  }
}

export class ProcessingError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, 'PROCESSING_ERROR', 500, cause)
  }
}

export class UserFacingError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, 'USER_FACING_ERROR', 400, cause)
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, 'AUTH_ERROR', 401, cause)
  }
}

export class TimeoutError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, 'TIMEOUT_ERROR', 408, cause)
  }
}