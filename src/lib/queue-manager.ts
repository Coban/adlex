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
    this.maxConcurrent = maxConcurrent
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

    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Queue] Added check ${checkId} (${inputType}) to queue. Queue length: ${this.queue.length}`)
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
          
          // Debug logging
          if (process.env.NODE_ENV === 'development') {
            console.log(`[Queue] Finished processing check ${item.id}. Processing count: ${this.processing.size}`)
          }
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
    const status = {
      queueLength: this.queue.length,
      processingCount: this.processing.size,
      maxConcurrent: this.maxConcurrent
    }
    
    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log('[Queue Status]', status)
    }
    
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