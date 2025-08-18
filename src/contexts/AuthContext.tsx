'use client'

import { User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'

import { createClient } from '@/lib/supabase/client'
import { UserProfile, Organization } from '@/types'

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  organization: Organization | null
  loading: boolean
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AUTH_STATE_DELAY = 200

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const supabase = createClient()

  // Prevent hydration mismatch by waiting for client-side mount
  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      // JOINクエリで一回でユーザー情報と組織情報を取得
      const { data: userWithOrg, error } = await supabase
        .from('users')
        .select(`
          *,
          organizations (*)
        `)
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching user profile:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        // Set empty profile for anonymous users or users not in users table
        setUserProfile(null)
        setOrganization(null)
        return
      }
      
      if (!userWithOrg) {
        setUserProfile(null)
        setOrganization(null)
        return
      }

      setUserProfile(userWithOrg)
      
      // Set organization data from JOIN result
      if (userWithOrg.organizations) {
        setOrganization(userWithOrg.organizations)
      } else {
        setOrganization(null)
      }
      
    } catch (error) {
      console.error('Failed to fetch user profile:', error)
      setUserProfile(null)
      setOrganization(null)
    }
  }, [supabase])

  useEffect(() => {
    if (!mounted) return
    
    // In E2E (NEXT_PUBLIC_SKIP_AUTH), provide a mock authenticated session
    if (process.env.NEXT_PUBLIC_SKIP_AUTH === 'true' || process.env.SKIP_AUTH === 'true') {
      const mockUser = {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@test.com'
      } as unknown as User
      const mockProfile = {
        id: mockUser.id,
        email: mockUser.email,
        role: 'admin',
        organization_id: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as unknown as UserProfile
      const mockOrg = {
        id: 1,
        name: 'Test Org',
        plan: 'free',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        max_checks: 1000,
        used_checks: 0,
      } as unknown as Organization

      setUser(mockUser)
      setUserProfile(mockProfile)
      setOrganization(mockOrg)
      setLoading(false)
      return () => {}
    }

    let isMounted = true
    
    // Get initial session
    const getSession = async () => {
      try {
        setLoading(true)
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Auth session error:', error)
        }
        
        if (isMounted) {
          setUser(session?.user ?? null)
          if (session?.user) {
            try {
              await fetchUserProfile(session.user.id)
            } catch (error) {
              console.error('Error in fetchUserProfile:', error)
            }
            setLoading(false)
          } else {
            setUserProfile(null)
            setOrganization(null)
            setLoading(false)
          }
        }
      } catch (error) {
        console.error('Failed to get session:', error)
        if (isMounted) {
          setUser(null)
          setUserProfile(null)
          setOrganization(null)
          setLoading(false)
        }
      }
    }

    getSession()

    // Fallback timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        setLoading(false)
      }
    }, 2000) // 2 seconds timeout

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (isMounted) {
          setUser(session?.user ?? null)
          if (session?.user) {
            await fetchUserProfile(session.user.id)
          } else {
            setUserProfile(null)
            setOrganization(null)
          }
          setLoading(false)
        }
        
        // For sign in events, ensure state is fully updated
        if (event === 'SIGNED_IN' && session && isMounted) {
          // Give a bit more time for the session to be properly established
          setTimeout(async () => {
            if (isMounted) {
              try {
                const { data: { session: currentSession } } = await supabase.auth.getSession()
                if (currentSession?.user) {
                  setUser(currentSession.user)
                  await fetchUserProfile(currentSession.user.id)
                }
              } catch (error) {
                console.error('AuthContext: Double-check error:', error)
              }
            }
          }, AUTH_STATE_DELAY)
        }
      }
    )

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [supabase.auth, fetchUserProfile, mounted])

  const refresh = useCallback(async () => {
    if (user) {
      await fetchUserProfile(user.id)
    }
  }, [user, fetchUserProfile])

  const signOut = async () => {
    if (process.env.NEXT_PUBLIC_SKIP_AUTH === 'true' || process.env.SKIP_AUTH === 'true') {
      setUser(null)
      setUserProfile(null)
      setOrganization(null)
      return
    }
    // Try server-side signout first, but never abort the flow on failure
    try {
      const res = await fetch('/api/auth/signout', { method: 'POST' })
      if (!res.ok) {
        const msg = await res
          .json()
          .then((j) => j?.error as string)
          .catch(() => 'Signout API failed')
        console.warn('AuthContext signOut: Server signout failed:', msg)
      }
    } catch (error) {
      console.warn('AuthContext signOut: Server signout request error:', error)
    }

    // Always attempt client-side signout to clear browser-held session
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) {
        console.warn('AuthContext signOut: Supabase signOut failed:', signOutError)
      }
    } catch (error) {
      console.warn('AuthContext signOut: Supabase signOut threw:', error)
    }

    // Best-effort cleanup of any residual client storage/cookies
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const keys = Object.keys(localStorage)
        keys.forEach((key) => {
          if (key.includes('supabase') || key.includes('sb-')) {
            localStorage.removeItem(key)
          }
        })
      }
      if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
        const sessionKeys = Object.keys(sessionStorage)
        sessionKeys.forEach((key) => {
          if (key.includes('supabase') || key.includes('sb-')) {
            sessionStorage.removeItem(key)
          }
        })
      }
      if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof document.cookie === 'string') {
        document.cookie.split(';').forEach((cookie) => {
          const eqPos = cookie.indexOf('=')
          const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim()
          if (name.includes('supabase') || name.includes('sb-')) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
          }
        })
      }
    } catch (storageError) {
      console.warn('AuthContext signOut: Storage clear failed:', storageError)
    }

    // Clear local state no matter what
    setUser(null)
    setUserProfile(null)
    setOrganization(null)
  }

  // Show loading state during SSR and initial mount to prevent hydration mismatch
  if (!mounted) {
    return (
      <AuthContext.Provider value={{ user: null, userProfile: null, organization: null, loading: true, signOut, refresh: async () => {} }}>
        {children}
      </AuthContext.Provider>
    )
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, organization, loading, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
