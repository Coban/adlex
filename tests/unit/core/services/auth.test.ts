import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Create local mock for Supabase client
const mockSupabaseClient = {
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn()
  }
}

// Mock the Supabase client locally for this test file
vi.mock('@/infra/supabase/clientClient', () => ({
  createClient: () => mockSupabaseClient
}))

// Mock window.location for redirect tests
Object.defineProperty(window, 'location', {
  value: {
    origin: 'http://localhost:3000'
  },
  writable: true
})

// Now import the functions
import { 
  signInWithEmailAndPassword, 
  signUp,
  signOut
} from '@/lib/auth'

describe('認証ユーティリティ', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('メールアドレスとパスワードでサインイン', () => {
    it('正常にサインインできること', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      }

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: mockUser,
          session: {
            access_token: 'mock-token',
            user: mockUser
          }
        },
        error: null
      })

      const result = await signInWithEmailAndPassword('test@example.com', 'password123')

      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      })

      expect(result).toEqual({
        user: mockUser,
        session: {
          access_token: 'mock-token',
          user: mockUser
        }
      })
    })

    it('サインインエラーを適切に処理すること', async () => {
      const authError = {
        message: 'Invalid login credentials',
        status: 400
      }
      
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: authError
      })

      await expect(signInWithEmailAndPassword('test@example.com', 'wrongpassword'))
        .rejects.toThrow('Invalid login credentials')
    })

    it('メールアドレスの形式を検証すること', async () => {
      await expect(signInWithEmailAndPassword('invalid-email', 'password123'))
        .rejects.toThrow('Invalid email format')
    })

    it('パスワードの長さを検証すること', async () => {
      await expect(signInWithEmailAndPassword('test@example.com', '123'))
        .rejects.toThrow('Password must be at least 8 characters')
    })
  })

  describe('メールアドレスとパスワードでサインアップ', () => {
    it('正常にサインアップできること', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      }

      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: {
          user: mockUser,
          session: {
            access_token: 'mock-token',
            user: mockUser
          }
        },
        error: null
      })

      const result = await signUp({
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123'
      })

      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          emailRedirectTo: 'http://localhost:3000/auth/callback'
        }
      })

      expect(result).toEqual({
        user: mockUser,
        session: {
          access_token: 'mock-token',
          user: mockUser
        }
      })
    })

    it('サインアップエラーを適切に処理すること', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const signupError = {
        message: 'User already registered',
        status: 422
      }
      
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: signupError
      })

      await expect(signUp({
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123'
      })).rejects.toThrow('このメールアドレスは既に登録されています')
      
      consoleSpy.mockRestore()
    })

    it('パスワード一致を検証すること', async () => {
      await expect(signUp({
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'different'
      })).rejects.toThrow('パスワードが一致しません')
    })

    it('パスワードの最小長を検証すること', async () => {
      await expect(signUp({
        email: 'test@example.com',
        password: '123',
        confirmPassword: '123'
      })).rejects.toThrow('パスワードは6文字以上である必要があります')
    })
  })

  describe('サインアウト', () => {
    it('正常にサインアウトできること', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: null
      })

      await expect(signOut()).resolves.not.toThrow()

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled()
    })

    it('サインアウトエラーを適切に処理すること', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const signoutError = {
        message: 'Signout failed',
        status: 500
      }
      
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: signoutError
      })

      await expect(signOut()).rejects.toThrow('サインアウトエラー: Signout failed')
      
      consoleSpy.mockRestore()
    })
  })
})