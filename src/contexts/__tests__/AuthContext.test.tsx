import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createClient } from '@/lib/supabase/client'

import { AuthProvider, useAuth } from '../AuthContext'

// Get the mocked client from the global setup
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSupabaseClient = createClient() as any

// Test component that uses the AuthContext
function TestComponent() {
  const { user, userProfile, organization, loading, signOut } = useAuth()

  return (
    <div>
      <div data-testid="loading">{loading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="user">{user ? (user as any).email : 'No User'}</div>
      <div data-testid="user-profile">{userProfile ? JSON.stringify(userProfile) : 'No Profile'}</div>
      <div data-testid="organization">{organization ? organization.name : 'No Organization'}</div>
      <button onClick={signOut}>Sign Out</button>
    </div>
  )
}

// Mock fetch
global.fetch = vi.fn()

describe.skip('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock fetch
    const mockFetch = fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({})
    } as Response)
    
    // Mock default auth state
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    })
    
    mockSupabaseClient.auth.signOut.mockResolvedValue({
      error: null
    })
    
    // Mock Supabase queries
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      })
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
    expect(screen.getByTestId('user-profile')).toHaveTextContent('No Profile')
    expect(screen.getByTestId('organization')).toHaveTextContent('No Organization')
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
    })
  })

  it('should handle user with profile and organization', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com'
    }

    const mockProfile = {
      id: 'user-123',
      email: 'test@example.com',
      organization_id: 1,
      role: 'admin',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    const mockOrganization = {
      id: 1,
      name: 'Test Organization',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      monthly_limit: 1000,
      monthly_usage: 50
    }

    // Mock session with user
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'mock-token',
          user: mockUser
        }
      },
      error: null
    })

    // Mock profile and organization queries
  mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockProfile,
                error: null
              })
            })
          })
        }
      }
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockOrganization,
                error: null
              })
            })
          })
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      }
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
      expect(screen.getByTestId('organization')).toHaveTextContent('Test Organization')
    }, { timeout: 3000 })
  })

  it('should handle profile fetch errors', async () => {
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

    // Mock profile query with error
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Profile fetch failed')
          })
        })
      })
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
      expect(screen.getByTestId('user-profile')).toHaveTextContent('No Profile')
      expect(screen.getByTestId('organization')).toHaveTextContent('No Organization')
    })
  })

  it('should handle sign out', async () => {
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
      fireEvent.click(signOutButton)
    })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/auth/signout', { method: 'POST' })
      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled()
      expect(screen.getByTestId('user')).toHaveTextContent('No User')
      expect(screen.getByTestId('user-profile')).toHaveTextContent('No Profile')
      expect(screen.getByTestId('organization')).toHaveTextContent('No Organization')
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

  it('should handle organization fetch error', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com'
    }

    const mockProfile = {
      id: 'user-123',
      email: 'test@example.com',
      organization_id: 1,
      role: 'user',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
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

    // Mock profile query success, organization query failure
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockProfile,
                error: null
              })
            })
          })
        }
      }
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: new Error('Organization fetch failed')
              })
            })
          })
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      }
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
      expect(screen.getByTestId('organization')).toHaveTextContent('No Organization')
    })
  })
})