import { z, ZodIssue } from 'zod'

/**
 * 辞書作成APIのリクエストスキーマ
 */
export const CreateDictionaryRequestSchema = z.object({
  phrase: z.string()
    .min(1, '語句は1文字以上である必要があります')
    .max(200, '語句は200文字以下である必要があります'),
  category: z.enum(['NG', 'ALLOW'], {
    message: 'カテゴリは "NG" または "ALLOW" である必要があります'
  }),
  reasoning: z.string()
    .max(1000, '理由は1000文字以下である必要があります')
    .optional()
})

/**
 * 辞書一覧取得のクエリパラメータスキーマ
 */
export const GetDictionariesQuerySchema = z.object({
  search: z.string().optional(),
  category: z.enum(['NG', 'ALLOW', 'ALL']).optional().default('ALL')
})

/**
 * 辞書作成APIのレスポンススキーマ
 */
export const CreateDictionaryResponseSchema = z.object({
  dictionaryId: z.number(),
  phrase: z.string(),
  category: z.string(),
  message: z.string()
})

/**
 * 辞書一括更新のリクエストスキーマ
 */
export const BulkUpdateDictionariesRequestSchema = z.object({
  updates: z.array(z.object({
    id: z.number().positive('辞書IDは正の数である必要があります'),
    patch: z.object({
      phrase: z.string().min(1, 'フレーズは1文字以上である必要があります').optional(),
      category: z.enum(['NG', 'ALLOW'], {
        message: 'カテゴリは "NG" または "ALLOW" である必要があります'
      }).optional(),
      notes: z.string().nullable().optional()
    })
  })).min(1, '更新対象が必要です')
})

/**
 * 辞書一括更新のレスポンススキーマ
 */
export const BulkUpdateDictionariesResponseSchema = z.object({
  success: z.number(),
  failure: z.number(),
  message: z.string()
})

/**
 * 辞書インポートのリクエストスキーマ
 */
export const ImportDictionariesRequestSchema = z.object({
  // Content-Typeがtext/csvの場合、bodyは直接CSVテキスト
  // 他の形式は将来の拡張用
})

/**
 * 辞書インポートのレスポンススキーマ
 */
export const ImportDictionariesResponseSchema = z.object({
  inserted: z.number(),
  skipped: z.number(),
  message: z.string(),
  errors: z.array(z.string()).optional(),
  details: z.object({
    skippedItems: z.array(z.object({
      phrase: z.string(),
      reason: z.string()
    }))
  }).optional()
})

/**
 * 辞書エクスポートのクエリパラメータスキーマ
 */
export const ExportDictionariesQuerySchema = z.object({
  format: z.enum(['csv']).optional().default('csv')
})

/**
 * 辞書一覧取得のレスポンススキーマ
 */
export const GetDictionariesResponseSchema = z.object({
  dictionaries: z.array(z.object({
    id: z.number(),
    phrase: z.string(),
    category: z.string(),
    notes: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string().nullable()
  })),
  total: z.number()
})

// TypeScript型定義
export type CreateDictionaryRequest = z.infer<typeof CreateDictionaryRequestSchema>
export type GetDictionariesQuery = z.infer<typeof GetDictionariesQuerySchema>
export type BulkUpdateDictionariesRequest = z.infer<typeof BulkUpdateDictionariesRequestSchema>
export type ImportDictionariesRequest = z.infer<typeof ImportDictionariesRequestSchema>
export type CreateDictionaryResponse = z.infer<typeof CreateDictionaryResponseSchema>
export type BulkUpdateDictionariesResponse = z.infer<typeof BulkUpdateDictionariesResponseSchema>
export type ImportDictionariesResponse = z.infer<typeof ImportDictionariesResponseSchema>
export type ExportDictionariesQuery = z.infer<typeof ExportDictionariesQuerySchema>
export type GetDictionariesResponse = z.infer<typeof GetDictionariesResponseSchema>

/**
 * バリデーション結果型
 */
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } }

/**
 * リクエストDTOをバリデーションするヘルパー関数
 */
export function validateCreateDictionaryRequest(data: unknown): ValidationResult<CreateDictionaryRequest> {
  try {
    const result = CreateDictionaryRequestSchema.parse(data)
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

export function validateGetDictionariesQuery(data: unknown): ValidationResult<GetDictionariesQuery> {
  try {
    const result = GetDictionariesQuerySchema.parse(data)
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

export function validateBulkUpdateDictionariesRequest(data: unknown): ValidationResult<BulkUpdateDictionariesRequest> {
  try {
    const result = BulkUpdateDictionariesRequestSchema.parse(data)
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

export function validateImportDictionariesRequest(data: unknown): ValidationResult<ImportDictionariesRequest> {
  try {
    const result = ImportDictionariesRequestSchema.parse(data)
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

export function validateExportDictionariesQuery(data: unknown): ValidationResult<ExportDictionariesQuery> {
  try {
    const result = ExportDictionariesQuerySchema.parse(data)
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