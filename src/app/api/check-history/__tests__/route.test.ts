import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'

const createMockSupabaseClient = () => ({
  auth: {
    getUser: vi.fn()
  },
  from: vi.fn()
})

const mockSupabaseClient = createMockSupabaseClient()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient))
}))

describe('Check History API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/check-history', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      })

      const request = new NextRequest('http://localhost:3000/api/check-history')
      const response = await GET(request)
      
      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Unauthorized')
    })

    it('should return 404 when user data is not found', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user1' } },
        error: null
      })

      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('User not found')
        })
      }
      mockSupabaseClient.from.mockReturnValue(mockFrom)

      const request = new NextRequest('http://localhost:3000/api/check-history')
      const response = await GET(request)
      
      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toBe('User not found or not in organization')
    })

    it('should return checks for admin user with proper formatting', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1' } },
        error: null
      })

      const userData = {
        id: 'admin1',
        email: 'admin@test.com',
        organization_id: 'org1',
        role: 'admin'
      }

      const mockChecks = [
        {
          id: 'check1',
          original_text: 'Test text',
          modified_text: 'Modified text',
          status: 'completed',
          input_type: 'text',
          image_url: null,
          extracted_text: null,
          ocr_status: null,
          created_at: '2024-01-01T00:00:00Z',
          completed_at: '2024-01-01T00:01:00Z',
          user_id: 'user1',
          users: { email: 'user@test.com' },
          violations: [{ id: 'v1' }, { id: 'v2' }]
        }
      ]

      let callCount = 0
      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          if (callCount === 0) {
            callCount++
            return Promise.resolve({ data: userData, error: null })
          }
          return Promise.resolve({ data: null, error: null })
        })
      }

      mockFrom.range.mockResolvedValue({
        data: mockChecks,
        error: null
      })

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            ...mockFrom,
            single: () => Promise.resolve({ data: userData, error: null })
          }
        }
        if (table === 'checks') {
          return {
            ...mockFrom,
            range: () => Promise.resolve({ data: mockChecks, error: null })
          }
        }
        return mockFrom
      })

      const request = new NextRequest('http://localhost:3000/api/check-history?page=1&limit=20')
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      const body = await response.json()
      
      expect(body.checks).toHaveLength(1)
      expect(body.checks[0]).toEqual({
        id: 'check1',
        originalText: 'Test text',
        modifiedText: 'Modified text',
        status: 'completed',
        inputType: 'text',
        imageUrl: null,
        extractedText: null,
        ocrStatus: null,
        createdAt: '2024-01-01T00:00:00Z',
        completedAt: '2024-01-01T00:01:00Z',
        userEmail: 'user@test.com',
        violationCount: 2
      })
      expect(body.userRole).toBe('admin')
    })

    it('should filter checks by user ID for admin', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1' } },
        error: null
      })

      const userData = {
        id: 'admin1',
        email: 'admin@test.com',
        organization_id: 'org1',
        role: 'admin'
      }

      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: userData, error: null })
      }

      mockSupabaseClient.from.mockReturnValue(mockFrom)

      const request = new NextRequest('http://localhost:3000/api/check-history?userId=user1')
      await GET(request)
      
      expect(mockFrom.eq).toHaveBeenCalledWith('user_id', 'user1')
    })

    it('should only show user own checks for regular user', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user1' } },
        error: null
      })

      const userData = {
        id: 'user1',
        email: 'user@test.com',
        organization_id: 'org1',
        role: 'user'
      }

      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: userData, error: null })
      }

      mockSupabaseClient.from.mockReturnValue(mockFrom)

      const request = new NextRequest('http://localhost:3000/api/check-history')
      await GET(request)
      
      expect(mockFrom.eq).toHaveBeenCalledWith('user_id', 'user1')
    })

    it('should apply search filter', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user1' } },
        error: null
      })

      const userData = {
        id: 'user1',
        email: 'user@test.com',
        organization_id: 'org1',
        role: 'user'
      }

      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: userData, error: null })
      }

      mockSupabaseClient.from.mockReturnValue(mockFrom)

      const request = new NextRequest('http://localhost:3000/api/check-history?search=test')
      await GET(request)
      
      expect(mockFrom.ilike).toHaveBeenCalledWith('original_text', '%test%')
    })

    it('should apply status filter', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user1' } },
        error: null
      })

      const userData = {
        id: 'user1',
        email: 'user@test.com',
        organization_id: 'org1',
        role: 'user'
      }

      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: userData, error: null })
      }

      mockSupabaseClient.from.mockReturnValue(mockFrom)

      const request = new NextRequest('http://localhost:3000/api/check-history?status=completed')
      await GET(request)
      
      expect(mockFrom.eq).toHaveBeenCalledWith('status', 'completed')
    })

    it('should return 500 on database error', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user1' } },
        error: null
      })

      const userData = {
        id: 'user1',
        email: 'user@test.com',
        organization_id: 'org1',
        role: 'user'
      }

      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Database error')
        }),
        single: vi.fn().mockResolvedValue({ data: userData, error: null })
      }

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            ...mockFrom,
            single: () => Promise.resolve({ data: userData, error: null })
          }
        }
        if (table === 'checks') {
          return {
            ...mockFrom,
            range: () => Promise.resolve({ data: null, error: new Error('Database error') })
          }
        }
        return mockFrom
      })

      const request = new NextRequest('http://localhost:3000/api/check-history')
      const response = await GET(request)
      
      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe('Failed to fetch checks')
    })
  })
})