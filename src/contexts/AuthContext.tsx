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
      console.log('AuthContext: Fetching user profile for:', userId)
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

      console.log('AuthContext: User profile loaded:', { 
        role: profile?.role, 
        orgId: profile?.organization_id,
        email: profile?.email,
        isAnonymous: !profile?.email 
      })
      setUserProfile(profile)
      
      // Handle organization - it might be null for anonymous users or array
      const orgData = profile?.organizations
      setOrganization(Array.isArray(orgData) ? orgData[0] : orgData as Organization || null)
      
      console.log('AuthContext: Profile fetch completed')
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
        console.log('AuthContext: Getting initial session...')
        setLoading(true)
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Auth session error:', error)
        } else {
          console.log('AuthContext: Initial session:', session?.user?.id ?? 'no user')
        }
        
        if (isMounted) {
          setUser(session?.user ?? null)
          if (session?.user) {
            console.log('AuthContext: User found, fetching profile...')
            await fetchUserProfile(session.user.id)
          } else {
            console.log('AuthContext: No user, clearing profile...')
            setUserProfile(null)
            setOrganization(null)
          }
          console.log('AuthContext: Setting loading to false (initial)')
          setLoading(false)
        }
      } catch (error) {
        console.error('Failed to get session:', error)
        if (isMounted) {
          console.log('AuthContext: Error occurred, setting loading to false')
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
        console.warn('AuthContext: Timeout reached, forcing loading to false')
        setLoading(false)
      }
    }, 10000) // 10 seconds timeout

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthContext: Auth state change:', {
          event,
          userId: session?.user?.id ?? 'no user',
          hasSession: !!session,
          timestamp: new Date().toISOString()
        })
        
        if (isMounted) {
          setUser(session?.user ?? null)
          if (session?.user) {
            console.log('AuthContext: Auth change - fetching profile...')
            await fetchUserProfile(session.user.id)
          } else {
            console.log('AuthContext: Auth change - clearing profile...')
            setUserProfile(null)
            setOrganization(null)
          }
          console.log('AuthContext: Setting loading to false (auth change)')
          setLoading(false)
        }
        
        // For sign in events, double check the session
        if (event === 'SIGNED_IN' && session) {
          console.log('AuthContext: SIGNED_IN event detected, double-checking...')
          setTimeout(async () => {
            if (isMounted) {
              try {
                const { data: { session: currentSession }, error } = await supabase.auth.getSession()
                console.log('AuthContext: Double-check result:', {
                  hasSession: !!currentSession,
                  userId: currentSession?.user?.id ?? 'no user',
                  error: error?.message
                })
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
        
        // 追加のチェック：認証状態が失われる問題を検出
        if (event === 'SIGNED_OUT' && session === null) {
          console.warn('AuthContext: Unexpected SIGNED_OUT event detected')
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
    await supabase.auth.signOut()
    setUserProfile(null)
    setOrganization(null)
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
