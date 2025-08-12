import { describe, it, expect, vi, beforeEach } from 'vitest'
import { embeddingQueue } from '../embedding-queue'

// Supabase mock
const mockSupabase = {
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase)
}))

// createEmbedding uses mock in test env; ensure it resolves fast
vi.mock('@/lib/ai-client', () => ({
  createEmbedding: vi.fn(async () => new Array(8).fill(0).map((_, i) => i))
}))

function setupSupabaseDicts(dicts: Array<{ id: number; phrase: string }>) {
  // dictionaries select for enqueue
  const selectChain = {
    eq: vi.fn(() => Promise.resolve({ data: dicts, error: null })),
    in: vi.fn(() => Promise.resolve({ data: dicts, error: null })),
  }

  const updateChain = {
    update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
  }

  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'dictionaries') {
      return {
        select: vi.fn(() => selectChain),
        update: updateChain.update,
      }
    }
    return {}
  })

  return { selectChain, updateChain }
}

async function waitForJobCompletion(jobId: string, timeoutMs = 2000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const job = embeddingQueue.getJob(jobId)
    if (job && job.status === 'completed') return job
    await new Promise(res => setTimeout(res, 30))
  }
  throw new Error('Job did not complete in time')
}

describe('embedding-queue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('辞書語句をキューに入れて処理し、更新が行われる', async () => {
    const dicts = [
      { id: 1, phrase: '高血圧を下げる' },
      { id: 2, phrase: 'がんが治る' },
    ]
    const { updateChain } = setupSupabaseDicts(dicts)

    const job = await embeddingQueue.enqueueOrganization(123)
    const finished = await waitForJobCompletion(job.id)

    expect(finished.total).toBe(2)
    expect(finished.processed).toBe(2)
    expect(finished.status).toBe('completed')

    // updateが各辞書IDに対して呼び出される
    expect(updateChain.update).toHaveBeenCalled()
  })
})

