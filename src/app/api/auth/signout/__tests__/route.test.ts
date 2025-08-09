import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../route'

const mockSupabaseAuth = {
  signOut: vi.fn()
}

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: mockSupabaseAuth
  }))
}))

describe('Auth Signout API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  describe('POST /api/auth/signout', () => {
    it('should successfully sign out user', async () => {
      mockSupabaseAuth.signOut.mockResolvedValue({ error: null })

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
      expect(mockSupabaseAuth.signOut).toHaveBeenCalled()
    })

    it('should return 500 on signout error', async () => {
      mockSupabaseAuth.signOut.mockResolvedValue({
        error: { message: 'Failed to sign out' }
      })

      const request = new NextRequest('http://localhost:3000/api/auth/signout', {
        method: 'POST'
      })

      const response = await POST(request)
      
      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.success).toBe(false)
      expect(body.error).toBe('Failed to sign out')
    })

    it('should handle cookies correctly', async () => {
      mockSupabaseAuth.signOut.mockResolvedValue({ error: null })

      const request = new NextRequest('http://localhost:3000/api/auth/signout', {
        method: 'POST',
        headers: {
          cookie: 'sb-access-token=test-token; sb-refresh-token=refresh-token'
        }
      })

      const response = await POST(request)
      
      expect(response.status).toBe(200)
      expect(mockSupabaseAuth.signOut).toHaveBeenCalled()
    })

    it('should work without cookies', async () => {
      mockSupabaseAuth.signOut.mockResolvedValue({ error: null })

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