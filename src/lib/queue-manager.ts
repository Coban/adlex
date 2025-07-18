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
}

class CheckQueueManager {
  private queue: QueueItem[] = []
  private processing: Map<number, Promise<void>> = new Map()
  private maxConcurrent = 3
  private isProcessing = false

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent
  }

  /**
   * Add a check to the queue
   */
  async addToQueue(
    checkId: number,
    text: string,
    organizationId: number,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<void> {
    const queueItem: QueueItem = {
      id: checkId,
      text,
      organizationId,
      priority,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 2
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
        })
      }

      // Wait for at least one to complete if we're at max capacity
      if (this.processing.size >= this.maxConcurrent) {
        await Promise.race(this.processing.values())
        // Continue processing
        setTimeout(() => this.processQueue(), 100)
      }
    } finally {
      // Continue processing if there are more items
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 100)
      } else {
        this.isProcessing = false
      }
    }
  }

  /**
   * Process a single queue item
   */
  private async processItem(item: QueueItem): Promise<void> {
    const { processCheck } = await import('@/lib/check-processor')
    
    try {
      await processCheck(item.id, item.text, item.organizationId)
    } catch (error) {
      console.error(`[QUEUE] Error processing check ${item.id}:`, error)
      
      // Retry logic
      if (item.retryCount < item.maxRetries) {
        item.retryCount++
        console.log(`[QUEUE] Retrying check ${item.id} (attempt ${item.retryCount}/${item.maxRetries})`)
        
        // Add back to queue with delay
        setTimeout(() => {
          this.queue.push(item)
          if (!this.isProcessing) {
            this.processQueue()
          }
        }, Math.pow(2, item.retryCount) * 1000) // Exponential backoff
      } else {
        console.error(`[QUEUE] Max retries exceeded for check ${item.id}`)
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
    return {
      queueLength: this.queue.length,
      processingCount: this.processing.size,
      maxConcurrent: this.maxConcurrent
    }
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