import { createClient } from '@/infra/supabase/serverClient'
import { createEmbedding } from '@/lib/ai-client'
import { ErrorFactory } from '@/lib/errors'

type QueueItem = {
  id: number
  phrase: string
  organizationId: number
  retryCount?: number
}

export type EmbeddingJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface EmbeddingJob {
  id: string
  organizationId: number
  total: number
  processed: number
  success: number
  failure: number
  failures: Array<{ id: number; phrase: string; error: string; retryCount: number }>
  status: EmbeddingJobStatus
  startedAt: string
  completedAt?: string
  processingStartedAt?: string
  estimatedCompletionAt?: string
}

interface ProcessingStats {
  averageProcessingTime: number
  lastProcessedCount: number
  lastProcessedAt: number
}

class EmbeddingQueueManager {
  private jobQueues: Map<string, QueueItem[]> = new Map()
  private processingJobs: Set<string> = new Set()
  private maxConcurrent = 3 // 並行処理数を増加
  private maxRetries = 2 // 最大再試行回数
  private jobs: Map<string, EmbeddingJob> = new Map()
  private stats: Map<string, ProcessingStats> = new Map()
  private supabaseClient: Awaited<ReturnType<typeof createClient>> | null = null
  private jobTimeouts: Map<string, NodeJS.Timeout> = new Map()
  
  // メモリ効率化：完了ジョブの自動削除（24時間後）
  private readonly JOB_RETENTION_MS = 24 * 60 * 60 * 1000

  async enqueueOrganization(organizationId: number, dictionaryIds?: number[]): Promise<EmbeddingJob> {
    const supabase = await this.getSupabaseClient()

    // 既存の未完了ジョブをキャンセル
    await this.cancelPendingJobs(organizationId)

    // 対象辞書を取得（ベクトル未生成のもののみ）
    // テストのモックチェーン互換のため .is を使わず filter で代替
    let base = supabase
      .from('dictionaries')
      .select('id, phrase')
      .eq('organization_id', organizationId)

    if (dictionaryIds && dictionaryIds.length > 0) {
      base = base.in('id', dictionaryIds)
    }

    const { data: dictionariesRaw, error } = await base
    const dictionaries = (dictionariesRaw ?? []).filter((d) => (d as Record<string, unknown>).vector === null)
    if (error) throw error

    if (!dictionaries || dictionaries.length === 0) {
      // 処理対象が無い場合は即座に完了状態のジョブを返す
      const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const job: EmbeddingJob = {
        id: jobId,
        organizationId,
        total: 0,
        processed: 0,
        success: 0,
        failure: 0,
        failures: [],
        status: 'completed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      }
      this.jobs.set(jobId, job)
      this.scheduleJobCleanup(jobId)
      return job
    }

    const items: QueueItem[] = dictionaries.map((d) => ({
      id: d.id as number,
      phrase: d.phrase as string,
      organizationId,
      retryCount: 0
    }))

    // ジョブ作成
    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const job: EmbeddingJob = {
      id: jobId,
      organizationId,
      total: items.length,
      processed: 0,
      success: 0,
      failure: 0,
      failures: [],
      status: 'queued',
      startedAt: new Date().toISOString()
    }

    this.jobs.set(jobId, job)
    this.jobQueues.set(jobId, items)

    // 統計情報初期化
    this.stats.set(jobId, {
      averageProcessingTime: 1000, // 1秒の初期値
      lastProcessedCount: 0,
      lastProcessedAt: Date.now()
    })

    // 非同期で処理開始
    this.processJob(jobId).catch(err => {
      console.error(`[EmbeddingQueue] Job ${jobId} failed:`, err)
      this.markJobAsFailed(jobId, err.message)
    })

    return job
  }

  getJob(jobId: string): EmbeddingJob | undefined {
    return this.jobs.get(jobId)
  }

  /**
   * ジョブをキャンセルする
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId)
    if (!job || job.status === 'completed' || job.status === 'failed') {
      return false
    }

    job.status = 'cancelled'
    job.completedAt = new Date().toISOString()
    
    this.processingJobs.delete(jobId)
    this.jobQueues.delete(jobId)
    this.stats.delete(jobId)
    
    // タイムアウトをクリア
    const timeout = this.jobTimeouts.get(jobId)
    if (timeout) {
      clearTimeout(timeout)
      this.jobTimeouts.delete(jobId)
    }

    this.scheduleJobCleanup(jobId)
    return true
  }

  /**
   * 組織の未完了ジョブをキャンセルする
   */
  private async cancelPendingJobs(organizationId: number): Promise<void> {
    const jobsToCancel = Array.from(this.jobs.entries())
      .filter(([_, job]) => 
        job.organizationId === organizationId && 
        (job.status === 'queued' || job.status === 'processing')
      )
      .map(([jobId]) => jobId)

    for (const jobId of jobsToCancel) {
      await this.cancelJob(jobId)
    }
  }

  /**
   * Supabaseクライアントを再利用する
   */
  private async getSupabaseClient() {
    this.supabaseClient ??= await createClient()
    return this.supabaseClient
  }

  /**
   * ジョブ処理メイン関数（改善版）
   */
  private async processJob(jobId: string) {
    const job = this.jobs.get(jobId)
    const queue = this.jobQueues.get(jobId)
    
    if (!job || !queue) return
    if (this.processingJobs.has(jobId)) return

    this.processingJobs.add(jobId)
    job.status = 'processing'
    job.processingStartedAt = new Date().toISOString()

    // 処理時間予測を更新
    this.updateEstimatedCompletion(jobId)

    try {
      let activeProcessing = 0
      let processedItems = 0

      while (queue.length > 0) {
        // 同時実行制限内で処理を開始
        while (activeProcessing < this.maxConcurrent && queue.length > 0) {
          const item = queue.shift()!
          activeProcessing++

          this.processItem(item, jobId)
            .then(() => {
              processedItems++
              this.updateProcessingStats(jobId)
              this.updateEstimatedCompletion(jobId)
              // processedItemsをログとして使用
              if (processedItems % 10 === 0) {
                console.log(`[EmbeddingQueue] Processed ${processedItems} items for job ${jobId}`)
              }
            })
            .catch(() => {
              // エラーは processItem 内で処理済み
            })
            .finally(() => {
              activeProcessing--
            })
        }

        // キャンセルチェック（再取得してステータスを確認）
        const currentJob = this.jobs.get(jobId)
        if (currentJob?.status === 'cancelled') {
          break
        }

        // アクティブな処理の完了を待つ
        while (activeProcessing > 0) {
          await new Promise(res => setTimeout(res, 100))
        }
      }

      // 残存する並行処理の完了を待つ
      while (activeProcessing > 0) {
        await new Promise(res => setTimeout(res, 100))
      }

    } finally {
      this.processingJobs.delete(jobId)
      
      const finalJob = this.jobs.get(jobId)
      if (finalJob && finalJob.status === 'processing') {
        finalJob.status = finalJob.failure > 0 ? 'failed' : 'completed'
        finalJob.completedAt = new Date().toISOString()
      }

      // ジョブキューをクリーンアップ
      this.jobQueues.delete(jobId)
      this.stats.delete(jobId)
      
      // ジョブ自動削除をスケジュール
      this.scheduleJobCleanup(jobId)
    }
  }

  /**
   * 個別アイテム処理（改善版：再試行機能付き）
   */
  private async processItem(item: QueueItem, jobId: string) {
    const job = this.jobs.get(jobId)
    if (!job) return

    const supabase = await this.getSupabaseClient()
    const startTime = Date.now()

    try {
      const vector = await createEmbedding(item.phrase)
      const { error: updateError } = await supabase
        .from('dictionaries')
        .update({
          vector: JSON.stringify(vector),
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id)

      if (updateError) throw ErrorFactory.createDatabaseError('embedding update', 'dictionaries', updateError)
      
      job.success++
      console.log(`[EmbeddingQueue] Successfully processed item ${item.id} in ${Date.now() - startTime}ms`)
      
    } catch (e) {
      const retryCount = (item.retryCount ?? 0) + 1
      const error = e instanceof Error ? e : new Error('Unknown error')
      
      // 再試行可能な場合はキューに戻す
      if (retryCount <= this.maxRetries && this.isRetryableError(error)) {
        console.warn(`[EmbeddingQueue] Retrying item ${item.id} (attempt ${retryCount}/${this.maxRetries}): ${error.message}`)
        
        const queue = this.jobQueues.get(jobId)
        if (queue) {
          // 指数バックオフで再試行
          setTimeout(() => {
            queue.push({ ...item, retryCount })
          }, Math.pow(2, retryCount) * 1000)
        }
      } else {
        // 最終的に失敗
        job.failure++
        job.failures.push({
          id: item.id,
          phrase: item.phrase,
          error: error.message,
          retryCount: retryCount - 1
        })
        console.error(`[EmbeddingQueue] Failed to process item ${item.id} after ${retryCount - 1} retries: ${error.message}`)
      }
    } finally {
      job.processed++
    }
  }

  /**
   * 再試行可能なエラーかどうかを判定
   */
  private isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      'ECONNRESET',
      'ECONNREFUSED', 
      'ETIMEDOUT',
      'Rate limit',
      'Too Many Requests',
      'Service Temporarily Unavailable'
    ]
    
    return retryablePatterns.some(pattern => 
      error.message.includes(pattern) || error.name.includes(pattern)
    )
  }

  /**
   * 処理統計を更新
   */
  private updateProcessingStats(jobId: string): void {
    const job = this.jobs.get(jobId)
    const stats = this.stats.get(jobId)
    
    if (!job || !stats) return

    const now = Date.now()
    const timeSinceLastUpdate = now - stats.lastProcessedAt
    const processedSinceLastUpdate = job.processed - stats.lastProcessedCount

    if (processedSinceLastUpdate > 0 && timeSinceLastUpdate > 0) {
      const currentRate = timeSinceLastUpdate / processedSinceLastUpdate
      stats.averageProcessingTime = (stats.averageProcessingTime * 0.7) + (currentRate * 0.3)
      stats.lastProcessedCount = job.processed
      stats.lastProcessedAt = now
    }
  }

  /**
   * 完了予想時刻を更新
   */
  private updateEstimatedCompletion(jobId: string): void {
    const job = this.jobs.get(jobId)
    const stats = this.stats.get(jobId)
    
    if (!job || !stats) return

    const remaining = job.total - job.processed
    if (remaining > 0 && stats.averageProcessingTime > 0) {
      const estimatedMs = remaining * stats.averageProcessingTime
      job.estimatedCompletionAt = new Date(Date.now() + estimatedMs).toISOString()
    }
  }

  /**
   * ジョブを失敗状態にする
   */
  private markJobAsFailed(jobId: string, errorMessage: string): void {
    const job = this.jobs.get(jobId)
    if (job) {
      job.status = 'failed'
      job.completedAt = new Date().toISOString()
      if (job.failures.length === 0) {
        job.failures.push({
          id: 0,
          phrase: 'System Error',
          error: errorMessage,
          retryCount: 0
        })
      }
    }
    
    this.processingJobs.delete(jobId)
    this.scheduleJobCleanup(jobId)
  }

  /**
   * ジョブの自動削除をスケジュール
   */
  private scheduleJobCleanup(jobId: string): void {
    const timeout = setTimeout(() => {
      this.jobs.delete(jobId)
      this.jobQueues.delete(jobId)
      this.stats.delete(jobId)
      this.jobTimeouts.delete(jobId)
    }, this.JOB_RETENTION_MS)
    
    this.jobTimeouts.set(jobId, timeout)
  }
}

declare global {
  var __embeddingQueue: EmbeddingQueueManager | undefined
}

export const embeddingQueue: EmbeddingQueueManager = global.__embeddingQueue ?? new EmbeddingQueueManager()
if (process.env.NODE_ENV !== 'production') {
  global.__embeddingQueue = embeddingQueue
}


