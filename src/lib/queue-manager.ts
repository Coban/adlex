/**
 * Queue Manager for Check Processing
 * Handles concurrent check processing with proper queue management
 */

/**
 * キューに格納される処理対象の情報。
 *
 * - `priority` により追加時の挿入位置を制御
 * - `retryCount`/`maxRetries` により再試行ロジックを制御
 */
interface QueueItem {
  id: number
  text: string
  organizationId: number
  priority: 'high' | 'normal' | 'low'
  createdAt: Date
  retryCount: number
  maxRetries: number
  inputType?: 'text' | 'image'
  imageUrl?: string
}

/**
 * チェック処理のための簡易キューマネージャ。
 *
 * 機能:
 * - 優先度付きキューへの追加
 * - 上限同時実行数の管理とシリアライズ
 * - 再試行（指数バックオフ）と失敗時のDB更新
 */
class CheckQueueManager {
  private queue: QueueItem[] = []
  private processing: Map<number, Promise<void>> = new Map()
  private maxConcurrent = 2 // AI API遅延回避のため並行数を削減
  private isProcessing = false

  constructor(maxConcurrent = 2) { // デフォルト値も2に変更
    const fromEnv = Number(process.env.ADLEX_MAX_CONCURRENT_CHECKS)
    this.maxConcurrent = Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : maxConcurrent
  }

  /**
   * Add a check to the queue
   */
  /**
   * キューへ新規チェックを追加する。
   *
   * - 優先度に応じて `unshift` か `push`
   * - 非処理中であれば処理ループを開始
   */
  async addToQueue(
    checkId: number,
    text: string,
    organizationId: number,
    priority: 'high' | 'normal' | 'low' = 'normal',
    inputType: 'text' | 'image' = 'text',
    imageUrl?: string
  ): Promise<void> {
    const queueItem: QueueItem = {
      id: checkId,
      text,
      organizationId,
      priority,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 2,
      inputType,
      imageUrl
    }

    // Insert based on priority
    if (priority === 'high') {
      this.queue.unshift(queueItem)
    } else {
      this.queue.push(queueItem)
    }

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue()
    }
  }

  /**
   * Process the queue
   */
  /**
   * キュー全体の処理ループ。
   *
   * - 既に処理中ならスキップ
   * - 空きがある限り新規アイテムを `processItem` で処理
   * - 1件完了まで待機し、残件があれば再スケジューリング
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return
    }
    this.isProcessing = true

    try {
      // 利用可能な容量がある限り新しいアイテムを処理開始
      while (this.queue.length > 0 && this.processing.size < this.maxConcurrent) {
        const item = this.queue.shift()
        if (!item) continue
        const processingPromise = this.processItem(item)
        this.processing.set(item.id, processingPromise)

        // 処理完了時のクリーンアップ
        processingPromise.finally(() => {
          this.processing.delete(item.id)
          
          // 処理完了後、キューに残りがあれば再度処理開始
          if (this.queue.length > 0 && !this.isProcessing) {
            setTimeout(() => this.processQueue(), 50)
          }
        })
      }

      // 最大容量に達している場合、1つ完了するまで待機
      if (this.processing.size >= this.maxConcurrent && this.processing.size > 0) {
        await Promise.race(this.processing.values())
        // 処理継続 - 再帰呼び出しで状態を確認
        if (this.queue.length > 0) {
          setTimeout(() => this.processQueue(), 100)
        }
      }
    } catch (error) {
      console.error('[QUEUE] キュー処理中にエラーが発生しました:', error)
    } finally {
      // 確実にisProcessingフラグをリセット
      // キューが空または処理中のアイテムがない場合のみリセット
      if (this.queue.length === 0 && this.processing.size === 0) {
        this.isProcessing = false
      } else {
        // まだ処理すべきアイテムがある場合は状態を維持
        this.isProcessing = false // 次の処理サイクルのためにリセット
        
        // 残りのアイテムがある場合は次の処理を予約
        if (this.queue.length > 0) {
          setTimeout(() => this.processQueue(), 100)
        }
      }
    }
  }

  /**
   * Process a single queue item
   */
  /**
   * 個々のキューアイテムを処理する。
   *
   * - `processCheck` を呼び出して本処理を実施
   * - 失敗時は指数バックオフで再試行（上限超過で `checks.status='failed'`）
   */
  private async processItem(item: QueueItem): Promise<void> {
    const { processCheck } = await import('@/lib/check-processor')
    
    try {
      await processCheck(item.id, item.text, item.organizationId, item.inputType, item.imageUrl)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明な処理エラー'
      console.error(`[QUEUE] チェック ${item.id} の処理でエラーが発生しました:`, {
        error: errorMessage,
        inputType: item.inputType,
        textLength: item.text.length,
        retryCount: item.retryCount,
        organizationId: item.organizationId
      })
      
      // Retry logic with exponential backoff
      if (item.retryCount < item.maxRetries) {
        item.retryCount++
        const retryDelay = Math.min(Math.pow(2, item.retryCount) * 1000, 30000) // Max 30s delay
        
        // Scheduling retry with exponential backoff
        
        setTimeout(() => {
          // Add back to queue with higher priority for retries
          const retryPriority: 'high' | 'normal' | 'low' = item.retryCount >= 2 ? 'high' : item.priority
          this.queue.unshift({ ...item, priority: retryPriority })
          
          // 確実にキューの再処理を開始
          setTimeout(() => this.processQueue(), 50)
        }, retryDelay)
      } else {
        console.error(`[QUEUE] チェック ${item.id} はリトライ上限に達しました（失敗としてマーク）`)
        
        // Mark check as permanently failed
        try {
          const { createClient } = await import('@/infra/supabase/serverClient')
          const supabase = await createClient()
          
          await supabase
            .from('checks')
            .update({ 
              status: 'failed',
              error_message: `処理に失敗しました (${item.retryCount}回再試行済み): ${errorMessage}`,
              completed_at: new Date().toISOString()
            })
            .eq('id', item.id)
            
        } catch (updateError) {
          console.error(`[QUEUE] チェック ${item.id} を失敗として更新できませんでした:`, updateError)
        }
      }
    }
  }

  /**
   * Get queue status
   */
  /**
   * 現在のキュー状況を返す（監視/テスト用）。
   */
  getStatus(): {
    queueLength: number
    processingCount: number
    maxConcurrent: number
  } {
    const status = {
      queueLength: this.queue.length,
      processingCount: this.processing.size,
      maxConcurrent: this.maxConcurrent
    }
    
    // Return current queue status
    
    return status
  }

  /**
   * Clear the queue (for testing)
   */
  /**
   * キューをクリア（テスト・復旧用）。
   */
  clear(): void {
    this.queue = []
    this.processing.clear()
    this.isProcessing = false
  }
  /**
   * デバッグ用: キューの現在状態を出力
   */
  /**
   * デバッグ用: 現在のキュー詳細を返す。
   */
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      processingCount: this.processing.size,
      isProcessing: this.isProcessing,
      maxConcurrent: this.maxConcurrent,
      queueItems: this.queue.map(item => ({
        id: item.id,
        priority: item.priority,
        retryCount: item.retryCount
      })),
      processingItems: Array.from(this.processing.keys())
    }
  }

  /**
   * 強制的にキュー処理を再開（デバッグ用）
   */
  /**
   * 強制再開（デバッグ用途）。
   */
  forceRestart() {
    this.isProcessing = false
    setTimeout(() => this.processQueue(), 100)
  }
}

// Global queue manager instance
export const queueManager = new CheckQueueManager(3)

// Export for testing
export { CheckQueueManager } 