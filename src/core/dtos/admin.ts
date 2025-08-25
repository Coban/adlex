import { z, ZodIssue } from 'zod'

/**
 * Admin 統計取得のクエリパラメータスキーマ
 */
export const GetAdminStatsQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month', 'year']).optional().default('month'),
  organizationId: z.coerce.number().optional()
})

/**
 * Admin パフォーマンス取得のクエリパラメータスキーマ
 */
export const GetAdminPerformanceQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month']).optional().default('day'),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  organizationId: z.coerce.number().optional()
})

/**
 * Admin 統計のレスポンススキーマ
 */
export const GetAdminStatsResponseSchema = z.object({
  totalUsers: z.number(),
  totalOrganizations: z.number(),
  totalChecks: z.number(),
  totalViolations: z.number(),
  checksThisPeriod: z.number(),
  violationsThisPeriod: z.number(),
  averageCheckTime: z.number(),
  topOrganizations: z.array(z.object({
    id: z.number(),
    name: z.string(),
    checkCount: z.number(),
    violationCount: z.number()
  })),
  systemHealth: z.object({
    status: z.enum(['healthy', 'warning', 'critical']),
    uptime: z.number(),
    memoryUsage: z.number(),
    responseTime: z.number()
  })
})

/**
 * Admin パフォーマンスのレスポンススキーマ
 */
export const GetAdminPerformanceResponseSchema = z.object({
  metrics: z.array(z.object({
    timestamp: z.string(),
    responseTime: z.number(),
    throughput: z.number(),
    errorRate: z.number(),
    memoryUsage: z.number(),
    cpuUsage: z.number()
  })),
  summary: z.object({
    averageResponseTime: z.number(),
    averageThroughput: z.number(),
    averageErrorRate: z.number(),
    peakResponseTime: z.number(),
    peakThroughput: z.number()
  }),
  alerts: z.array(z.object({
    type: z.enum(['performance', 'error', 'resource']),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    message: z.string(),
    timestamp: z.string()
  }))
})

// TypeScript型定義
export type GetAdminStatsQuery = z.infer<typeof GetAdminStatsQuerySchema>
export type GetAdminPerformanceQuery = z.infer<typeof GetAdminPerformanceQuerySchema>
export type GetAdminStatsResponse = z.infer<typeof GetAdminStatsResponseSchema>
export type GetAdminPerformanceResponse = z.infer<typeof GetAdminPerformanceResponseSchema>

/**
 * バリデーション結果型
 */
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } }

/**
 * バリデーション関数
 */
export function validateGetAdminStatsQuery(data: unknown): ValidationResult<GetAdminStatsQuery> {
  try {
    const result = GetAdminStatsQuerySchema.parse(data)
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

export function validateGetAdminPerformanceQuery(data: unknown): ValidationResult<GetAdminPerformanceQuery> {
  try {
    const result = GetAdminPerformanceQuerySchema.parse(data)
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