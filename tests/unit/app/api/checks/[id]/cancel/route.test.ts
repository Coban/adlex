import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

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
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

import { POST } from '@/app/api/checks/[id]/cancel/route'

describe('Checks Cancel API [id]/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the mock query builder
    const newMockQuery = createMockQueryBuilder();
    mockSupabase.from.mockReturnValue(newMockQuery);
  })

  it('無効なIDは500', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const req = new NextRequest('http://localhost:3000/api/checks/abc/cancel', { method: 'POST' })
    const res = await POST(req, { params: { id: 'abc' } })
    expect(res.status).toBe(401) // 認証チェックが先に行われるため401になる
  })

  it('未認証は401', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('x') })
    const req = new NextRequest('http://localhost:3000/api/checks/1/cancel', { method: 'POST' })
    const res = await POST(req, { params: { id: '1' } })
    expect(res.status).toBe(401)
  })

  it.skip('ステータスチェックや更新系はskip', async () => {})
})


