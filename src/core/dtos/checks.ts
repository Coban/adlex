import { z, ZodIssue } from 'zod'

/**
 * チェック作成APIのリクエストスキーマ
 */
export const CreateCheckRequestSchema = z.object({
  text: z.string()
    .min(1, 'テキストは1文字以上である必要があります')
    .max(10000, 'テキストは10,000文字以下である必要があります'),
  inputType: z.enum(['text', 'image'], {
    message: '入力タイプは "text" または "image" である必要があります'
  }),
  fileName: z.string().optional()
})

/**
 * チェック作成APIのレスポンススキーマ
 */
export const CreateCheckResponseSchema = z.object({
  checkId: z.number(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  message: z.string().optional()
})

/**
 * チェック取得APIのレスポンススキーマ
 */
export const GetCheckResponseSchema = z.object({
  id: z.number(),
  userId: z.string(),
  organizationId: z.number(),
  originalText: z.string(),
  modifiedText: z.string().nullable(),
  inputType: z.enum(['text', 'image']),
  fileName: z.string().nullable(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  violations: z.array(z.object({
    id: z.number(),
    startPos: z.number(),
    endPos: z.number(),
    reason: z.string(),
    dictionaryId: z.number().nullable(),
    phrase: z.string().optional(),
    category: z.string().optional()
  })).optional()
})

/**
 * チェックPDF生成APIのパラメータスキーマ
 */
export const GenerateCheckPdfParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, '有効なチェックIDである必要があります')
})

/**
 * エラーレスポンススキーマ
 */
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional()
  })
})

// TypeScript型定義
export type CreateCheckRequest = z.infer<typeof CreateCheckRequestSchema>
export type CreateCheckResponse = z.infer<typeof CreateCheckResponseSchema>
export type GetCheckResponse = z.infer<typeof GetCheckResponseSchema>
export type GenerateCheckPdfParams = z.infer<typeof GenerateCheckPdfParamsSchema>
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>

/**
 * DTOバリデーション結果
 */
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } }

/**
 * リクエストDTOをバリデーションするヘルパー関数
 */
export function validateCreateCheckRequest(data: unknown): ValidationResult<CreateCheckRequest> {
  try {
    const result = CreateCheckRequestSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues.map((e: ZodIssue) => e.message).join(', '),
          details: error.issues
        }
      }
    }
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'バリデーションエラーが発生しました'
      }
    }
  }
}

export function validateGenerateCheckPdfParams(data: unknown): ValidationResult<GenerateCheckPdfParams> {
  try {
    const result = GenerateCheckPdfParamsSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues.map((e: ZodIssue) => e.message).join(', '),
          details: error.issues
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

/**
 * レスポンスDTOを作成するヘルパー関数
 */
export function createSuccessResponse<T>(data: T): T {
  return data
}

export function createErrorResponse(code: string, message: string, details?: unknown): ErrorResponse {
  return {
    error: {
      code,
      message,
      details
    }
  }
}