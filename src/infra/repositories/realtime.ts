import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

import { 
  CheckUpdateData, 
  FinalCheckData, 
  RealtimeError, 
  RealtimeRepository 
} from '@/core/ports/realtimeRepository'
import { Database } from '@/types/database.types'

/**
 * Supabase Realtime実装
 */
export class SupabaseRealtimeRepository implements RealtimeRepository {
  private channel: RealtimeChannel | null = null

  constructor(private supabase: SupabaseClient<Database>) {}

  async subscribeToCheckUpdates(params: {
    checkId: number
    onUpdate: (data: CheckUpdateData) => void
    onError: (error: RealtimeError) => void
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // 既存のチャンネルをクリーンアップ
      if (this.channel) {
        this.channel.unsubscribe()
      }

      // 新しいチャンネルを作成
      this.channel = this.supabase.channel(`check-updates-${params.checkId}`)

      if (!this.channel) {
        return { success: false, error: 'チャンネルの作成に失敗しました' }
      }

      // PostgreSQLの変更を監視
      this.channel.on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'checks',
        filter: `id=eq.${params.checkId}`
      }, (payload: { new: unknown; old: unknown; eventType: string }) => {
        const updatedCheck = payload.new as Database['public']['Tables']['checks']['Row']
        console.log(`[Realtime] Received update for check ${params.checkId}:`, {
          status: updatedCheck.status,
          completed_at: updatedCheck.completed_at,
          error_message: updatedCheck.error_message
        })
        
        // CheckUpdateData形式に変換
        const updateData: CheckUpdateData = {
          id: params.checkId,
          status: updatedCheck.status ?? 'unknown',
          input_type: updatedCheck.input_type,
          ocr_status: updatedCheck.ocr_status,
          extracted_text: updatedCheck.extracted_text,
          error_message: updatedCheck.error_message
        }

        console.log(`[Realtime] Calling onUpdate with status: ${updateData.status}`)
        params.onUpdate(updateData)
      })
      .subscribe(async (status, err) => {
        if (err) {
          console.error(`[Realtime] Subscription error for check ${params.checkId}:`, err)
          params.onError({
            message: 'リアルタイム更新の購読に失敗しました',
            code: 'SUBSCRIPTION_ERROR'
          })
        } else if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Successfully subscribed to check ${params.checkId} updates`)
        }
      })

      return { success: true }
    } catch (error) {
      console.error('[Realtime] Failed to subscribe to check updates:', error)
      return { 
        success: false, 
        error: 'チェック更新の購読に失敗しました' 
      }
    }
  }

  unsubscribe(): void {
    if (this.channel) {
      this.channel.unsubscribe()
      this.channel = null
    }
  }

  async getFinalCheckData(checkId: number): Promise<FinalCheckData | null> {
    try {
      // 違反情報を含む完全なチェックデータを取得
      const { data: checkData, error } = await this.supabase
        .from('checks')
        .select(`
          *,
          violations (
            id,
            start_pos,
            end_pos,
            reason,
            dictionary_id,
            dictionaries (
              id,
              phrase,
              category,
              notes
            )
          )
        `)
        .eq('id', checkId)
        .single()

      if (error || !checkData) {
        console.error(`[Realtime] Error fetching final data for check ${checkId}:`, error)
        return null
      }

      return {
        id: checkId,
        status: checkData.status ?? 'unknown',
        input_type: checkData.input_type,
        original_text: checkData.original_text,
        extracted_text: checkData.extracted_text,
        image_url: checkData.image_url,
        ocr_status: checkData.ocr_status,
        ocr_metadata: checkData.ocr_metadata as Record<string, unknown> | null,
        modified_text: checkData.modified_text,
        violations: checkData.violations,
        error_message: checkData.error_message,
        completed_at: checkData.completed_at
      }
    } catch (error) {
      console.error(`[Realtime] Unexpected error in getFinalCheckData for check ${checkId}:`, error)
      return null
    }
  }
}