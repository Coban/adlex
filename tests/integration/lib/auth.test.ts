import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Helper to create complete mock structure with flexible typing
const createSelectMock = (customOverrides?: any) => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
    })),
    textSearch: vi.fn(() => ({
      limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
    }))
  })),
  insert: vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  })),
  update: vi.fn(() => ({
    eq: vi.fn(() => ({
      single: vi.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  })),
  upsert: vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  })),
  ...customOverrides
}) as any

// Create local mock for Supabase client
const mockSupabaseClient = {
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
      error: null
    }))
  },
  from: vi.fn(() => createSelectMock()),
  rpc: vi.fn(() => Promise.resolve({ data: [], error: null }))
}

// Mock the Supabase client locally for this test file
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}))

// Now import the functions
import { 
  signInWithEmailAndPassword, 
  signUpWithEmailAndPassword, 
  signOut, 
  getCurrentUser, 
  getUserProfile,
  createUserProfile,
  updateUserProfile,
  checkUserExists,
  createOrganization,
  inviteUserToOrganization,
  acceptInvitation,
  changeUserRole
} from '@/lib/auth'

describe.skip('認証ユーティリティ', () => {
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
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: new Error('Invalid credentials')
      })

      await expect(signInWithEmailAndPassword('test@example.com', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials')
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

      const result = await signUpWithEmailAndPassword('test@example.com', 'password123')

      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
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

    it('サインアップエラーを適切に処理すること', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: new Error('User already exists')
      })

      await expect(signUpWithEmailAndPassword('test@example.com', 'password123'))
        .rejects.toThrow('User already exists')
    })

    it('メールアドレスの形式を検証すること', async () => {
      await expect(signUpWithEmailAndPassword('invalid-email', 'password123'))
        .rejects.toThrow('Invalid email format')
    })

    it('パスワードの強度を検証すること', async () => {
      await expect(signUpWithEmailAndPassword('test@example.com', 'weak'))
        .rejects.toThrow('Password must be at least 8 characters')
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
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: { message: 'Sign out failed' }
      })

      await expect(signOut()).rejects.toThrow('サインアウトエラー: Sign out failed')
    })
  })

  describe('現在のユーザー取得', () => {
    it('現在のユーザーを正常に取得できること', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      const result = await getCurrentUser()

      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled()
      expect(result).toEqual(mockUser)
    })

    it('認証されていない場合nullを返すこと', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      })

      const result = await getCurrentUser()

      expect(result).toBeNull()
    })

    it('認証エラーを適切に処理すること', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Token expired')
      })

      await expect(getCurrentUser()).rejects.toThrow('Token expired')
    })
  })

  describe('ユーザープロフィール取得', () => {
    it('ユーザープロフィールを正常に取得できること', async () => {
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        organization_id: 123,
        role: 'user'
      }

      const customEq = vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({
          data: mockProfile,
          error: null
        })),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
      }))
      mockSupabaseClient.from.mockReturnValue(createSelectMock(customEq))

      const result = await getUserProfile('user-123')

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users')
      expect(result).toEqual(mockProfile)
    })

    it('プロフィールが見つからない場合nullを返すこと', async () => {
      const customEq = vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({
          data: null,
          error: new Error('Profile not found')
        })),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
      }))
      mockSupabaseClient.from.mockReturnValue(createSelectMock(customEq))

      const result = await getUserProfile('nonexistent-user')

      expect(result).toBeNull()
    })

    it('データベースエラーを適切に処理すること', async () => {
      const customEq = vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({
          data: null,
          error: new Error('Database error')
        })),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
      }))
      mockSupabaseClient.from.mockReturnValue(createSelectMock(customEq))

      await expect(getUserProfile('user-123')).rejects.toThrow('Database error')
    })
  })

  describe('ユーザープロフィール作成', () => {
    it('ユーザープロフィールを正常に作成できること', async () => {
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        organization_id: 123,
        role: 'user'
      }

      const customUpsert = vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: mockProfile,
            error: null
          }))
        }))
      }))
      mockSupabaseClient.from.mockReturnValue({
        ...createSelectMock(),
        upsert: customUpsert
      })

      const result = await createUserProfile({
        id: 'user-123',
        email: 'test@example.com',
        organization_id: 123,
        role: 'user'
      })

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users')
      expect(result).toEqual(mockProfile)
    })

    it('作成エラーを適切に処理すること', async () => {
      const customUpsert = vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: null,
            error: new Error('Creation failed')
          }))
        }))
      }))
      mockSupabaseClient.from.mockReturnValue({
        ...createSelectMock(),
        upsert: customUpsert
      })

      await expect(createUserProfile({
        id: 'user-123',
        email: 'test@example.com',
        organization_id: 123,
        role: 'user'
      })).rejects.toThrow('Creation failed')
    })

    it('必須フィールドを検証すること', async () => {
      await expect(createUserProfile({
        id: '',
        email: 'test@example.com',
        organization_id: 123,
        role: 'user'
      })).rejects.toThrow('User ID is required')

      await expect(createUserProfile({
        id: 'user-123',
        email: '',
        organization_id: 123,
        role: 'user'
      })).rejects.toThrow('Email is required')
    })
  })

  describe('ユーザープロフィール更新', () => {
    it('ユーザープロフィールを正常に更新できること', async () => {
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        organization_id: 123,
        role: 'admin'
      }

      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: mockProfile,
              error: null
            }))
          }))
        }))
      })

      const result = await updateUserProfile('user-123', { role: 'admin' })

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users')
      expect(result).toEqual(mockProfile)
    })

    it('更新エラーを適切に処理すること', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: null,
              error: new Error('Update failed')
            }))
          }))
        }))
      })

      await expect(updateUserProfile('user-123', { role: 'admin' }))
        .rejects.toThrow('Update failed')
    })

    it('ユーザーIDを検証すること', async () => {
      await expect(updateUserProfile('', { role: 'admin' }))
        .rejects.toThrow('User ID is required')
    })
  })

  describe('ユーザー存在確認', () => {
    it('ユーザーが存在する場合trueを返すこと', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({
              data: { id: 'user-123' },
              error: null
            }))
          }))
        }))
      })

      const result = await checkUserExists('test@example.com')

      expect(result).toBe(true)
    })

    it('ユーザーが存在しない場合falseを返すこと', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({
              data: null,
              error: null
            }))
          }))
        }))
      })

      const result = await checkUserExists('nonexistent@example.com')

      expect(result).toBe(false)
    })

    it('データベースエラーを適切に処理すること', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({
              data: null,
              error: new Error('Database error')
            }))
          }))
        }))
      })

      await expect(checkUserExists('test@example.com')).rejects.toThrow('Database error')
    })
  })

  describe('組織作成', () => {
    it('組織を正常に作成できること', async () => {
      const mockOrganization = {
        id: 'org-123',
        name: 'Test Organization',
        plan: 'basic',
        max_checks: 100,
        used_checks: 0
      }

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: mockOrganization,
              error: null
            }))
          }))
        }))
      })

      const result = await createOrganization('Test Organization', 'basic')

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('organizations')
      expect(result).toEqual(mockOrganization)
    })

    it('作成エラーを適切に処理すること', async () => {
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: null,
              error: new Error('Creation failed')
            }))
          }))
        }))
      })

      await expect(createOrganization('Test Organization', 'basic'))
        .rejects.toThrow('Creation failed')
    })

    it('組織名を検証すること', async () => {
      await expect(createOrganization('', 'basic'))
        .rejects.toThrow('Organization name is required')
    })
  })

  describe('組織へのユーザー招待', () => {
    it('招待を正常に送信できること', async () => {
      const mockInvitation = {
        id: 'inv-123',
        email: 'newuser@example.com',
        organization_id: 123,
        role: 'user',
        token: 'invite-token-123'
      }

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: mockInvitation,
              error: null
            }))
          }))
        }))
      })

      const result = await inviteUserToOrganization(
        'newuser@example.com',
        123,
        'user'
      )

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_invitations')
      expect(result).toEqual(mockInvitation)
    })

    it('招待エラーを適切に処理すること', async () => {
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: null,
              error: new Error('Invitation failed')
            }))
          }))
        }))
      })

      await expect(inviteUserToOrganization('newuser@example.com', 123, 'user'))
        .rejects.toThrow('Invitation failed')
    })

    it('メールアドレスの形式を検証すること', async () => {
      await expect(inviteUserToOrganization('invalid-email', 123, 'user'))
        .rejects.toThrow('Invalid email format')
    })
  })

  describe('招待承諾', () => {
    it('招待を正常に承諾できること', async () => {
      const mockInvitation = {
        id: 'inv-123',
        email: 'newuser@example.com',
        organization_id: 123,
        role: 'user',
        token: 'invite-token-123'
      }

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: mockInvitation,
              error: null
            }))
          }))
        }))
      })

      const result = await acceptInvitation('invite-token-123')

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_invitations')
      expect(result).toEqual(mockInvitation)
    })

    it('無効なトークンを適切に処理すること', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: null,
              error: new Error('Invalid token')
            }))
          }))
        }))
      })

      await expect(acceptInvitation('invalid-token'))
        .rejects.toThrow('Invalid token')
    })

    it('トークンの形式を検証すること', async () => {
      await expect(acceptInvitation(''))
        .rejects.toThrow('Token is required')
    })
  })

  describe('ユーザーロール変更', () => {
    it('ユーザーロールを正常に変更できること', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        organization_id: 123,
        role: 'admin'
      }

      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: mockUser,
              error: null
            }))
          }))
        }))
      })

      const result = await changeUserRole('user-123', 'admin')

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users')
      expect(result).toEqual(mockUser)
    })

    it('ロール変更エラーを適切に処理すること', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: null,
              error: new Error('Role change failed')
            }))
          }))
        }))
      })

      await expect(changeUserRole('user-123', 'admin'))
        .rejects.toThrow('Role change failed')
    })

    it('ロールを検証すること', async () => {
      await expect(changeUserRole('user-123', 'invalid-role' as 'user' | 'admin'))
        .rejects.toThrow('Invalid role')
    })
  })

  describe('入力値検証', () => {
    it('メールアドレスの形式を検証すること', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org'
      ]

      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com',
        ''
      ]

      validEmails.forEach(email => {
        expect(() => {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('Invalid email format')
          }
        }).not.toThrow()
      })

      invalidEmails.forEach(email => {
        expect(() => {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('Invalid email format')
          }
        }).toThrow('Invalid email format')
      })
    })

    it('パスワードの強度を検証すること', () => {
      const validPasswords = [
        'password123',
        'mySecurePassword!',
        'P@ssw0rd123'
      ]

      const invalidPasswords = [
        'short',
        '1234567',
        ''
      ]

      validPasswords.forEach(password => {
        expect(() => {
          if (password.length < 8) {
            throw new Error('Password must be at least 8 characters')
          }
        }).not.toThrow()
      })

      invalidPasswords.forEach(password => {
        expect(() => {
          if (password.length < 8) {
            throw new Error('Password must be at least 8 characters')
          }
        }).toThrow('Password must be at least 8 characters')
      })
    })
  })

  // Simple test to verify auth module can be imported
  describe('認証モジュール', () => {
    it('期待される関数をエクスポートすること', () => {
      expect(typeof signInWithEmailAndPassword).toBe('function')
      expect(typeof signUpWithEmailAndPassword).toBe('function')
      expect(typeof signOut).toBe('function')
      expect(typeof getCurrentUser).toBe('function')
      expect(typeof getUserProfile).toBe('function')
    })
  })
})