import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH } from '../route'

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

describe('Users Role API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('PATCH /api/users/[id]/role', () => {
    const mockParams = { params: Promise.resolve({ id: 'target-user-id' }) }

    it('should return 400 for invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/users/target-user-id/role', {
        method: 'PATCH',
        body: 'invalid json'
      })

      const response = await PATCH(request, mockParams)
      
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('Invalid JSON in request body')
    })

    it('should return 400 for invalid role', async () => {
      const request = new NextRequest('http://localhost:3000/api/users/target-user-id/role', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'invalid-role' })
      })

      const response = await PATCH(request, mockParams)
      
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('無効なロールです')
    })

    it('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      })

      const request = new NextRequest('http://localhost:3000/api/users/target-user-id/role', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'user' })
      })

      const response = await PATCH(request, mockParams)
      
      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('認証が必要です')
    })

    it('should return 400 when current user data is not found', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1' } },
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

      const request = new NextRequest('http://localhost:3000/api/users/target-user-id/role', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'user' })
      })

      const response = await PATCH(request, mockParams)
      
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('ユーザー情報の取得に失敗しました')
    })

    it('should return 403 when user is not admin', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user1' } },
        error: null
      })

      const currentUserData = {
        organization_id: 'org1',
        role: 'user'
      }

      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: currentUserData, error: null })
      }
      mockSupabaseClient.from.mockReturnValue(mockFrom)

      const request = new NextRequest('http://localhost:3000/api/users/target-user-id/role', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'user' })
      })

      const response = await PATCH(request, mockParams)
      
      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe('管理者権限が必要です')
    })

    it('should return 400 when trying to change own role', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'target-user-id' } },
        error: null
      })

      const currentUserData = {
        organization_id: 'org1',
        role: 'admin'
      }

      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: currentUserData, error: null })
      }
      mockSupabaseClient.from.mockReturnValue(mockFrom)

      const request = new NextRequest('http://localhost:3000/api/users/target-user-id/role', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'user' })
      })

      const response = await PATCH(request, mockParams)
      
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('自分自身の権限は変更できません')
    })

    it('should return 404 when target user is not found', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1' } },
        error: null
      })

      const currentUserData = {
        organization_id: 'org1',
        role: 'admin'
      }

      let callCount = 0
      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          if (callCount === 0) {
            callCount++
            return Promise.resolve({ data: currentUserData, error: null })
          }
          return Promise.resolve({ data: null, error: new Error('User not found') })
        })
      }
      mockSupabaseClient.from.mockReturnValue(mockFrom)

      const request = new NextRequest('http://localhost:3000/api/users/target-user-id/role', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'user' })
      })

      const response = await PATCH(request, mockParams)
      
      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toBe('対象ユーザーが見つかりません')
    })

    it('should return 403 when target user is from different organization', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1' } },
        error: null
      })

      const currentUserData = {
        organization_id: 'org1',
        role: 'admin'
      }

      const targetUserData = {
        organization_id: 'org2',
        role: 'user',
        email: 'target@test.com'
      }

      let callCount = 0
      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          if (callCount === 0) {
            callCount++
            return Promise.resolve({ data: currentUserData, error: null })
          }
          return Promise.resolve({ data: targetUserData, error: null })
        })
      }
      mockSupabaseClient.from.mockReturnValue(mockFrom)

      const request = new NextRequest('http://localhost:3000/api/users/target-user-id/role', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'admin' })
      })

      const response = await PATCH(request, mockParams)
      
      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe('同じ組織のユーザーのみ権限変更できます')
    })

    it('should successfully update user role', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1' } },
        error: null
      })

      const currentUserData = {
        organization_id: 'org1',
        role: 'admin'
      }

      const targetUserData = {
        organization_id: 'org1',
        role: 'user',
        email: 'target@test.com'
      }

      const updatedUserData = [{
        id: 'target-user-id',
        email: 'target@test.com',
        role: 'admin',
        updated_at: '2024-01-01T00:00:00Z'
      }]

      let callCount = 0
      const mockUpdate = {
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: updatedUserData, error: null })
      }

      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnValue(mockUpdate),
        single: vi.fn().mockImplementation(() => {
          if (callCount === 0) {
            callCount++
            return Promise.resolve({ data: currentUserData, error: null })
          }
          return Promise.resolve({ data: targetUserData, error: null })
        })
      }

      mockSupabaseClient.from.mockReturnValue(mockFrom)

      const request = new NextRequest('http://localhost:3000/api/users/target-user-id/role', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'admin' })
      })

      const response = await PATCH(request, mockParams)
      
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.message).toBe('ユーザー権限が更新されました')
      expect(body.user).toEqual(updatedUserData[0])
    })
  })
})