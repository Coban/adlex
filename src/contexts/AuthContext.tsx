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
      console.log('Starting fetchUserProfile for userId:', userId)
      
      // First get the user profile
      console.log('Querying users table for id:', userId)
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      
      console.log('Users query result:', { profile, error })

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
        console.log('No profile found for user:', userId)
        setUserProfile(null)
        setOrganization(null)
        return
      }

      console.log('User profile fetched:', profile)
      setUserProfile(profile)
      
      // If user has an organization_id, fetch the organization separately
      if (profile?.organization_id) {
        console.log('Fetching organization for user:', profile.email, 'organization_id:', profile.organization_id)
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profile.organization_id)
          .maybeSingle()

        if (orgError) {
          console.error('Error fetching organization:', orgError)
          setOrganization(null)
        } else {
          console.log('Organization fetched:', org)
          setOrganization(org)
        }
      } else {
        console.log('No organization_id in profile:', profile)
        setOrganization(null)
      }
      
      console.log('fetchUserProfile completed')
      
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
        console.log('Auth loading timeout - forcing loading to false')
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
