import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createClient } from '@/lib/supabase/client'

import { AuthProvider, useAuth } from '../AuthContext'

// Get the mocked client from the global setup
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSupabaseClient = createClient() as any

// Test component that uses the AuthContext
function TestComponent() {
  const { user, loading, signOut } = useAuth()

  return (
    <div>
      <div data-testid="loading">{loading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="user">{user ? user.email : 'No User'}</div>
      <button onClick={signOut}>Sign Out</button>
    </div>
  )
}

describe.skip('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock default auth state
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    })
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockSupabaseClient.auth.onAuthStateChange.mockImplementation((_callback: any) => {
      // Return a mock subscription
      return {
        data: { subscription: { unsubscribe: vi.fn() } }
      }
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('should provide initial loading state', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(screen.getByTestId('loading')).toHaveTextContent('Loading')
    expect(screen.getByTestId('user')).toHaveTextContent('No User')
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
    })
  })

  it('should handle successful sign in', async () => {
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

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
    })

    const signInButton = screen.getByText('Sign In')
    
    await act(async () => {
      signInButton.click()
    })

    await waitFor(() => {
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      })
    })
  })

  it('should handle sign in errors', async () => {
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error('Invalid credentials')
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
    })

    const signInButton = screen.getByText('Sign In')
    
    await act(async () => {
      signInButton.click()
    })

    await waitFor(() => {
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalled()
    })
  })

  it('should handle sign out', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com'
    }

    // Start with authenticated user
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'mock-token',
          user: mockUser
        }
      },
      error: null
    })

    mockSupabaseClient.auth.signOut.mockResolvedValue({
      error: null
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
    })

    const signOutButton = screen.getByText('Sign Out')
    
    await act(async () => {
      signOutButton.click()
    })

    await waitFor(() => {
      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled()
    })
  })

  it('should handle sign out errors', async () => {
    mockSupabaseClient.auth.signOut.mockResolvedValue({
      error: new Error('Sign out failed')
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
    })

    const signOutButton = screen.getByText('Sign Out')
    
    await act(async () => {
      signOutButton.click()
    })

    await waitFor(() => {
      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled()
    })
  })

  it('should restore session on initialization', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com'
    }

    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'mock-token',
          user: mockUser
        }
      },
      error: null
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
    })
  })

  it('should handle auth state changes', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com'
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let authStateCallback: (event: string, session: any) => void

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockSupabaseClient.auth.onAuthStateChange.mockImplementation((callback: any) => {
      authStateCallback = callback
      return {
        data: { subscription: { unsubscribe: vi.fn() } }
      }
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
    })

    // Simulate auth state change
    await act(async () => {
      authStateCallback('SIGNED_IN', {
        access_token: 'mock-token',
        user: mockUser
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
    })

    // Simulate sign out
    await act(async () => {
      authStateCallback('SIGNED_OUT', null)
    })

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('No User')
    })
  })

  it('should handle session errors', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: new Error('Session error')
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      expect(screen.getByTestId('user')).toHaveTextContent('No User')
    })
  })

  it('should throw error when useAuth is used outside provider', () => {
    // Mock console.error to prevent error output in tests
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<TestComponent />)
    }).toThrow('useAuth must be used within an AuthProvider')

    consoleSpy.mockRestore()
  })

  it('should handle user profile loading', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com'
    }

    const mockProfile = {
      id: 'user-123',
      email: 'test@example.com',
      organization_id: 'org-123',
      role: 'user'
    }

    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'mock-token',
          user: mockUser
        }
      },
      error: null
    })

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

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
    })

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('users')
  })

  it('should handle user profile loading errors', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com'
    }

    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'mock-token',
          user: mockUser
        }
      },
      error: null
    })

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

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
    })
  })

  it('should clean up auth subscription on unmount', async () => {
    const mockUnsubscribe = vi.fn()

    mockSupabaseClient.auth.onAuthStateChange.mockImplementation(() => ({
      data: { subscription: { unsubscribe: mockUnsubscribe } }
    }))

    const { unmount } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
    })

    unmount()

    expect(mockUnsubscribe).toHaveBeenCalled()
  })

  it('should handle multiple rapid auth state changes', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com'
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let authStateCallback: (event: string, session: any) => void

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockSupabaseClient.auth.onAuthStateChange.mockImplementation((callback: any) => {
      authStateCallback = callback
      return {
        data: { subscription: { unsubscribe: vi.fn() } }
      }
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
    })

    // Simulate rapid auth state changes
    await act(async () => {
      authStateCallback('SIGNED_IN', {
        access_token: 'mock-token',
        user: mockUser
      })
      authStateCallback('SIGNED_OUT', null)
      authStateCallback('SIGNED_IN', {
        access_token: 'mock-token-2',
        user: mockUser
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
    })
  })

  it('should handle concurrent sign in attempts', async () => {
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

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
    })

    const signInButton = screen.getByText('Sign In')
    
    // Simulate rapid clicks
    await act(async () => {
      signInButton.click()
      signInButton.click()
      signInButton.click()
    })

    await waitFor(() => {
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledTimes(3)
    })
  })

  it('should preserve user state during re-renders', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com'
    }

    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'mock-token',
          user: mockUser
        }
      },
      error: null
    })

    const { rerender } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
    })

    // Re-render the component
    rerender(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
  })
})