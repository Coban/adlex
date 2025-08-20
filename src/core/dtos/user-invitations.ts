import { z } from 'zod'

/**
 * 招待情報取得のクエリパラメータスキーマ
 */
export const GetInvitationInfoQuerySchema = z.object({
  token: z.string().min(1, '招待トークンが必要です')
})

/**
 * 招待情報のレスポンススキーマ
 */
export const InvitationInfoResponseSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'user']),
  organizationName: z.string()
})

// TypeScript型定義
export type GetInvitationInfoQuery = z.infer<typeof GetInvitationInfoQuerySchema>
export type InvitationInfoResponse = z.infer<typeof InvitationInfoResponseSchema>

/**
 * バリデーション結果型
 */
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } }

/**
 * クエリパラメータバリデーション関数
 */
export function validateGetInvitationInfoQuery(data: unknown): ValidationResult<GetInvitationInfoQuery> {
  try {
    const result = GetInvitationInfoQuerySchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.errors.map(e => e.message).join(', '),
          details: error.errors
        }
      }
    }
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'クエリパラメータのバリデーションエラーが発生しました'
      }
    }
  }
}

/**
 * 成功レスポンスを作成するヘルパー関数
 */
export function createSuccessResponse(data: InvitationInfoResponse) {
  return data
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