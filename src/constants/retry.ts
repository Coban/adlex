/**
 * AdLex リトライ設定定数
 * ネットワーク処理やAPI呼び出しの再試行戦略を定義
 */

export const RETRY_CONFIG = {
  // リトライ基本設定
  MAX_ATTEMPTS: 3,              // 最大試行回数
  BASE_DELAY: 1000,             // 初期遅延時間（ミリ秒）
  EXPONENTIAL_BASE: 2,          // 指数バックオフの基数
  MAX_DELAY: 10000,             // 最大遅延時間（ミリ秒）
  
  // 操作別リトライ設定
  OPERATIONS: {
    // AI API呼び出し
    AI_REQUEST: {
      maxAttempts: 3,
      baseDelay: 2000,
      maxDelay: 15000,
      exponentialBase: 1.5
    },
    
    // データベース操作
    DATABASE: {
      maxAttempts: 2,
      baseDelay: 500,
      maxDelay: 2000,
      exponentialBase: 2
    },
    
    // メール送信
    EMAIL_SEND: {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 5000,
      exponentialBase: 2
    },
    
    // ファイルアップロード
    FILE_UPLOAD: {
      maxAttempts: 2,
      baseDelay: 1000,
      maxDelay: 5000,
      exponentialBase: 2
    },
    
    // SSE接続
    SSE_CONNECTION: {
      maxAttempts: 5,
      baseDelay: 1000,
      maxDelay: 8000,
      exponentialBase: 1.3
    }
  },
  
  // リトライ可能なHTTPステータスコード
  RETRYABLE_STATUS_CODES: [
    408, // Request Timeout
    429, // Too Many Requests
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504  // Gateway Timeout
  ],
  
  // リトライ可能なネットワークエラー
  RETRYABLE_ERRORS: [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'CONNECTION_ERROR',
    'SERVICE_UNAVAILABLE'
  ]
} as const

/**
 * 指数バックオフによる遅延時間を計算
 */
export function calculateBackoffDelay(
  attempt: number, 
  baseDelay: number = RETRY_CONFIG.BASE_DELAY,
  exponentialBase: number = RETRY_CONFIG.EXPONENTIAL_BASE,
  maxDelay: number = RETRY_CONFIG.MAX_DELAY
): number {
  const delay = baseDelay * Math.pow(exponentialBase, attempt - 1)
  return Math.min(delay, maxDelay)
}

/**
 * HTTPステータスコードがリトライ可能かチェック
 */
export function isRetryableStatusCode(statusCode: number): boolean {
  return (RETRY_CONFIG.RETRYABLE_STATUS_CODES as readonly number[]).includes(statusCode)
}

/**
 * エラーがリトライ可能かチェック
 */
export function isRetryableError(errorCode: string): boolean {
  return (RETRY_CONFIG.RETRYABLE_ERRORS as readonly string[]).includes(errorCode)
}