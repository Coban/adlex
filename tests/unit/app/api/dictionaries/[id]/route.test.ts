import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Supabase mock types (commented out unused type)
// type _SupabaseClientMock = {
//   auth: { getUser: ReturnType<typeof vi.fn> }
//   from: ReturnType<typeof vi.fn>
// }

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

// ai-client を先にモックして、OpenAI 初期化を避ける
vi.mock('@/lib/ai-client', () => ({
  createEmbedding: vi.fn(async () => [0.1, 0.2, 0.3]),
}))

import { GET, PUT, DELETE } from '@/app/api/dictionaries/[id]/route'

describe.skip('Dictionaries [id] API - DEPRECATED: Repository pattern needed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the mock query builder
    const newMockQuery = createMockQueryBuilder();
    mockSupabase.from.mockReturnValue(newMockQuery);
  })

  it('GET: 無効なIDは400', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      const tableQuery = createMockQueryBuilder();
      
      if (table === 'users') {
        tableQuery.single.mockResolvedValue({ data: { organization_id: 1 }, error: null });
      }
      
      return tableQuery;
    })
    const req = new NextRequest('http://localhost:3000/api/dictionaries/abc')
    const res = await GET(req, { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })

  it('GET: 未認証は401', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('x') })
    const req = new NextRequest('http://localhost:3000/api/dictionaries/1')
    const res = await GET(req, { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(401)
  })

  it('PUT: 無効JSONは400', async () => {
    // コンソールエラーを一時的に抑制
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { organization_id: 1, role: 'admin' }, error: null })
        }
      }
      return { select: vi.fn(), eq: vi.fn(), single: vi.fn() }
    })
    const req = new NextRequest('http://localhost:3000/api/dictionaries/1', { 
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json' 
    })
    const res = await PUT(req, { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(400)
    
    // コンソールスパイを復元
    consoleSpy.mockRestore()
  })

  it('PUT: 未認証は401', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('x') })
    const req = new NextRequest('http://localhost:3000/api/dictionaries/1', { method: 'PUT', body: JSON.stringify({}) })
    const res = await PUT(req, { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(401)
  })

  it('DELETE: 未認証は401', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('x') })
    const req = new NextRequest('http://localhost:3000/api/dictionaries/1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(401)
  })

  it.skip('PUT/DELETE の管理者権限やDB更新はskip', async () => {})
})


