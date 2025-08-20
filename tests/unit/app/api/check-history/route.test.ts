import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock repositories first
const mockRepositories = {
  users: {
    findById: vi.fn()
  },
  checks: {
    searchChecks: vi.fn()
  }
};

vi.mock('@/core/ports', () => ({
  getRepositories: vi.fn(() => mockRepositories)
}))

// Mock Supabase client
const mockSupabaseClient = {
  auth: { getUser: vi.fn() }
}

vi.mock('@/infra/supabase/serverClient', () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}))

import { GET } from '@/app/api/check-history/route'

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

      mockRepositories.users.findById.mockResolvedValue(null)

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

      mockRepositories.users.findById.mockResolvedValue(userData)
      mockRepositories.checks.searchChecks.mockResolvedValue({
        checks: mockChecks,
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1
        }
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
      expect(body.pagination).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
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

      mockRepositories.users.findById.mockResolvedValue(userData)
      mockRepositories.checks.searchChecks.mockResolvedValue({
        checks: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 }
      })

      const request = new NextRequest('http://localhost:3000/api/check-history?userId=user1')
      await GET(request)
      
      expect(mockRepositories.checks.searchChecks).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org1',
          userId: 'user1',
          page: 1,
          limit: 20
        })
      )
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

      mockRepositories.users.findById.mockResolvedValue(userData)
      mockRepositories.checks.searchChecks.mockResolvedValue({
        checks: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 }
      })

      const request = new NextRequest('http://localhost:3000/api/check-history')
      await GET(request)
      
      expect(mockRepositories.checks.searchChecks).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org1',
          userId: 'user1',
          page: 1,
          limit: 20
        })
      )
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

      mockRepositories.users.findById.mockResolvedValue(userData)
      mockRepositories.checks.searchChecks.mockResolvedValue({
        checks: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 }
      })

      const request = new NextRequest('http://localhost:3000/api/check-history?search=test')
      await GET(request)
      
      expect(mockRepositories.checks.searchChecks).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org1',
          userId: 'user1',
          search: 'test',
          page: 1,
          limit: 20
        })
      )
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

      mockRepositories.users.findById.mockResolvedValue(userData)
      mockRepositories.checks.searchChecks.mockResolvedValue({
        checks: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 }
      })

      const request = new NextRequest('http://localhost:3000/api/check-history?status=completed')
      await GET(request)
      
      expect(mockRepositories.checks.searchChecks).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org1',
          userId: 'user1',
          status: 'completed',
          page: 1,
          limit: 20
        })
      )
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

      mockRepositories.users.findById.mockResolvedValue(userData)
      mockRepositories.checks.searchChecks.mockRejectedValue(new Error('Failed to fetch checks'))

      const request = new NextRequest('http://localhost:3000/api/check-history')
      const response = await GET(request)
      
      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe('Internal server error') // Match actual catch block error
    })
  })
})