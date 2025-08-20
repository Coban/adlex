import { z } from 'zod'

/**
 * 画像アップロードのレスポンススキーマ
 */
export const UploadImageResponseSchema = z.object({
  signedUrl: z.string().url()
})

// TypeScript型定義
export type UploadImageResponse = z.infer<typeof UploadImageResponseSchema>

/**
 * バリデーション結果型
 */
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } }

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