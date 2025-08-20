import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/auth/signout/route'

const mockSupabaseAuth = {
  signOut: vi.fn()
}

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: mockSupabaseAuth
  }))
}))

// Mock the auth repository
vi.mock('@/lib/repositories/supabase/authRepository', () => ({
  SupabaseAuthRepository: vi.fn().mockImplementation(() => ({
    signOut: vi.fn()
  }))
}))

describe('Auth Signout API Route', () => {
  let mockAuthRepo: any

  beforeEach(async () => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
    
    // Setup mock auth repository
    const { SupabaseAuthRepository } = await import('@/lib/repositories/supabase/authRepository')
    mockAuthRepo = {
      signOut: vi.fn().mockResolvedValue(undefined)
    }
    vi.mocked(SupabaseAuthRepository).mockImplementation(() => mockAuthRepo)
  })

  describe('POST /api/auth/signout', () => {
    it('should successfully sign out user', async () => {
      mockAuthRepo.signOut.mockResolvedValue(undefined)

      const request = new NextRequest('http://localhost:3000/api/auth/signout', {
        method: 'POST',
        headers: {
          cookie: 'sb-access-token=test-token'
        }
      })

      const response = await POST(request)
      
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(mockAuthRepo.signOut).toHaveBeenCalled()
    })

    it('should return 500 on signout error', async () => {
      mockAuthRepo.signOut.mockRejectedValue(new Error('Failed to sign out'))

      const request = new NextRequest('http://localhost:3000/api/auth/signout', {
        method: 'POST'
      })

      const response = await POST(request)
      
      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toEqual({
        code: 'INTERNAL_ERROR',
        message: '内部エラーが発生しました'
      })
    })

    it('should handle cookies correctly', async () => {
      mockAuthRepo.signOut.mockResolvedValue(undefined)

      const request = new NextRequest('http://localhost:3000/api/auth/signout', {
        method: 'POST',
        headers: {
          cookie: 'sb-access-token=test-token; sb-refresh-token=refresh-token'
        }
      })

      const response = await POST(request)
      
      expect(response.status).toBe(200)
      expect(mockAuthRepo.signOut).toHaveBeenCalled()
    })

    it('should work without cookies', async () => {
      mockAuthRepo.signOut.mockResolvedValue(undefined)

      const request = new NextRequest('http://localhost:3000/api/auth/signout', {
        method: 'POST'
      })

      const response = await POST(request)
      
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.success).toBe(true)
    })
  })
})