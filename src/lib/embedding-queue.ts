import { createEmbedding } from '@/lib/ai-client'
import { createClient } from '@/lib/supabase/server'

type QueueItem = {
  id: number
  phrase: string
  organizationId: number
}

export type EmbeddingJobStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface EmbeddingJob {
  id: string
  organizationId: number
  total: number
  processed: number
  success: number
  failure: number
  failures: Array<{ id: number; phrase: string; error: string }>
  status: EmbeddingJobStatus
  startedAt: string
  completedAt?: string
}

class EmbeddingQueueManager {
  private queue: QueueItem[] = []
  private processing = false
  private maxConcurrent = 2
  private active = 0
  private jobs: Map<string, EmbeddingJob> = new Map()

  async enqueueOrganization(organizationId: number, dictionaryIds?: number[]): Promise<EmbeddingJob> {
    const supabase = await createClient()

    // Fetch target dictionaries
    let query = supabase
      .from('dictionaries')
      .select('id, phrase')
      .eq('organization_id', organizationId)

    if (dictionaryIds && dictionaryIds.length > 0) {
      query = query.in('id', dictionaryIds)
    }

    const { data: dictionaries, error } = await query
    if (error) throw error

    const items: QueueItem[] = (dictionaries ?? []).map(d => ({
      id: d.id as number,
      phrase: d.phrase as string,
      organizationId
    }))

    // Create job
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

    // Enqueue items
    this.queue.push(...items)

    // Start processing
    this.process(jobId).catch(err => {
      const j = this.jobs.get(jobId)
      if (j) {
        j.status = 'failed'
        j.completedAt = new Date().toISOString()
      }
      console.error('[EmbeddingQueue] Job failed:', err)
    })

    return job
  }

  getJob(jobId: string): EmbeddingJob | undefined {
    return this.jobs.get(jobId)
  }

  private async process(jobId: string) {
    const job = this.jobs.get(jobId)
    if (!job) return

    if (this.processing) return
    this.processing = true
    job.status = 'processing'

    try {
      while (this.queue.length > 0 || this.active > 0) {
        while (this.active < this.maxConcurrent && this.queue.length > 0) {
          const item = this.queue.shift()!
          this.active++
          this.processItem(item, jobId)
            .catch(() => {})
            .finally(() => {
              this.active--
            })
        }

        // Small delay to yield event loop
        await new Promise(res => setTimeout(res, 50))
      }
    } finally {
      this.processing = false
      const finalJob = this.jobs.get(jobId)
      if (finalJob && finalJob.status !== 'failed') {
        finalJob.status = 'completed'
        finalJob.completedAt = new Date().toISOString()
      }
    }
  }

  private async processItem(item: QueueItem, jobId: string) {
    const job = this.jobs.get(jobId)
    if (!job) return
    const supabase = await createClient()

    try {
      const vector = await createEmbedding(item.phrase)
      const { error: updateError } = await supabase
        .from('dictionaries')
        .update({
          vector: JSON.stringify(vector),
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id)

      if (updateError) throw new Error(updateError.message)
      job.success++
    } catch (e) {
      job.failure++
      job.failures.push({
        id: item.id,
        phrase: item.phrase,
        error: e instanceof Error ? e.message : 'Unknown error'
      })
    } finally {
      job.processed++
    }
  }
}

declare global {
  var __embeddingQueue: EmbeddingQueueManager | undefined
}

export const embeddingQueue: EmbeddingQueueManager = global.__embeddingQueue ?? new EmbeddingQueueManager()
if (process.env.NODE_ENV !== 'production') {
  global.__embeddingQueue = embeddingQueue
}


