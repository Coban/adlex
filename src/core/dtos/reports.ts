import { z } from 'zod'

/**
 * カスタムレポート生成APIのリクエストスキーマ
 */
export const GenerateCustomReportRequestSchema = z.object({
  checkIds: z.array(z.number().positive('チェックIDは正の数である必要があります'))
    .min(1, 'チェックIDが必要です'),
  format: z.enum(['pdf', 'excel'], {
    errorMap: () => ({ message: 'フォーマットは \"pdf\" または \"excel\" である必要があります' })
  }),
  template: z.string().optional(),
  includeStats: z.boolean().default(true),
  includeSummary: z.boolean().default(true), 
  includeDetails: z.boolean().default(true),
  title: z.string().optional()
})

// TypeScript型定義
export type GenerateCustomReportRequest = z.infer<typeof GenerateCustomReportRequestSchema>

/**
 * バリデーション結果型
 */
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } }

/**
 * リクエストDTOをバリデーションするヘルパー関数
 */
export function validateGenerateCustomReportRequest(data: unknown): ValidationResult<GenerateCustomReportRequest> {
  try {
    const result = GenerateCustomReportRequestSchema.parse(data)
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
        message: 'バリデーションエラーが発生しました'
      }
    }
  }
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