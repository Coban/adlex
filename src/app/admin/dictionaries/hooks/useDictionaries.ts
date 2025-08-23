import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/infra/supabase/clientClient'
import { authFetch } from '@/lib/api-client'
import { Dictionary, Organization, EmbeddingStats, DictionaryStats } from '../types'

/**
 * 辞書データ管理用のカスタムフック
 */
export function useDictionaries() {
  const { organization, userProfile, loading: authLoading } = useAuth()
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([])
  const [fallbackOrganization, setFallbackOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [embeddingStats, setEmbeddingStats] = useState<EmbeddingStats | null>(null)
  const [embeddingRefreshLoading, setEmbeddingRefreshLoading] = useState(false)
  const [dictionaryStats, setDictionaryStats] = useState<DictionaryStats | null>(null)

  const loadDictionaries = useCallback(async () => {
    // Try loading dictionaries even if organization is null
    // This is a fallback for when auth context doesn't work properly
    if (!organization) {
      try {
        // Try to get dictionaries directly based on current user
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Get user profile directly from database
          const { data: userProfile, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .maybeSingle()
          
          if (!userError && userProfile?.organization_id) {
            // Also get the organization info for fallback
            const { data: orgData, error: orgError } = await supabase
              .from('organizations')
              .select('*')
              .eq('id', userProfile.organization_id)
              .maybeSingle()
            
            if (!orgError && orgData) {
              setFallbackOrganization(orgData)
            }
            
            const { data, error } = await supabase
              .from('dictionaries')
              .select('*')
              .eq('organization_id', userProfile.organization_id)
              .order('created_at', { ascending: false })

            if (!error && data) {
              setDictionaries(data || [])
              setLoading(false)
              return
            }
          }
        }
      } catch (error) {
        console.error('Fallback dictionary loading failed:', error)
      }
      
      setLoading(false)
      return
    }
    
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('dictionaries')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Dictionary loading error:', error)
        throw error
      }
      
      setDictionaries(data || [])
    } catch (error) {
      console.error('辞書の読み込みに失敗しました:', error)
    } finally {
      setLoading(false)
    }
  }, [organization])

  const loadEmbeddingStats = useCallback(async () => {
    const currentOrg = organization ?? fallbackOrganization
    if (!currentOrg || !userProfile || userProfile.role !== 'admin') return
    
    try {
      const response = await authFetch('/api/dictionaries/embeddings/refresh', {
        method: 'GET',
      })
      
      if (response.ok) {
        const stats = await response.json()
        setEmbeddingStats(stats)
      }
    } catch (error) {
      console.error('Embedding統計情報の読み込みに失敗しました:', error)
    }
  }, [organization, fallbackOrganization, userProfile])

  const loadDictionaryStats = useCallback(async () => {
    const currentOrg = organization ?? fallbackOrganization
    if (!currentOrg || !userProfile || userProfile.role !== 'admin') return
    try {
      const res = await authFetch('/api/dictionaries/stats', { method: 'GET' })
      if (res.ok) {
        const data = await res.json()
        setDictionaryStats(data)
      }
    } catch (e) {
      console.error('辞書統計の読み込みに失敗しました:', e)
    }
  }, [organization, fallbackOrganization, userProfile])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(false)
    }, 5000)

    if (!authLoading) {
      const currentOrg = organization ?? fallbackOrganization
      if (currentOrg) {
        loadDictionaries()
        loadEmbeddingStats()
        loadDictionaryStats()
      } else {
        // If no organization after auth is done, try fallback loading
        loadDictionaries()
        const orgTimeout = setTimeout(() => {
          setLoading(false)
        }, 3000)
        return () => clearTimeout(orgTimeout)
      }
    }

    return () => clearTimeout(timeout)
  }, [organization, fallbackOrganization, authLoading, loadDictionaries, loadEmbeddingStats, loadDictionaryStats])

  const refreshData = useCallback(() => {
    loadDictionaries()
    loadEmbeddingStats()
    loadDictionaryStats()
  }, [loadDictionaries, loadEmbeddingStats, loadDictionaryStats])

  return {
    dictionaries,
    setDictionaries,
    fallbackOrganization,
    loading,
    embeddingStats,
    embeddingRefreshLoading,
    setEmbeddingRefreshLoading,
    dictionaryStats,
    loadDictionaries,
    loadEmbeddingStats,
    loadDictionaryStats,
    refreshData,
  }
}