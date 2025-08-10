/**
 * Queue Manager for Check Processing
 * Handles concurrent check processing with proper queue management
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

    console.log(`[QUEUE] Added check ${checkId} to queue (priority: ${priority}, type: ${inputType})`)

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue()
    }
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      console.log('[QUEUE] Already processing, skipping')
      return
    }
    this.isProcessing = true
    console.log(`[QUEUE] Starting queue processing (queue: ${this.queue.length}, processing: ${this.processing.size})`)

    try {
      // 利用可能な容量がある限り新しいアイテムを処理開始
      while (this.queue.length > 0 && this.processing.size < this.maxConcurrent) {
        const item = this.queue.shift()
        if (!item) continue

        console.log(`[QUEUE] Starting processing check ${item.id} (${this.processing.size + 1}/${this.maxConcurrent})`)
        const processingPromise = this.processItem(item)
        this.processing.set(item.id, processingPromise)

        // 処理完了時のクリーンアップ
        processingPromise.finally(() => {
          console.log(`[QUEUE] Completed processing check ${item.id}`)
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
      console.error('[QUEUE] Error in processQueue:', error)
    } finally {
      // 確実にisProcessingフラグをリセット
      // キューが空または処理中のアイテムがない場合のみリセット
      if (this.queue.length === 0 && this.processing.size === 0) {
        console.log('[QUEUE] Queue processing completed - resetting isProcessing flag')
        this.isProcessing = false
      } else {
        // まだ処理すべきアイテムがある場合は状態を維持
        console.log(`[QUEUE] Queue processing paused (queue: ${this.queue.length}, processing: ${this.processing.size})`)
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
  private async processItem(item: QueueItem): Promise<void> {
    console.log(`[QUEUE] Processing check ${item.id} (attempt ${item.retryCount + 1}/${item.maxRetries + 1})`)
    const { processCheck } = await import('@/lib/check-processor')
    
    try {
      await processCheck(item.id, item.text, item.organizationId, item.inputType, item.imageUrl)
      console.log(`[QUEUE] Successfully processed check ${item.id}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown processing error'
      console.error(`[QUEUE] Error processing check ${item.id}:`, {
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
          console.log(`[QUEUE] Retry queued for check ${item.id}, restarting queue processing`)
          setTimeout(() => this.processQueue(), 50)
        }, retryDelay)
      } else {
        console.error(`[QUEUE] Max retries exceeded for check ${item.id}, marking as failed`)
        
        // Mark check as permanently failed
        try {
          const { createClient } = await import('@/lib/supabase/server')
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
          console.error(`[QUEUE] Failed to mark check ${item.id} as failed:`, updateError)
        }
      }
    }
  }

  /**
   * Get queue status
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
  clear(): void {
    this.queue = []
    this.processing.clear()
    this.isProcessing = false
  }
  /**
   * デバッグ用: キューの現在状態を出力
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
  forceRestart() {
    console.log('[QUEUE] Force restarting queue processing')
    this.isProcessing = false
    setTimeout(() => this.processQueue(), 100)
  }
}

// Global queue manager instance
export const queueManager = new CheckQueueManager(3)

// Export for testing
export { CheckQueueManager } 