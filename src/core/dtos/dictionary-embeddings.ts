import { z } from 'zod'

/**
 * 辞書埋め込みリフレッシュAPIのリクエストDTO
 */
export const RefreshDictionaryEmbeddingsBodySchema = z.object({
  dictionaryIds: z.array(z.number()).optional()
})

/**
 * 辞書埋め込み統計取得APIのクエリパラメータDTO
 */
export const GetEmbeddingStatsQuerySchema = z.object({
  jobId: z.string().optional()
})

/**
 * 辞書埋め込みリフレッシュのレスポンスDTO
 */
export const RefreshEmbeddingsResponseSchema = z.object({
  message: z.string(),
  jobId: z.string().optional(),
  count: z.number().optional(),
  total: z.number().optional(),
  status: z.string().optional()
})

/**
 * 辞書埋め込み統計のレスポンスDTO
 */
export const EmbeddingStatsResponseSchema = z.object({
  organizationId: z.number(),
  totalItems: z.number(),
  itemsWithEmbedding: z.number(),
  itemsWithoutEmbedding: z.number(),
  embeddingCoverageRate: z.number()
})

/**
 * ジョブ進捗のレスポンスDTO
 */
export const JobProgressResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  total: z.number(),
  completed: z.number(),
  failed: z.number(),
  progress: z.number()
})

/**
 * API共通エラーレスポンス
 */
export const EmbeddingErrorResponseSchema = z.object({
  error: z.string(),
  details: z.string().optional()
})

// TypeScript型の定義
export type RefreshDictionaryEmbeddingsBody = z.infer<typeof RefreshDictionaryEmbeddingsBodySchema>
export type GetEmbeddingStatsQuery = z.infer<typeof GetEmbeddingStatsQuerySchema>
export type RefreshEmbeddingsResponse = z.infer<typeof RefreshEmbeddingsResponseSchema>
export type EmbeddingStatsResponse = z.infer<typeof EmbeddingStatsResponseSchema>
export type JobProgressResponse = z.infer<typeof JobProgressResponseSchema>
export type EmbeddingErrorResponse = z.infer<typeof EmbeddingErrorResponseSchema>

/**
 * DTOバリデーション用ヘルパー関数
 */
export function validateRefreshEmbeddingsBody(data: unknown): {
  success: true
  data: RefreshDictionaryEmbeddingsBody
} | {
  success: false
  error: { code: string; message: string; details?: unknown }
} {
  try {
    const validatedData = RefreshDictionaryEmbeddingsBodySchema.parse(data)
    return { success: true, data: validatedData }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '不正なリクエストボディです',
          details: error.issues
        }
      }
    }
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '不正なリクエストボディです'
      }
    }
  }
}

export function validateEmbeddingStatsQuery(data: unknown): {
  success: true
  data: GetEmbeddingStatsQuery
} | {
  success: false
  error: { code: string; message: string; details?: unknown }
} {
  try {
    const validatedData = GetEmbeddingStatsQuerySchema.parse(data)
    return { success: true, data: validatedData }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '不正なクエリパラメータです',
          details: error.issues
        }
      }
    }
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '不正なクエリパラメータです'
      }
    }
  }
}

/**
 * 成功レスポンス作成ヘルパー
 */
export function createRefreshSuccessResponse(
  data: RefreshEmbeddingsResponse
): { success: true; data: RefreshEmbeddingsResponse } {
  return { success: true, data }
}

export function createStatsSuccessResponse(
  data: EmbeddingStatsResponse
): { success: true; data: EmbeddingStatsResponse } {
  return { success: true, data }
}

export function createJobProgressSuccessResponse(
  data: JobProgressResponse
): { success: true; data: JobProgressResponse } {
  return { success: true, data }
}

/**
 * エラーレスポンス作成ヘルパー
 */
export function createEmbeddingErrorResponse(
  code: string,
  message: string,
  details?: string
): { success: false; error: EmbeddingErrorResponse } {
  return {
    success: false,
    error: { error: message, details }
  }
}