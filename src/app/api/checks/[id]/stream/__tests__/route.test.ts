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
})

type SupabaseClientMock = {
  auth: { getUser: ReturnType<typeof vi.fn> }
  from: ReturnType<typeof vi.fn>
  channel: ReturnType<typeof vi.fn>
}

const mockSupabase: SupabaseClientMock = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
  channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn(), unsubscribe: vi.fn() })),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

import { GET } from '../route'

describe.skip('Checks SSE [id]/stream - DEPRECATED: Repository pattern needed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the mock query builder
    const newMockQuery = createMockQueryBuilder();
    mockSupabase.from.mockReturnValue(newMockQuery);
  })

  it('無効なIDは400', async () => {
    const req = new NextRequest('http://localhost:3000/api/checks/abc/stream')
    const res = await GET(req, { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })

  it('未認証は401', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('x') })
    const req = new NextRequest('http://localhost:3000/api/checks/1/stream')
    const res = await GET(req, { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(401)
  })

  it('チェック未発見は404', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'checks') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: new Error('x') }),
        }
      }
      return { select: vi.fn(), eq: vi.fn(), single: vi.fn() }
    })
    const req = new NextRequest('http://localhost:3000/api/checks/2/stream')
    const res = await GET(req, { params: Promise.resolve({ id: '2' }) })
    expect(res.status).toBe(404)
  })

  it('他人のチェックは403', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'me' } }, error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'checks') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 3, user_id: 'other', organization_id: 1 }, error: null }),
        }
      }
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'me', organization_id: 1, role: 'user' }, error: null }),
        }
      }
      return { select: vi.fn(), eq: vi.fn(), single: vi.fn() }
    })
    const req = new NextRequest('http://localhost:3000/api/checks/3/stream')
    const res = await GET(req, { params: Promise.resolve({ id: '3' }) })
    expect(res.status).toBe(403)
  })

  it.skip('SSE購読・ハートビート・最終データ送信はskip', async () => {})
})


