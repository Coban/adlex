/**
 * ドメインエラーのベースクラス
 */
export abstract class DomainError extends Error {
  abstract readonly code: string
  
  constructor(message: string, cause?: Error) {
    super(message)
    this.name = this.constructor.name
    this.cause = cause
  }
}

/**
 * 認証エラー
 */
export class AuthenticationError extends DomainError {
  readonly code = 'AUTHENTICATION_ERROR'
}

/**
 * 認可エラー
 */
export class AuthorizationError extends DomainError {
  readonly code = 'AUTHORIZATION_ERROR'
}

/**
 * バリデーションエラー
 */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR'
  
  constructor(message: string, public readonly field?: string, cause?: Error) {
    super(message, cause)
  }
}

/**
 * リソースが見つからないエラー
 */
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND_ERROR'
}

/**
 * 競合状態エラー
 */
export class ConflictError extends DomainError {
  readonly code = 'CONFLICT_ERROR'
}

/**
 * リポジトリエラー
 */
export class RepositoryError extends DomainError {
  readonly code = 'REPOSITORY_ERROR'
}

/**
 * 外部サービスエラー
 */
export class ExternalServiceError extends DomainError {
  readonly code = 'EXTERNAL_SERVICE_ERROR'
}