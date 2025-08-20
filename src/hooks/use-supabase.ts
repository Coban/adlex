'use client'

import { useState } from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/infra/supabase/clientClient'

export function useSupabase() {
  const [supabase] = useState(() => createClient())
  return supabase
}

export function useOrganization() {
  const { organization, loading: authLoading } = useAuth()

  // useAuthのローディング状態をそのまま利用する
  return { organization, loading: authLoading }
}


