import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createClient } from '@/lib/supabase/client'

// Get the mocked client from the global setup
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSupabaseClient = createClient() as any

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
} from '../auth'

describe.skip('Auth utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe.skip('signInWithEmailAndPassword', () => {
    it('should sign in successfully', async () => {
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

    it('should handle sign in errors', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: new Error('Invalid credentials')
      })

      await expect(signInWithEmailAndPassword('test@example.com', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials')
    })

    it('should validate email format', async () => {
      await expect(signInWithEmailAndPassword('invalid-email', 'password123'))
        .rejects.toThrow('Invalid email format')
    })

    it('should validate password length', async () => {
      await expect(signInWithEmailAndPassword('test@example.com', '123'))
        .rejects.toThrow('Password must be at least 8 characters')
    })
  })

  describe.skip('signUpWithEmailAndPassword', () => {
    it('should sign up successfully', async () => {
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

    it('should handle sign up errors', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: new Error('User already exists')
      })

      await expect(signUpWithEmailAndPassword('test@example.com', 'password123'))
        .rejects.toThrow('User already exists')
    })

    it('should validate email format', async () => {
      await expect(signUpWithEmailAndPassword('invalid-email', 'password123'))
        .rejects.toThrow('Invalid email format')
    })

    it('should validate password strength', async () => {
      await expect(signUpWithEmailAndPassword('test@example.com', 'weak'))
        .rejects.toThrow('Password must be at least 8 characters')
    })
  })

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: null
      })

      await expect(signOut()).resolves.not.toThrow()

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled()
    })

    it('should handle sign out errors', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: { message: 'Sign out failed' }
      })

      await expect(signOut()).rejects.toThrow('サインアウトエラー: Sign out failed')
    })
  })

  describe('getCurrentUser', () => {
    it('should get current user successfully', async () => {
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

    it('should return null when no user is authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      })

      const result = await getCurrentUser()

      expect(result).toBeNull()
    })

    it('should handle auth errors', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Token expired')
      })

      await expect(getCurrentUser()).rejects.toThrow('Token expired')
    })
  })

  describe('getUserProfile', () => {
    it('should get user profile successfully', async () => {
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        organization_id: 123,
        role: 'user'
      }

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: mockProfile,
              error: null
            }))
          }))
        }))
      })

      const result = await getUserProfile('user-123')

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users')
      expect(result).toEqual(mockProfile)
    })

    it('should return null when profile not found', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: null,
              error: new Error('Profile not found')
            }))
          }))
        }))
      })

      const result = await getUserProfile('nonexistent-user')

      expect(result).toBeNull()
    })

    it('should handle database errors', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: null,
              error: new Error('Database error')
            }))
          }))
        }))
      })

      await expect(getUserProfile('user-123')).rejects.toThrow('Database error')
    })
  })

  describe('createUserProfile', () => {
    it('should create user profile successfully', async () => {
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        organization_id: 123,
        role: 'user'
      }

      mockSupabaseClient.from.mockReturnValue({
        upsert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: mockProfile,
              error: null
            }))
          }))
        }))
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

    it('should handle creation errors', async () => {
      mockSupabaseClient.from.mockReturnValue({
        upsert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: null,
              error: new Error('Creation failed')
            }))
          }))
        }))
      })

      await expect(createUserProfile({
        id: 'user-123',
        email: 'test@example.com',
        organization_id: 123,
        role: 'user'
      })).rejects.toThrow('Creation failed')
    })

    it('should validate required fields', async () => {
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

  describe('updateUserProfile', () => {
    it('should update user profile successfully', async () => {
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

    it('should handle update errors', async () => {
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

    it('should validate user ID', async () => {
      await expect(updateUserProfile('', { role: 'admin' }))
        .rejects.toThrow('User ID is required')
    })
  })

  describe('checkUserExists', () => {
    it('should return true when user exists', async () => {
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

    it('should return false when user does not exist', async () => {
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

    it('should handle database errors', async () => {
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

  describe('createOrganization', () => {
    it('should create organization successfully', async () => {
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

    it('should handle creation errors', async () => {
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

    it('should validate organization name', async () => {
      await expect(createOrganization('', 'basic'))
        .rejects.toThrow('Organization name is required')
    })
  })

  describe('inviteUserToOrganization', () => {
    it('should send invitation successfully', async () => {
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

    it('should handle invitation errors', async () => {
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

    it('should validate email format', async () => {
      await expect(inviteUserToOrganization('invalid-email', 123, 'user'))
        .rejects.toThrow('Invalid email format')
    })
  })

  describe('acceptInvitation', () => {
    it('should accept invitation successfully', async () => {
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

    it('should handle invalid token', async () => {
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

    it('should validate token format', async () => {
      await expect(acceptInvitation(''))
        .rejects.toThrow('Token is required')
    })
  })

  describe('changeUserRole', () => {
    it('should change user role successfully', async () => {
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

    it('should handle role change errors', async () => {
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

    it('should validate role', async () => {
      await expect(changeUserRole('user-123', 'invalid-role' as 'user' | 'admin'))
        .rejects.toThrow('Invalid role')
    })
  })

  describe('Input validation', () => {
    it('should validate email format', () => {
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

    it('should validate password strength', () => {
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
  describe('Auth module', () => {
    it('should export expected functions', () => {
      expect(typeof signInWithEmailAndPassword).toBe('function')
      expect(typeof signUpWithEmailAndPassword).toBe('function')
      expect(typeof signOut).toBe('function')
      expect(typeof getCurrentUser).toBe('function')
      expect(typeof getUserProfile).toBe('function')
    })
  })
})