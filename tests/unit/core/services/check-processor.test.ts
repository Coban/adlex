import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Prepare mocks before importing module under test
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

// Use real cache utils to compute key, but clear between tests
import { cache, CacheUtils } from '@/lib/cache'

// Mock AI helper used by check-processor
vi.mock('@/lib/ai-client', () => ({
  createChatCompletionForCheck: vi.fn(async () => ({
    type: 'lmstudio',
    violations: [
      { start_pos: 1, end_pos: 3, reason: 'NG表現', dictionary_id: 10 },
    ],
    modified: '修正済みテキスト'
  }))
}))

// Import after mocks
import { processCheck } from '@/lib/check-processor'

function setupSupabaseMocks() {
  const updateMock = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  const insertMock = vi.fn(() => Promise.resolve({ error: null }))
  const singleMock = vi.fn(() => Promise.resolve({ data: { organization_id: 123 }, error: null }))

  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'checks') {
      return {
        update: updateMock,
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single: singleMock })) }))
      }
    }
    if (table === 'violations') {
      return {
        insert: insertMock
      }
    }
    return {}
  })

  mockSupabase.rpc.mockResolvedValue({ data: null, error: null })

  return { updateMock, insertMock, singleMock }
}

describe('processCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cache.clear()
  })

  afterEach(() => {
    cache.clear()
  })

  it('類似フレーズが空（キャッシュ命中）の場合、違反なしで完了する', async () => {
    const { updateMock } = setupSupabaseMocks()

    const text = 'テスト本文'
    const hash = CacheUtils.hashText(text)
    const key = CacheUtils.similarPhrasesKey(123, hash)
    cache.set(key, [], 5 * 60 * 1000)

    await processCheck(1, text, 123, 'text')

    // 最初にprocessing更新、最後にcompleted更新が呼ばれる
    expect(updateMock).toHaveBeenCalled()
    const allCalls = (updateMock.mock.calls as unknown[][]).map(args => args[0])
    expect(allCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'processing' }),
        expect.objectContaining({ status: 'completed' }),
      ])
    )
    // usage increment RPCが呼ばれる
    expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_organization_usage', { org_id: 123 })
  })

  it('NGエントリーがある場合、AI結果を反映して違反挿入と完了更新が行われる', async () => {
    const { updateMock, insertMock } = setupSupabaseMocks()

    const text = '効果があります'
    const hash = CacheUtils.hashText(text)
    const key = CacheUtils.similarPhrasesKey(123, hash)
    cache.set(key, [
      { id: 10, phrase: '効果がある', category: 'NG', combined_score: 0.95 },
      { id: 11, phrase: '許容', category: 'ALLOW', combined_score: 0.1 },
    ] as any, 5 * 60 * 1000)

    await processCheck(44, text, 123, 'text')

    // 違反の挿入が行われる
    expect(insertMock).toHaveBeenCalled()
    const inserted = (insertMock.mock.calls as unknown[][])[0][0]
    expect(Array.isArray(inserted)).toBe(true)
    expect(inserted).toBeDefined()
    expect((inserted as unknown[])[0]).toMatchObject({
      check_id: 44,
      start_pos: 1,
      end_pos: 3,
      reason: 'NG表現',
      dictionary_id: 10,
    })

    // 完了更新
    const allCalls = (updateMock.mock.calls as unknown[][]).map(args => args[0])
    expect(allCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'processing' }),
        expect.objectContaining({ status: 'completed' }),
      ])
    )
  })
})

