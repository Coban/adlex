/**
 * 認証関連のDTO定義
 */

/**
 * サインアウトレスポンス
 */
export interface SignOutResponse {
  success: boolean
}

/**
 * エラーレスポンスを作成するヘルパー関数
 */
export function createErrorResponse(code: string, message: string, details?: unknown) {
  return {
    error: {
      code,
      message,
      details
    }
  }
}

/**
 * 成功レスポンスを作成するヘルパー関数
 */
export function createSuccessResponse<T>(data: T): T {
  return data
}