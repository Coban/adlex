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
  private maxConcurrent = 3
  private isProcessing = false

  constructor(maxConcurrent = 3) {
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

    // Item added to queue

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue()
    }
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return
    this.isProcessing = true

    try {
      while (this.queue.length > 0 && this.processing.size < this.maxConcurrent) {
        const item = this.queue.shift()
        if (!item) continue

        // Start processing this item
        const processingPromise = this.processItem(item)
        this.processing.set(item.id, processingPromise)

        // Clean up when done
        processingPromise.finally(() => {
          this.processing.delete(item.id)
          
          // Processing completed
        })
      }

      // Wait for at least one to complete if we're at max capacity
      if (this.processing.size >= this.maxConcurrent) {
        await Promise.race(this.processing.values())
        // Continue processing
        setTimeout(() => this.processQueue(), 100)
      }
    } finally {
      // Only set isProcessing to false when both queue and processing are empty
      if (this.queue.length === 0 && this.processing.size === 0) {
        this.isProcessing = false
      }
      
      // Continue processing if there are more items and capacity
      if (this.queue.length > 0 && this.processing.size < this.maxConcurrent) {
        setTimeout(() => this.processQueue(), 100)
      }
    }
  }

  /**
   * Process a single queue item
   */
  private async processItem(item: QueueItem): Promise<void> {
    const { processCheck } = await import('@/lib/check-processor')
    
    try {
      await processCheck(item.id, item.text, item.organizationId, item.inputType, item.imageUrl)
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
          
          if (!this.isProcessing) {
            this.processQueue()
          }
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
}

// Global queue manager instance
export const queueManager = new CheckQueueManager(3)

// Export for testing
export { CheckQueueManager } 