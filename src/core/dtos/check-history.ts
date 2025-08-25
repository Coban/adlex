import { z, ZodIssue } from 'zod'

/**
 * チェック履歴取得のクエリパラメータスキーマ
 */
export const GetCheckHistoryQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'ALL']).optional().default('ALL'),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  userId: z.string().optional(),
  organizationId: z.coerce.number().optional(),
  inputType: z.enum(['text', 'image']).optional(),
  dateFilter: z.enum(['today', 'week', 'month']).optional(),
})

/**
 * チェック履歴統計のクエリパラメータスキーマ
 */
export const GetCheckHistoryStatsQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month', 'year']).optional().default('month'),
  organizationId: z.coerce.number().optional()
})

/**
 * チェック履歴エクスポートのクエリパラメータスキーマ
 */
export const ExportCheckHistoryQuerySchema = z.object({
  format: z.enum(['csv', 'json', 'excel']).optional().default('csv'),
  search: z.string().optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  inputType: z.enum(['text', 'image']).optional(),
  dateFilter: z.enum(['today', 'week', 'month']).optional(),
  userId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
})

/**
 * チェック履歴取得のレスポンススキーマ
 */
export const GetCheckHistoryResponseSchema = z.object({
  checks: z.array(z.object({
    id: z.number(),
    originalText: z.string(),
    modifiedText: z.string().nullable(),
    status: z.enum(['pending', 'processing', 'completed', 'failed']),
    inputType: z.enum(['text', 'image']),
    violationCount: z.number(),
    processingTime: z.number().nullable(),
    createdAt: z.string(),
    updatedAt: z.string().nullable(),
    user: z.object({
      id: z.string(),
      email: z.string()
    }).nullable(),
    violations: z.array(z.object({
      id: z.number(),
      phrase: z.string(),
      category: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
      startPosition: z.number(),
      endPosition: z.number(),
      reasoning: z.string().nullable()
    })).optional()
  })),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean()
  })
})

/**
 * チェック履歴統計のレスポンススキーマ
 */
export const GetCheckHistoryStatsResponseSchema = z.object({
  totalChecks: z.number(),
  totalViolations: z.number(),
  averageViolationsPerCheck: z.number(),
  statusBreakdown: z.object({
    completed: z.number(),
    failed: z.number(),
    processing: z.number(),
    pending: z.number()
  }),
  violationTrends: z.array(z.object({
    date: z.string(),
    count: z.number(),
    violationCount: z.number()
  })),
  topViolationTypes: z.array(z.object({
    category: z.string(),
    count: z.number(),
    percentage: z.number()
  })),
  processingTimeStats: z.object({
    average: z.number(),
    median: z.number(),
    min: z.number(),
    max: z.number()
  })
})

/**
 * チェック履歴エクスポートのレスポンススキーマ
 */
export const ExportCheckHistoryResponseSchema = z.object({
  downloadUrl: z.string(),
  filename: z.string(),
  fileSize: z.number(),
  recordCount: z.number(),
  expiresAt: z.string()
})

// TypeScript型定義
export type GetCheckHistoryQuery = z.infer<typeof GetCheckHistoryQuerySchema>
export type GetCheckHistoryStatsQuery = z.infer<typeof GetCheckHistoryStatsQuerySchema>
export type ExportCheckHistoryQuery = z.infer<typeof ExportCheckHistoryQuerySchema>
export type GetCheckHistoryResponse = z.infer<typeof GetCheckHistoryResponseSchema>
export type GetCheckHistoryStatsResponse = z.infer<typeof GetCheckHistoryStatsResponseSchema>
export type ExportCheckHistoryResponse = z.infer<typeof ExportCheckHistoryResponseSchema>

/**
 * バリデーション結果型
 */
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } }

/**
 * バリデーション関数
 */
export function validateGetCheckHistoryQuery(data: unknown): ValidationResult<GetCheckHistoryQuery> {
  try {
    const result = GetCheckHistoryQuerySchema.parse(data)
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

export function validateGetCheckHistoryStatsQuery(data: unknown): ValidationResult<GetCheckHistoryStatsQuery> {
  try {
    const result = GetCheckHistoryStatsQuerySchema.parse(data)
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

export function validateExportCheckHistoryQuery(data: unknown): ValidationResult<ExportCheckHistoryQuery> {
  try {
    const result = ExportCheckHistoryQuerySchema.parse(data)
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
 * レスポンスヘルパー関数
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

/**
 * エラーコードからHTTPステータスコードを取得
 */
export function getStatusCodeFromError(code: string): number {
  switch (code) {
    case 'AUTHENTICATION_ERROR':
    case 'UNAUTHORIZED':
      return 401
    case 'AUTHORIZATION_ERROR':
    case 'FORBIDDEN':
      return 403
    case 'NOT_FOUND':
      return 404
    case 'VALIDATION_ERROR':
    case 'BAD_REQUEST':
      return 400
    case 'CONFLICT':
      return 409
    case 'INTERNAL_ERROR':
    default:
      return 500
  }
}