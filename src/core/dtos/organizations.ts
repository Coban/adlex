import { z } from 'zod'

/**
 * 組織取得APIのパラメータスキーマ
 */
export const GetOrganizationParamsSchema = z.object({
  id: z.string().uuid('有効な組織IDである必要があります')
})

/**
 * 組織更新APIのパラメータスキーマ
 */
export const UpdateOrganizationParamsSchema = z.object({
  id: z.string().uuid('有効な組織IDである必要があります')
})

/**
 * 組織更新APIのリクエストスキーマ
 */
export const UpdateOrganizationRequestSchema = z.object({
  name: z.string()
    .min(1, '組織名は1文字以上である必要があります')
    .max(100, '組織名は100文字以下である必要があります')
    .optional(),
  plan: z.enum(['trial', 'basic'], {
    errorMap: () => ({ message: 'プランは "trial" または "basic" である必要があります' })
  }).optional(),
  max_users: z.number()
    .int('最大ユーザー数は整数である必要があります')
    .positive('最大ユーザー数は正の数である必要があります')
    .optional(),
  max_checks_per_month: z.number()
    .int('月間最大チェック数は整数である必要があります')
    .positive('月間最大チェック数は正の数である必要があります')
    .optional()
})

/**
 * 組織更新APIのレスポンススキーマ
 */
export const UpdateOrganizationResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  plan: z.string(),
  max_users: z.number(),
  max_checks_per_month: z.number(),
  message: z.string()
})

// TypeScript型定義
export type GetOrganizationParams = z.infer<typeof GetOrganizationParamsSchema>
export type UpdateOrganizationParams = z.infer<typeof UpdateOrganizationParamsSchema>
export type UpdateOrganizationRequest = z.infer<typeof UpdateOrganizationRequestSchema>
export type UpdateOrganizationResponse = z.infer<typeof UpdateOrganizationResponseSchema>

/**
 * バリデーション結果型
 */
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } }

/**
 * バリデーション関数
 */
export function validateGetOrganizationParams(data: unknown): ValidationResult<GetOrganizationParams> {
  try {
    const result = GetOrganizationParamsSchema.parse(data)
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
        message: 'パラメータバリデーションエラーが発生しました'
      }
    }
  }
}

export function validateUpdateOrganizationParams(data: unknown): ValidationResult<UpdateOrganizationParams> {
  try {
    const result = UpdateOrganizationParamsSchema.parse(data)
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
        message: 'パラメータバリデーションエラーが発生しました'
      }
    }
  }
}

export function validateUpdateOrganizationRequest(data: unknown): ValidationResult<UpdateOrganizationRequest> {
  try {
    const result = UpdateOrganizationRequestSchema.parse(data)
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
        message: 'リクエストバリデーションエラーが発生しました'
      }
    }
  }
}

/**
 * レスポンスDTOを作成するヘルパー関数
 */
export function createSuccessResponse<T>(data: T): T {
  return data
}

export function createErrorResponse(code: string, message: string, details?: unknown) {
  return {
    error: {
      code,
      message,
      details
    }
  }
}