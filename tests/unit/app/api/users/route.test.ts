import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSupabaseClient } = vi.hoisted(() => {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }

  return {
    mockSupabaseClient: {
      auth: { getUser: vi.fn() },
      from: vi.fn().mockReturnValue(mockQuery)
    }
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient))
}))

import { GET } from '@/app/api/users/route'

describe.skip('Users API Route - DEPRECATED: Use repository tests instead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/users', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      })

      const response = await GET({ url: "http://localhost/test", cookies: { get: () => null }, headers: new Headers() } as any)
      
      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('認証が必要です')
    })

    it('should return 400 when user data is not found', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user1' } },
        error: null
      })

      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('User not found')
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('User not found')
        })
      }
      mockSupabaseClient.from.mockReturnValue(mockFrom)

      const response = await GET({ url: "http://localhost/test", cookies: { get: () => null }, headers: new Headers() } as any)
      
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('ユーザー情報の取得に失敗しました')
    })

    it('should return 403 when user is not admin', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user1' } },
        error: null
      })

      const userData = {
        organization_id: 'org1',
        role: 'user'
      }

      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: userData, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: userData, error: null })
      }
      mockSupabaseClient.from.mockReturnValue(mockFrom)

      const response = await GET({ url: "http://localhost/test", cookies: { get: () => null }, headers: new Headers() } as any)
      
      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe('管理者権限が必要です')
    })

    it('should return 400 when user has no organization', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1' } },
        error: null
      })

      const userData = {
        organization_id: null,
        role: 'admin'
      }

      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: userData, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: userData, error: null })
      }
      mockSupabaseClient.from.mockReturnValue(mockFrom)

      const response = await GET({ url: "http://localhost/test", cookies: { get: () => null }, headers: new Headers() } as any)
      
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('組織に所属していません')
    })

    it('should return users list for admin user', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1' } },
        error: null
      })

      const userData = {
        organization_id: 'org1',
        role: 'admin'
      }

      const mockUsers = [
        {
          id: 'user1',
          email: 'user1@test.com',
          role: 'user',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'admin1',
          email: 'admin@test.com',
          role: 'admin',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: userData, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: userData, error: null })
      }

      mockFrom.order.mockResolvedValue({ data: mockUsers, error: null })

      mockSupabaseClient.from.mockReturnValue(mockFrom)

      const response = await GET({ url: "http://localhost/test", cookies: { get: () => null }, headers: new Headers() } as any)
      
      expect(response.status).toBe(200)
      const body = await response.json()
      
      expect(body.users).toHaveLength(2)
      expect(body.users).toEqual(mockUsers)
    })

    it('should return 500 on database error when fetching users', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1' } },
        error: null
      })

      const userData = {
        organization_id: 'org1',
        role: 'admin'
      }

      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: userData, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: userData, error: null })
      }

      mockFrom.order.mockResolvedValue({ data: null, error: { message: 'Database error' } })

      mockSupabaseClient.from.mockReturnValue(mockFrom)

      const response = await GET({ url: "http://localhost/test", cookies: { get: () => null }, headers: new Headers() } as any)
      
      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe('ユーザー一覧の取得に失敗しました')
    })

    it('should handle case when users list is empty', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1' } },
        error: null
      })

      const userData = {
        organization_id: 'org1',
        role: 'admin'
      }

      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: userData, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: userData, error: null })
      }

      mockFrom.order.mockResolvedValue({ data: null, error: null })

      mockSupabaseClient.from.mockReturnValue(mockFrom)

      const response = await GET({ url: "http://localhost/test", cookies: { get: () => null }, headers: new Headers() } as any)
      
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.users).toEqual([])
    })
  })
})