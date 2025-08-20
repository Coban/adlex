import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock DTOs first
vi.mock('@/core/dtos/users', () => ({
  validateUpdateUserRoleParams: vi.fn((params) => ({ success: true, data: params })),
  validateUpdateUserRoleRequest: vi.fn((body) => ({ success: true, data: body })),
  createSuccessResponse: vi.fn((data) => ({ message: 'ユーザー権限が更新されました', user: data })),
  createErrorResponse: vi.fn((code, message) => ({ error: { code, message } })),
}))

// Mock repositories
vi.mock('@/core/ports', () => ({
  getRepositories: vi.fn().mockResolvedValue({
    users: {
      findById: vi.fn(),
      updateRole: vi.fn()
    }
  })
}))

// Mock Supabase client
vi.mock('@/infra/supabase/serverClient', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn() },
  }),
}))

// Mock UseCase
vi.mock('@/core/usecases/users/updateUserRole', () => ({
  UpdateUserRoleUseCase: vi.fn().mockImplementation(() => ({
    execute: vi.fn()
  }))
}))

import { PATCH } from '@/app/api/users/[id]/role/route'
import { UpdateUserRoleUseCase } from '@/core/usecases/users/updateUserRole'
import { createClient } from '@/infra/supabase/serverClient'

describe('Users Role API Route', () => {
  let mockUseCase: any
  let mockSupabaseClient: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Reset mocks
    mockUseCase = {
      execute: vi.fn()
    }
    
    mockSupabaseClient = {
      auth: { getUser: vi.fn() }
    }
    
    vi.mocked(UpdateUserRoleUseCase).mockImplementation(() => mockUseCase)
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient)
    
    // Reset DTOs to default successful state
    const { validateUpdateUserRoleParams, validateUpdateUserRoleRequest } = await import('@/core/dtos/users')
    vi.mocked(validateUpdateUserRoleParams).mockReturnValue({ success: true, data: { id: 'target-user-id' } })
    vi.mocked(validateUpdateUserRoleRequest).mockReturnValue({ success: true, data: { role: 'user' } })
  })

  describe('PATCH /api/users/[id]/role', () => {
    const mockParams = { params: Promise.resolve({ id: 'target-user-id' }) }

    it('should return 400 for invalid JSON', async () => {
      // Mock auth to return user
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'current-user-id' } },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/users/target-user-id/role', {
        method: 'PATCH',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PATCH(request, mockParams)
      
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.message).toBe('Invalid JSON in request body')
    })

    it('should return 400 for invalid role', async () => {
      const { validateUpdateUserRoleRequest } = await import('@/core/dtos/users')
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'current-user-id' } },
        error: null
      })

      // Mock validation to fail for this test only
      vi.mocked(validateUpdateUserRoleRequest).mockReturnValueOnce({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid role', details: undefined }
      })

      const request = new NextRequest('http://localhost:3000/api/users/target-user-id/role', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'invalid-role' }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PATCH(request, mockParams)
      
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.message).toBe('Invalid role')
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
      expect(body.error.code).toBe('AUTHENTICATION_ERROR')
      expect(body.error.message).toBe('認証が必要です')
    })

    it('should return 400 when current user data is not found', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1' } },
        error: null
      })

      // Mock usecase to return user not found error
      mockUseCase.execute.mockResolvedValue({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'ユーザー情報の取得に失敗しました' }
      })

      const request = new NextRequest('http://localhost:3000/api/users/target-user-id/role', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'user' })
      })

      const response = await PATCH(request, mockParams)
      
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.message).toBe('ユーザー情報の取得に失敗しました')
    })

    it('should return 403 when user is not admin', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user1' } },
        error: null
      })

      // Mock usecase to return authorization error
      mockUseCase.execute.mockResolvedValue({
        success: false,
        error: { code: 'AUTHORIZATION_ERROR', message: '管理者権限が必要です' }
      })

      const request = new NextRequest('http://localhost:3000/api/users/target-user-id/role', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'user' })
      })

      const response = await PATCH(request, mockParams)
      
      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error.code).toBe('AUTHORIZATION_ERROR')
      expect(body.error.message).toBe('管理者権限が必要です')
    })

    it('should return 400 when trying to change own role', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'target-user-id' } },
        error: null
      })

      // Mock usecase to return validation error for self-role change
      mockUseCase.execute.mockResolvedValue({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '自分自身の権限は変更できません' }
      })

      const request = new NextRequest('http://localhost:3000/api/users/target-user-id/role', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'user' })
      })

      const response = await PATCH(request, mockParams)
      
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.message).toBe('自分自身の権限は変更できません')
    })

    it('should return 404 when target user is not found', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1' } },
        error: null
      })

      // Mock usecase to return not found error
      mockUseCase.execute.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND_ERROR', message: '対象ユーザーが見つかりません' }
      })

      const request = new NextRequest('http://localhost:3000/api/users/target-user-id/role', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'user' })
      })

      const response = await PATCH(request, mockParams)
      
      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error.code).toBe('NOT_FOUND_ERROR')
      expect(body.error.message).toBe('対象ユーザーが見つかりません')
    })

    it('should return 403 when target user is from different organization', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1' } },
        error: null
      })

      // Mock usecase to return authorization error for different organization
      mockUseCase.execute.mockResolvedValue({
        success: false,
        error: { code: 'AUTHORIZATION_ERROR', message: '同じ組織のユーザーのみ権限変更できます' }
      })

      const request = new NextRequest('http://localhost:3000/api/users/target-user-id/role', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'admin' })
      })

      const response = await PATCH(request, mockParams)
      
      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error.code).toBe('AUTHORIZATION_ERROR')
      expect(body.error.message).toBe('同じ組織のユーザーのみ権限変更できます')
    })

    it('should successfully update user role', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1' } },
        error: null
      })

      const updatedUserData = {
        id: 'target-user-id',
        email: 'target@test.com',
        role: 'admin',
        updated_at: '2024-01-01T00:00:00Z'
      }

      // Mock usecase to return success
      mockUseCase.execute.mockResolvedValue({
        success: true,
        data: updatedUserData
      })

      const request = new NextRequest('http://localhost:3000/api/users/target-user-id/role', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'admin' })
      })

      const response = await PATCH(request, mockParams)
      
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.message).toBe('ユーザー権限が更新されました')
      expect(body.user).toEqual(updatedUserData)
    })
  })
})