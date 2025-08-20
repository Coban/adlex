import { z } from 'zod'

/**
 * チェックストリーミングAPIのパラメータスキーマ
 */
export const StreamCheckUpdatesParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, '有効なチェックIDである必要があります')
})

/**
 * ストリーミングイベントの種類
 */
export enum StreamEventType {
  Progress = 'progress',
  Status = 'status',
  Violation = 'violation',
  Complete = 'complete',
  Error = 'error',
  Heartbeat = 'heartbeat'
}

/**
 * ストリーミングイベントのスキーマ
 */
export const StreamEventSchema = z.object({
  type: z.nativeEnum(StreamEventType),
  data: z.any(),
  timestamp: z.string()
})

// TypeScript型定義
export type StreamCheckUpdatesParams = z.infer<typeof StreamCheckUpdatesParamsSchema>
export type StreamEvent = z.infer<typeof StreamEventSchema>

/**
 * バリデーション結果型
 */
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } }

/**
 * パラメータバリデーション関数
 */
export function validateStreamCheckUpdatesParams(data: unknown): ValidationResult<StreamCheckUpdatesParams> {
  try {
    const result = StreamCheckUpdatesParamsSchema.parse(data)
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
 * SSEフォーマットでイベントを送信するための関数
 */
export function formatSSEMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}