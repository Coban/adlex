import { z } from 'zod'

/**
 * 辞書統計取得のレスポンスDTO
 */
export const DictionaryStatsResponseSchema = z.object({
  totals: z.object({
    total: z.number(),
    ng: z.number(),
    allow: z.number()
  }),
  topUsed: z.array(z.object({
    dictionary_id: z.number(),
    count: z.number(),
    phrase: z.string()
  })),
  since: z.string()
})

/**
 * API共通エラーレスポンス
 */
export const DictionaryStatsErrorResponseSchema = z.object({
  error: z.string(),
  details: z.string().optional()
})

// TypeScript型の定義
export type DictionaryStatsResponse = z.infer<typeof DictionaryStatsResponseSchema>
export type DictionaryStatsErrorResponse = z.infer<typeof DictionaryStatsErrorResponseSchema>

/**
 * 成功レスポンス作成ヘルパー
 */
export function createDictionaryStatsSuccessResponse(
  data: DictionaryStatsResponse
): { success: true; data: DictionaryStatsResponse } {
  return { success: true, data }
}

/**
 * エラーレスポンス作成ヘルパー
 */
export function createDictionaryStatsErrorResponse(
  code: string,
  message: string,
  details?: string
): { success: false; error: DictionaryStatsErrorResponse } {
  return {
    success: false,
    error: { error: message, details }
  }
}