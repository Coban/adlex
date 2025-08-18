import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

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

describe('Check History Stats API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 for unauthorized user', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Unauthorized')
    })

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost:3000/api/check-history/stats')
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it('should return 404 for user without organization', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null
    })

    const userQuery = {
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'user-1', organization_id: null, role: 'user' },
        error: null
      })
    }
    
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue(userQuery)
    })

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost:3000/api/check-history/stats')
    const response = await GET(request)

    expect(response.status).toBe(404)
  })
})