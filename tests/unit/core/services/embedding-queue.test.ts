import { describe, it, expect, vi, beforeEach } from 'vitest'
import { embeddingQueue } from '@/lib/embedding-queue'

// Supabase mock
// Comprehensive mock query builder with all methods
const createMockQueryBuilder = () => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  like: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  contains: vi.fn().mockReturnThis(),
  containedBy: vi.fn().mockReturnThis(),
  rangeGt: vi.fn().mockReturnThis(),
  rangeGte: vi.fn().mockReturnThis(),
  rangeLt: vi.fn().mockReturnThis(),
  rangeLte: vi.fn().mockReturnThis(),
  rangeAdjacent: vi.fn().mockReturnThis(),
  overlaps: vi.fn().mockReturnThis(),
  textSearch: vi.fn().mockReturnThis(),
  match: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  filter: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
});

// Mock Supabase client
const mockQuery = createMockQueryBuilder();
const mockSupabase = {
  from: vi.fn().mockReturnValue(mockQuery),
  auth: { getUser: vi.fn() },
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
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
    // Reset the mock query builder
    const newMockQuery = createMockQueryBuilder();
    mockSupabase.from.mockReturnValue(newMockQuery);
  })

  it('辞書語句をキューに入れて処理し、更新が行われる', async () => {
    const dicts = [
      { id: 1, phrase: '高血圧を下げる', vector: null },
      { id: 2, phrase: 'がんが治る', vector: null },
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

