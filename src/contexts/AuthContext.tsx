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
      const { data: profile, error } = await supabase
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

      setUserProfile(profile)
      
      // Handle organization - it might be null for anonymous users or array
      const orgData = profile?.organizations
      setOrganization(Array.isArray(orgData) ? orgData[0] : orgData as Organization || null)
      
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
            await fetchUserProfile(session.user.id)
          } else {
            setUserProfile(null)
            setOrganization(null)
          }
          setLoading(false)
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
    }, 10000) // 10 seconds timeout

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
        
        // For sign in events, double check the session
        if (event === 'SIGNED_IN' && session) {
          setTimeout(async () => {
            if (isMounted) {
              try {
                const { data: { session: currentSession } } = await supabase.auth.getSession()
                setUser(currentSession?.user ?? null)
                if (currentSession?.user) {
                  await fetchUserProfile(currentSession.user.id)
                }
              } catch (error) {
                console.error('AuthContext: Double-check error:', error)
              }
            }
          }, 100)
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
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('AuthContext: SignOut error:', error)
        throw error
      }
      setUserProfile(null)
      setOrganization(null)
    } catch (error) {
      console.error('AuthContext: SignOut failed:', error)
      // エラーが発生してもUIの状態は更新する
      setUserProfile(null)
      setOrganization(null)
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
