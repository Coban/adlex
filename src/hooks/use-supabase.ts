'use client'

import type { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

export function useSupabase() {
  const [supabase] = useState(() => createClient())
  return supabase
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = useSupabase()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  return { user, loading }
}

export function useOrganization() {
  const { user } = useUser()
  const [organization, setOrganization] = useState<{
    id: number
    name: string
    plan: 'trial' | 'basic'
    max_checks: number
    used_checks: number
    trial_ends_at: string | null
    role: 'admin' | 'user'
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = useSupabase()

  useEffect(() => {
    const getOrganization = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select(`
          organization_id, 
          role, 
          organizations (
            id,
            name,
            plan,
            max_checks,
            used_checks,
            trial_ends_at
          )
        `)
        .eq('id', user.id)
        .single()

      if (userData?.organizations) {
        const org = userData.organizations as {
          id: number
          name: string
          plan: 'trial' | 'basic' | null
          max_checks: number | null
          used_checks: number | null
          trial_ends_at: string | null
        }

        setOrganization({
          id: org.id,
          name: org.name,
          plan: org.plan || 'trial',
          max_checks: org.max_checks || 0,
          used_checks: org.used_checks || 0,
          trial_ends_at: org.trial_ends_at,
          role: userData.role ?? 'user'
        })
      }
      setLoading(false)
    }

    getOrganization()
  }, [user, supabase])

  return { organization, loading }
}
