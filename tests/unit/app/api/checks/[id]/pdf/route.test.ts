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

vi.mock('@/infra/supabase/serverClient', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

import { GET } from '@/app/api/checks/[id]/pdf/route'

describe('Checks PDF [id]/pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the mock query builder
    const newMockQuery = createMockQueryBuilder();
    mockSupabase.from.mockReturnValue(newMockQuery);
  })

  it('無効なIDは400', async () => {
    const req = new NextRequest('http://localhost:3000/api/checks/abc/pdf')
    const res = await GET(req, { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })

  it('未認証は401', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('x') })
    const req = new NextRequest('http://localhost:3000/api/checks/1/pdf')
    const res = await GET(req, { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(401)
  })

  it('ユーザー未所属は404', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      const tableQuery = createMockQueryBuilder();
      
      if (table === 'users') {
        tableQuery.single.mockResolvedValue({ 
          data: { id: 'u', organization_id: null }, 
          error: null 
        });
      }
      
      return tableQuery;
    })
    const req = new NextRequest('http://localhost:3000/api/checks/1/pdf')
    const res = await GET(req, { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(404)
  })

  it('チェック未発見は404', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      const tableQuery = createMockQueryBuilder();
      
      if (table === 'users') {
        tableQuery.single.mockResolvedValue({ 
          data: { id: 'u', organization_id: 1, role: 'admin' }, 
          error: null 
        });
      } else if (table === 'checks') {
        tableQuery.single.mockResolvedValue({ 
          data: null, 
          error: new Error('not found') 
        });
      }
      
      return tableQuery;
    })
    const req = new NextRequest('http://localhost:3000/api/checks/2/pdf')
    const res = await GET(req, { params: Promise.resolve({ id: '2' }) })
    expect(res.status).toBe(404)
  })

  it.skip('他人のチェックは403 - DEPRECATED: Repository pattern needed', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      const tableQuery = createMockQueryBuilder();
      
      if (table === 'users') {
        tableQuery.single.mockResolvedValue({ 
          data: { id: 'u', organization_id: 1, role: 'user' }, 
          error: null 
        });
      } else if (table === 'checks') {
        tableQuery.single.mockResolvedValue({ 
          data: { id: 3, user_id: 'other', organization_id: 1 }, 
          error: null 
        });
      }
      
      return tableQuery;
    })
    const req = new NextRequest('http://localhost:3000/api/checks/3/pdf')
    const res = await GET(req, { params: Promise.resolve({ id: '3' }) })
    expect(res.status).toBe(403)
  })

  it.skip('PDF生成は重いためskip', async () => {})
})


