/**
 * リアルタイム通信のリポジトリインターフェース
 * Supabase Realtimeやその他のリアルタイム技術の抽象化
 */
export interface RealtimeRepository {
  /**
   * チェック更新の購読開始
   */
  subscribeToCheckUpdates(params: {
    checkId: number
    onUpdate: (data: CheckUpdateData) => void
    onError: (error: RealtimeError) => void
  }): Promise<{ success: boolean; error?: string }>

  /**
   * 購読の停止
   */
  unsubscribe(): void

  /**
   * チェックの最終データを取得
   */
  getFinalCheckData(checkId: number): Promise<FinalCheckData | null>
}

/**
 * チェック更新データ
 */
export interface CheckUpdateData {
  id: number
  status: string
  input_type?: string | null
  ocr_status?: string | null
  extracted_text?: string | null
  error_message?: string | null
}

/**
 * リアルタイムエラー
 */
export interface RealtimeError {
  message: string
  code?: string
}

/**
 * 最終チェックデータ
 */
export interface FinalCheckData {
  id: number
  status: string
  input_type?: string | null
  original_text?: string | null
  extracted_text?: string | null
  image_url?: string | null
  ocr_status?: string | null
  ocr_metadata?: Record<string, unknown> | null
  modified_text?: string | null
  violations?: Record<string, unknown>[]
  error_message?: string | null
  completed_at?: string | null
}