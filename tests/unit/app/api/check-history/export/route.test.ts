import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock XLSX module
vi.mock('xlsx', () => ({
  utils: {
    book_new: vi.fn(() => ({})),
    aoa_to_sheet: vi.fn(() => ({ '!cols': [] })),
    book_append_sheet: vi.fn()
  },
  write: vi.fn(() => Buffer.from('mock excel data'))
}))

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

// Mock repositories
const mockRepositories = {
  users: {
    findById: vi.fn()
  },
  checks: {
    findMany: vi.fn()
  }
}

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn()
  },
  from: vi.fn()
}

vi.mock('@/infra/supabase/serverClient', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('@/core/ports', () => ({
  getRepositories: vi.fn(() => Promise.resolve(mockRepositories))
}))

describe('Check History Export API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the mock query builder
    const newMockQuery = createMockQueryBuilder();
    mockSupabase.from.mockReturnValue(newMockQuery);
  })

  it('should return 401 for unauthorized user', async () => {
    // Mock unauthorized user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Unauthorized')
    })

    const { GET } = await import('@/app/api/check-history/export/route')
    const request = new NextRequest('http://localhost:3000/api/check-history/export?format=csv')
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it('should return 400 for invalid format', async () => {
    // Mock authorized user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null
    })

    // Mock user data from repository
    mockRepositories.users.findById.mockResolvedValue({
      id: 'user-1', 
      organization_id: 'org-1', 
      role: 'user'
    })

    const { GET } = await import('@/app/api/check-history/export/route')
    const request = new NextRequest('http://localhost:3000/api/check-history/export?format=invalid')
    const response = await GET(request)

    expect(response.status).toBe(400)
  })
})