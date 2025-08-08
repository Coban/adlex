'use client'

import { User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'

import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'

type UserProfile = Database['public']['Tables']['users']['Row']
type Organization = Database['public']['Tables']['organizations']['Row']

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  organization: Organization | null
  loading: boolean
  signOut: () => Promise<void>
}

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
      // First get the user profile
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
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
      
      if (!profile) {
        setUserProfile(null)
        setOrganization(null)
        return
      }

      setUserProfile(profile)
      
      // If user has an organization_id, fetch the organization separately
      if (profile?.organization_id) {
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profile.organization_id)
          .maybeSingle()

        if (orgError) {
          console.error('Error fetching organization:', orgError)
          setOrganization(null)
        } else {
          setOrganization(org)
        }
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
    }, 5000) // 5 seconds timeout

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
          }, 200)
        }
      }
    )

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [supabase.auth, fetchUserProfile, mounted])

  const signOut = async () => {
    try {
      // Clear local state first
      setUser(null)
      setUserProfile(null)
      setOrganization(null)
      
      // Force clear any remaining auth data in localStorage/sessionStorage
      try {
        // Clear all possible Supabase auth keys
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          const keys = Object.keys(localStorage)
          keys.forEach(key => {
            if (key.includes('supabase') || key.includes('sb-')) {
              localStorage.removeItem(key)
            }
          })
        }
        
        // Clear session storage (selectively for Supabase-related keys)
        if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
          const sessionKeys = Object.keys(sessionStorage)
          sessionKeys.forEach(key => {
            if (key.includes('supabase') || key.includes('sb-')) {
              sessionStorage.removeItem(key)
            }
          })
        }
        
        // Clear any cookies
        if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof document.cookie === 'string') {
          document.cookie.split(";").forEach(cookie => {
            const eqPos = cookie.indexOf("=")
            const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim()
            if (name.includes('supabase') || name.includes('sb-')) {
              document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
            }
          })
        }
        
      } catch (storageError) {
        console.warn('AuthContext signOut: Storage clear failed:', storageError)
      }
      
      // Sign out from Supabase and propagate errors to callers
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) {
        console.warn('AuthContext signOut: Supabase signOut failed:', signOutError)
        throw signOutError
      }
      
      // Let the auth state change event handle the UI update naturally
      // No forced redirect needed
      
    } catch (error) {
      console.error('AuthContext: SignOut failed:', error)
      // Clear local state even on error
      setUser(null)
      setUserProfile(null)
      setOrganization(null)
      // Re-throw to allow callers to handle the failure
      throw error
    }
  }

  // Show loading state during SSR and initial mount to prevent hydration mismatch
  if (!mounted) {
    return (
      <AuthContext.Provider value={{ user: null, userProfile: null, organization: null, loading: true, signOut }}>
        {children}
      </AuthContext.Provider>
    )
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, organization, loading, signOut }}>
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
