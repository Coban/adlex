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

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn()
  },
  from: vi.fn()
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase))
}))

describe('Check History Export API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 for unauthorized user', async () => {
    // Mock unauthorized user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Unauthorized')
    })

    const { GET } = await import('../route')
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

    // Mock user data query
    const mockQuery = {
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'user-1', organization_id: 'org-1', role: 'user' },
        error: null
      })
    }
    
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue(mockQuery)
    })

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost:3000/api/check-history/export?format=invalid')
    const response = await GET(request)

    expect(response.status).toBe(400)
  })
})