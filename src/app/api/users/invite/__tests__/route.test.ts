import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock repositories first
const mockRepositories = {
  users: {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    updateRole: vi.fn()
  },
  userInvitations: {
    findActiveInvitationByEmail: vi.fn(),
    create: vi.fn()
  }
};

vi.mock('@/lib/repositories', () => ({
  getRepositories: vi.fn(() => mockRepositories)
}))

// Mock Supabase client
const mockSupabaseClient = {
  auth: { getUser: vi.fn() },
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}))

import { POST } from '../route'

vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn(() => ({ toString: () => 'mock-token-123' }))
  },
  randomBytes: vi.fn(() => ({ toString: () => 'mock-token-123' }))
}))

describe('Users Invite API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/users/invite', () => {
    it('should return 400 for invalid JSON', async () => {
      // コンソールエラーを一時的に抑制
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const request = new NextRequest('http://localhost:3000/api/users/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: 'invalid json'
      })

      const response = await POST(request)
      
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('Invalid JSON in request body')
      
      // コンソールスパイを復元
      consoleSpy.mockRestore()
    })

    it('should return 400 when email is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/users/invite', {
        method: 'POST',
        body: JSON.stringify({ role: 'user' })
      })

      const response = await POST(request)
      
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('メールアドレスが必要です')
    })

    it('should return 400 for invalid role', async () => {
      const request = new NextRequest('http://localhost:3000/api/users/invite', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', role: 'invalid-role' })
      })

      const response = await POST(request)
      
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('無効なロールです')
    })

    it('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      })

      const request = new NextRequest('http://localhost:3000/api/users/invite', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' })
      })

      const response = await POST(request)
      
      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('認証が必要です')
    })

    it('should return 400 when current user data is not found', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1' } },
        error: null
      })

      // Mock repository to return null for findById
      mockRepositories.users.findById.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/users/invite', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' })
      })

      const response = await POST(request)
      
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

      // Mock repository to return user data
      mockRepositories.users.findById.mockResolvedValue(currentUserData)

      const request = new NextRequest('http://localhost:3000/api/users/invite', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' })
      })

      const response = await POST(request)
      
      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe('管理者権限が必要です')
    })

    it('should return 400 when user has no organization', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1' } },
        error: null
      })

      const currentUserData = {
        organization_id: null,
        role: 'admin'
      }

      // Mock repository to return user data
      mockRepositories.users.findById.mockResolvedValue(currentUserData)

      const request = new NextRequest('http://localhost:3000/api/users/invite', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' })
      })

      const response = await POST(request)
      
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('組織に所属していません')
    })

    it('should return 400 when user with email already exists', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1' } },
        error: null
      })

      const currentUserData = {
        organization_id: 'org1',
        role: 'admin'
      }

      const existingUser = { id: 'existing-user' }

      // Mock repository calls
      mockRepositories.users.findById.mockResolvedValue(currentUserData)
      mockRepositories.users.findByEmail.mockResolvedValue(existingUser)

      const request = new NextRequest('http://localhost:3000/api/users/invite', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' })
      })

      const response = await POST(request)
      
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('このメールアドレスは既に登録されています')
    })

    it('should return 400 when active invitation already exists', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1' } },
        error: null
      })

      const currentUserData = {
        organization_id: 'org1',
        role: 'admin'
      }

      const existingInvitation = { id: 'invitation-123' }

      // Mock repository calls
      mockRepositories.users.findById.mockResolvedValue(currentUserData)
      mockRepositories.users.findByEmail.mockResolvedValue(null) // No existing user
      mockRepositories.userInvitations.findActiveInvitationByEmail.mockResolvedValue(existingInvitation)

      const request = new NextRequest('http://localhost:3000/api/users/invite', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' })
      })

      const response = await POST(request)
      
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('このメールアドレスには既に招待が送信されています')
    })

    it.skip('should successfully create invitation', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1' } },
        error: null
      })

      const currentUserData = {
        organization_id: 'org1',
        role: 'admin'
      }

      const mockInvitation = {
        id: 'invitation-123',
        email: 'test@example.com',
        role: 'user',
        expires_at: '2024-12-31T23:59:59Z'
      }

      let callCount = 0
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'users') {
          if (callCount === 0) {
            callCount++
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: currentUserData, error: null })
            }
          } else {
            // For existing user check - return null (no existing user)
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: null, error: null })
            }
          }
        }
        if (table === 'user_invitations') {
          if (callCount <= 2) {
            // For existing invitation check - return null (no existing invitation)
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              gt: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: null, error: null })
            }
          } else {
            // For creating invitation
            const insertMock = {
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockInvitation, error: null })
            }
            return {
              insert: vi.fn().mockReturnValue(insertMock)
            }
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null })
        }
      })

      const request = new NextRequest('http://localhost:3000/api/users/invite', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', role: 'user' })
      })

      const response = await POST(request)
      
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.message).toBe('招待を送信しました')
      expect(body.invitation.email).toBe('test@example.com')
      expect(body.invitation.role).toBe('user')
      expect(body.invitation.invitation_url).toContain('mock-token-123')
    })

    it('should default to user role when role is not specified', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1' } },
        error: null
      })

      const currentUserData = {
        organization_id: 'org1',
        role: 'admin'
      }

      const mockInvitation = {
        id: 'invitation-123',
        email: 'test@example.com',
        role: 'user',
        expires_at: '2024-12-31T23:59:59Z'
      }

      // Mock repository calls
      mockRepositories.users.findById.mockResolvedValue(currentUserData)
      mockRepositories.users.findByEmail.mockResolvedValue(null)
      mockRepositories.userInvitations.findActiveInvitationByEmail.mockResolvedValue(null)
      mockRepositories.userInvitations.create.mockResolvedValue(mockInvitation)

      const request = new NextRequest('http://localhost:3000/api/users/invite', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' })
      })

      await POST(request)
      
      // Verify that create was called with user role as default
      expect(mockRepositories.userInvitations.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'user'
        })
      )
    })

    it('should return 500 on invitation creation error', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1' } },
        error: null
      })

      const currentUserData = {
        organization_id: 'org1',
        role: 'admin'
      }

      // Mock repository calls
      mockRepositories.users.findById.mockResolvedValue(currentUserData)
      mockRepositories.users.findByEmail.mockResolvedValue(null)
      mockRepositories.userInvitations.findActiveInvitationByEmail.mockResolvedValue(null)
      mockRepositories.userInvitations.create.mockRejectedValue(new Error('Insert failed'))

      const request = new NextRequest('http://localhost:3000/api/users/invite', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' })
      })

      const response = await POST(request)
      
      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe('招待の送信に失敗しました')
    })
  })
})