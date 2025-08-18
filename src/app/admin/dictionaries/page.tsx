'use client'

import { useState, useEffect, useCallback } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database.types'

type Dictionary = Database['public']['Tables']['dictionaries']['Row']
type Organization = Database['public']['Tables']['organizations']['Row']

interface EmbeddingStats {
  organizationId: number;
  totalItems: number;
  itemsWithEmbedding: number;
  itemsWithoutEmbedding: number;
  embeddingCoverageRate: number;
}

export default function DictionariesPage() {
  const { organization, userProfile, loading: authLoading } = useAuth()
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([])
  const [fallbackOrganization, setFallbackOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [embeddingStats, setEmbeddingStats] = useState<EmbeddingStats | null>(null)
  const [embeddingRefreshLoading, setEmbeddingRefreshLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'NG' | 'ALLOW'>('ALL')
  const [sortOption, setSortOption] = useState<
    | 'created_desc'
    | 'created_asc'
    | 'updated_desc'
    | 'updated_asc'
    | 'phrase_asc'
    | 'phrase_desc'
    | 'category_asc'
    | 'category_desc'
  >('created_desc')
  const [editingDictionary, setEditingDictionary] = useState<Dictionary | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    phrase: '',
    category: 'NG' as 'NG' | 'ALLOW',
    notes: ''
  })
  const [message, setMessage] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState<number | null>(null)
  const [importing, setImporting] = useState(false)
  // 2.5 追加: 統計/重複/一括編集用の状態
  interface DictionaryStats { totals: { total: number; ng: number; allow: number }; topUsed: { dictionary_id: number; count: number; phrase: string }[]; since: string }
  const [dictionaryStats, setDictionaryStats] = useState<DictionaryStats | null>(null)
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false)
  const [duplicates, setDuplicates] = useState<{ phrase: string; items: Dictionary[] }[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const loadDictionaries = useCallback(async () => {
    // Try loading dictionaries even if organization is null
    // This is a fallback for when auth context doesn't work properly
    if (!organization) {
      try {
        // Try to get dictionaries directly based on current user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Get user profile directly from database
          const { data: userProfile, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
          
          if (!userError && userProfile?.organization_id) {
            // Also get the organization info for fallback
            const { data: orgData, error: orgError } = await supabase
              .from('organizations')
              .select('*')
              .eq('id', userProfile.organization_id)
              .maybeSingle();
            
            if (!orgError && orgData) {
              setFallbackOrganization(orgData);
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
      const response = await fetch('/api/dictionaries/embeddings/refresh', {
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

  // 2.5 追加: 辞書統計の読み込み
  const loadDictionaryStats = useCallback(async () => {
    const currentOrg = organization ?? fallbackOrganization
    if (!currentOrg || !userProfile || userProfile.role !== 'admin') return
    try {
      const res = await fetch('/api/dictionaries/stats', { method: 'GET' })
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const currentOrg = organization ?? fallbackOrganization
    if (!currentOrg) return

    try {
      const response = await fetch('/api/dictionaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phrase: formData.phrase.trim(),
          category: formData.category,
          notes: formData.notes.trim() || null
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error ?? '辞書項目の作成に失敗しました')
      }

      if (result.warning) {
        alert(result.warning)
      }

      setMessage('辞書に追加しました')
      setTimeout(() => setMessage(''), 3000)
      setFormData({ phrase: '', category: 'NG', notes: '' })
      setShowAddForm(false)
      loadDictionaries()
      loadEmbeddingStats()
    } catch (error) {
      console.error('辞書項目の作成に失敗しました:', error)
      alert(error instanceof Error ? error.message : '辞書項目の作成に失敗しました')
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDictionary) return

    try {
      const response = await fetch(`/api/dictionaries/${editingDictionary.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phrase: formData.phrase.trim(),
          category: formData.category,
          notes: formData.notes.trim() || null
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error ?? '辞書項目の更新に失敗しました')
      }

      if (result.warning) {
        alert(result.warning)
      }

      setMessage('辞書を更新しました')
      setTimeout(() => setMessage(''), 3000)
      setEditingDictionary(null)
      setFormData({ phrase: '', category: 'NG', notes: '' })
      loadDictionaries()
      loadEmbeddingStats()
    } catch (error) {
      console.error('辞書項目の更新に失敗しました:', error)
      alert(error instanceof Error ? error.message : '辞書項目の更新に失敗しました')
    }
  }

  const handleDeleteRequest = (id: number) => {
    setShowDeleteDialog(id)
  }

  const handleDelete = async () => {
    if (!showDeleteDialog) return

    try {
      const { error } = await supabase
        .from('dictionaries')
        .delete()
        .eq('id', showDeleteDialog)

      if (error) throw error
      
      setMessage('辞書から削除しました')
      setTimeout(() => setMessage(''), 3000)
      setShowDeleteDialog(null)
      loadDictionaries()
      loadEmbeddingStats()
    } catch (error) {
      console.error('辞書項目の削除に失敗しました:', error)
    }
  }

  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  // ジョブIDはUI表示には未使用。内部進捗管理用に保持
  const [, setRegenerateJobId] = useState<string | null>(null)

  const handleRefreshAllEmbeddings = async () => {
    setShowRegenerateDialog(false)
    setIsRegenerating(true)
    setEmbeddingRefreshLoading(true)
    setMessage('埋め込みを再生成中...')
    
    try {
      const response = await fetch('/api/dictionaries/embeddings/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error ?? 'Embedding再生成に失敗しました')
      }

      if (result.jobId) {
        setRegenerateJobId(result.jobId)
        pollEmbeddingJob(result.jobId)
      } else {
        // 後方互換: 同期レスポンスの場合
        setMessage('埋め込みの再生成が完了しました')
        setTimeout(() => setMessage(''), 5000)
        loadDictionaries()
        loadEmbeddingStats()
      }
    } catch (error) {
      console.error('Embedding再生成に失敗しました:', error)
      setMessage('Embedding再生成に失敗しました')
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setEmbeddingRefreshLoading(false)
      setIsRegenerating(false)
    }
  }

  const pollEmbeddingJob = async (jobId: string) => {
    let finished = false
    try {
      while (!finished) {
        const res = await fetch(`/api/dictionaries/embeddings/refresh?jobId=${encodeURIComponent(jobId)}`, {
          method: 'GET'
        })
        const status = await res.json()
        if (!res.ok) throw new Error(status.error ?? 'ジョブの取得に失敗しました')
        if (status.status === 'completed') {
          setMessage(`埋め込みの再生成が完了しました（成功: ${status.success}, 失敗: ${status.failure}）`)
          setTimeout(() => setMessage(''), 5000)
          finished = true
          setRegenerateJobId(null)
          loadDictionaries()
          loadEmbeddingStats()
        } else if (status.status === 'failed') {
          setMessage('Embedding再生成ジョブが失敗しました')
          setTimeout(() => setMessage(''), 5000)
          finished = true
          setRegenerateJobId(null)
        } else {
          // queued / processing
          setMessage(`埋め込みを再生成中... (${status.processed}/${status.total})`)
          await new Promise(r => setTimeout(r, 1500))
        }
      }
    } catch (e) {
      console.error('ジョブポーリングに失敗:', e)
      setRegenerateJobId(null)
    }
  }

  const startEdit = (dictionary: Dictionary) => {
    setEditingDictionary(dictionary)
    setFormData({
      phrase: dictionary.phrase,
      category: dictionary.category,
      notes: dictionary.notes ?? ''
    })
    setShowAddForm(false)
  }

  const cancelEdit = () => {
    setEditingDictionary(null)
    setFormData({ phrase: '', category: 'NG', notes: '' })
  }

  // --- 高度な検索クエリの解析・評価 ---
  function tokenizeAdvancedQuery(query: string) {
    const result = {
      includeGroups: [] as string[][], // AND of groups, OR within group (split by '|')
      excludes: [] as string[],
    }

    if (!query.trim()) return result

    const lower = query.toLowerCase()

    // Extract quoted phrases
    const quoted: string[] = []
    const remainder = lower.replace(/"([^\"]+)"/g, (_m, p1) => {
      quoted.push(`\"${p1.trim()}\"`)
      return ' '
    })

    const rawTokens = [
      ...quoted,
      ...remainder
        .split(/\s+/)
        .map(t => t.trim())
        .filter(Boolean),
    ]

    for (const token of rawTokens) {
      if (!token) continue
      if (token.startsWith('-')) {
        const t = token.slice(1)
        if (t) result.excludes.push(t)
        continue
      }

      // OR grouping within a single space-separated token using '|'
      const group = token.split('|').map(t => t.trim()).filter(Boolean)
      if (group.length > 0) {
        result.includeGroups.push(group)
      }
    }

    return result
  }

  function fieldMatch(value: string | null | undefined, token: string) {
    if (!value) return false
    const v = value.toLowerCase()
    // Exact phrase: "..."
    if (token.startsWith('"') && token.endsWith('"')) {
      const phrase = token.slice(1, -1)
      return v.includes(phrase)
    }
    return v.includes(token)
  }

  function matchesToken(dict: Dictionary, token: string) {
    // Field specific: phrase:xxx or notes:xxx
    if (token.startsWith('phrase:')) {
      return fieldMatch(dict.phrase, token.replace(/^phrase:/, ''))
    }
    if (token.startsWith('notes:')) {
      return fieldMatch(dict.notes ?? '', token.replace(/^notes:/, ''))
    }
    // Category specific: category:ng or category:allow (case-insensitive)
    if (token.startsWith('category:')) {
      const val = token.replace(/^category:/, '').toUpperCase()
      return dict.category.toUpperCase() === val
    }
    // Default: match in phrase or notes
    return fieldMatch(dict.phrase, token) || fieldMatch(dict.notes ?? '', token)
  }

  function matchesAdvancedQuery(dict: Dictionary, query: string) {
    const { includeGroups, excludes } = tokenizeAdvancedQuery(query)

    // AND across groups: each group needs at least one token match
    for (const group of includeGroups) {
      let any = false
      for (const token of group) {
        if (matchesToken(dict, token)) {
          any = true
          break
        }
      }
      if (!any) return false
    }

    // Excludes: if any exclude token matches, reject
    for (const token of excludes) {
      if (matchesToken(dict, token)) return false
    }

    return true
  }

  const filteredDictionaries = dictionaries
    .filter(dict => {
      // Category filter first
      const matchesCategory = selectedCategory === 'ALL' || dict.category === selectedCategory
      if (!matchesCategory) return false

      // Advanced search on searchTerm
      if (!searchTerm.trim()) return true
      return matchesAdvancedQuery(dict, searchTerm)
    })
    .sort((a, b) => {
      switch (sortOption) {
        case 'created_desc':
          return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
        case 'created_asc':
          return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
        case 'updated_desc': {
          const au = a.updated_at ?? a.created_at ?? ''
          const bu = b.updated_at ?? b.created_at ?? ''
          return new Date(bu).getTime() - new Date(au).getTime()
        }
        case 'updated_asc': {
          const au = a.updated_at ?? a.created_at ?? ''
          const bu = b.updated_at ?? b.created_at ?? ''
          return new Date(au).getTime() - new Date(bu).getTime()
        }
        case 'phrase_asc':
          return (a.phrase ?? '').localeCompare(b.phrase ?? '', 'ja', { sensitivity: 'base' })
        case 'phrase_desc':
          return (b.phrase ?? '').localeCompare(a.phrase ?? '', 'ja', { sensitivity: 'base' })
        case 'category_asc': {
          const order = { NG: 0, ALLOW: 1 } as const
          return order[a.category] - order[b.category]
        }
        case 'category_desc': {
          const order = { NG: 0, ALLOW: 1 } as const
          return order[b.category] - order[a.category]
        }
        default:
          return 0
      }
    })

  const ngDictionaries = filteredDictionaries.filter(d => d.category === 'NG')
  const allowDictionaries = filteredDictionaries.filter(d => d.category === 'ALLOW')

  const isAdmin = userProfile?.role === 'admin'
  const effectiveOrganization = organization ?? fallbackOrganization

  if (authLoading) {
    return <div className="p-6">認証中...</div>
  }
  
  if (loading) {
    return <div className="p-6">辞書読み込み中...</div>
  }

  if (!effectiveOrganization && dictionaries.length === 0) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">辞書管理</h1>
            <p className="text-muted-foreground">組織の薬機法チェック辞書を管理します</p>
          </div>
          <Button data-testid="add-phrase-button" disabled>
            新規作成
          </Button>
        </div>
        <div data-testid="dictionary-list" className="space-y-2">
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              組織が設定されていません (userProfile: {userProfile?.email ?? 'null'})
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">辞書管理</h1>
          <p className="text-muted-foreground">組織の薬機法チェック辞書を管理します</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <Button 
                onClick={async () => {
                  setShowDuplicatesDialog(true)
                  try {
                    const res = await fetch('/api/dictionaries/duplicates', { method: 'GET' })
                    const json = await res.json()
                    if (!res.ok) throw new Error(json.error ?? '重複検出に失敗しました')
                    setDuplicates(json.duplicates ?? [])
                  } catch (e) {
                    console.error('重複検出失敗', e)
                    setDuplicates([])
                  }
                }}
                variant="outline"
                data-testid="detect-duplicates"
              >
                重複検出
              </Button>
              <Button
                onClick={async () => {
                  if (selectedIds.size === 0) return alert('項目を選択してください')
                  const category = window.prompt('一括カテゴリ変更: NG または ALLOW を入力', 'NG')
                  if (!category) return
                  const upper = category.toUpperCase()
                  if (upper !== 'NG' && upper !== 'ALLOW') return alert('NG/ALLOW のいずれかを指定してください')
                  try {
                    const updates = Array.from(selectedIds).map(id => ({ id, patch: { category: upper as 'NG' | 'ALLOW' } }))
                    const res = await fetch('/api/dictionaries/bulk-update', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ updates })
                    })
                    const json = await res.json()
                    if (!res.ok) throw new Error(json.error ?? '一括更新に失敗しました')
                    setMessage(`一括更新完了: 成功 ${json.success ?? 0} 件 / 失敗 ${json.failure ?? 0} 件`)
                    setTimeout(() => setMessage(''), 4000)
                    setSelectedIds(new Set())
                    loadDictionaries()
                    loadDictionaryStats()
                  } catch (e) {
                    alert(e instanceof Error ? e.message : '一括更新に失敗しました')
                  }
                }}
                variant="outline"
                data-testid="bulk-category"
              >一括カテゴリ</Button>
              <Button
                onClick={async () => {
                  if (selectedIds.size === 0) return alert('項目を選択してください')
                  const notes = window.prompt('一括で備考を設定します。空でクリア。', '')
                  if (notes === null) return
                  try {
                    const value = notes.trim()
                    const patch = value === '' ? { notes: null } : { notes: value }
                    const updates = Array.from(selectedIds).map(id => ({ id, patch }))
                    const res = await fetch('/api/dictionaries/bulk-update', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ updates })
                    })
                    const json = await res.json()
                    if (!res.ok) throw new Error(json.error ?? '一括更新に失敗しました')
                    setMessage(`一括更新完了: 成功 ${json.success ?? 0} 件 / 失敗 ${json.failure ?? 0} 件`)
                    setTimeout(() => setMessage(''), 4000)
                    setSelectedIds(new Set())
                    loadDictionaries()
                  } catch (e) {
                    alert(e instanceof Error ? e.message : '一括更新に失敗しました')
                  }
                }}
                variant="outline"
                data-testid="bulk-notes"
              >一括メモ</Button>
              <Button 
                onClick={async () => {
                  try {
                    const res = await fetch('/api/dictionaries/export', { method: 'GET' })
                    if (!res.ok) {
                      const j = await res.json().catch(() => ({}))
                      throw new Error(j.error ?? 'エクスポートに失敗しました')
                    }
                    const blob = await res.blob()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'dictionaries.csv'
                    document.body.appendChild(a)
                    a.click()
                    a.remove()
                    URL.revokeObjectURL(url)
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'エクスポートに失敗しました')
                  }
                }}
                variant="outline"
                data-testid="export-csv"
              >
                エクスポートCSV
              </Button>
              <label className="inline-flex">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={async (ev) => {
                    const file = ev.target.files?.[0]
                    if (!file) return
                    setImporting(true)
                    try {
                      const text = await file.text()
                      const res = await fetch('/api/dictionaries/import', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'text/csv; charset=utf-8',
                        },
                        body: text,
                      })
                      const json = await res.json().catch(() => ({}))
                      if (!res.ok) {
                        throw new Error(json.error ?? 'インポートに失敗しました')
                      }
                      setMessage(`インポート完了: 追加 ${json.inserted ?? 0} 件, スキップ ${json.skipped?.length ?? 0} 件`)
                      setTimeout(() => setMessage(''), 5000)
                      loadDictionaries()
                      loadEmbeddingStats()
                    } catch (e) {
                      console.error('CSVインポート失敗', e)
                      alert(e instanceof Error ? e.message : 'CSVインポートに失敗しました')
                    } finally {
                      setImporting(false)
                      // リセット
                      ;(ev.target as HTMLInputElement).value = ''
                    }
                  }}
                />
                <Button asChild disabled={importing} data-testid="import-csv">
                  <span>{importing ? 'インポート中...' : 'インポートCSV'}</span>
                </Button>
              </label>
            </>
          )}
          {isAdmin && (
            <Button 
              onClick={() => setShowRegenerateDialog(true)} 
              disabled={embeddingRefreshLoading}
              variant="outline"
              data-testid="regenerate-embeddings"
            >
              {embeddingRefreshLoading ? 'Embedding再生成中...' : 'Embedding再生成'}
            </Button>
          )}
          <Button onClick={() => setShowAddForm(true)} disabled={showAddForm} data-testid="add-phrase-button">
            新規作成
          </Button>
        </div>
      </div>

      {/* Success Message */}
      {message && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md" data-testid="success-message">
          <p className="text-green-800 text-sm">{message}</p>
        </div>
      )}

      {/* Processing Message */}
      {isRegenerating && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md" data-testid="processing-message">
          <p className="text-blue-800 text-sm">埋め込みを再生成中...</p>
        </div>
      )}

      {/* Embedding統計情報（管理者のみ） */}
      {isAdmin && embeddingStats && (
        <Card>
          <CardHeader>
            <CardTitle>Embedding統計情報</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{embeddingStats.totalItems}</div>
                <div className="text-sm text-muted-foreground">総項目数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{embeddingStats.itemsWithEmbedding}</div>
                <div className="text-sm text-muted-foreground">Embedding済み</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{embeddingStats.itemsWithoutEmbedding}</div>
                <div className="text-sm text-muted-foreground">Embedding未済</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{embeddingStats.embeddingCoverageRate}%</div>
                <div className="text-sm text-muted-foreground">カバー率</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 辞書統計（管理者のみ） */}
      {isAdmin && dictionaryStats && (
        <Card>
          <CardHeader>
            <CardTitle>辞書統計（最近30日 使用頻度）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{dictionaryStats.totals.total}</div>
                <div className="text-sm text-muted-foreground">総項目数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{dictionaryStats.totals.ng}</div>
                <div className="text-sm text-muted-foreground">NG</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{dictionaryStats.totals.allow}</div>
                <div className="text-sm text-muted-foreground">許可</div>
              </div>
            </div>
            {dictionaryStats.topUsed.length > 0 ? (
              <div>
                <p className="text-sm text-muted-foreground mb-2">上位フレーズ（{new Date(dictionaryStats.since).toLocaleDateString('ja-JP')} 以降）</p>
                <ul className="list-disc pl-6 space-y-1">
                  {dictionaryStats.topUsed.slice(0, 5).map((t) => (
                    <li key={t.dictionary_id} className="text-sm">{t.phrase} — {t.count}回</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">最近30日の使用データはありません</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 検索・フィルター */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1">
              <Label htmlFor="search">検索</Label>
              <div className="flex gap-2">
                <Input
                  id="search"
                  placeholder="フレーズや備考で検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="dictionary-search"
                />
                <Button variant="outline" data-testid="search-button">
                  検索
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                引用句: &quot;高濃度&quot; / 除外: -臨床 / フィールド指定: phrase:薬機 notes:注意 / OR: 効果|効能
              </p>
            </div>
            <div className="w-full md:w-48">
              <Label htmlFor="category">カテゴリ</Label>
              <select
                id="category"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as 'ALL' | 'NG' | 'ALLOW')}
                data-testid="category-filter"
              >
                <option value="ALL">すべて</option>
                <option value="NG">NG</option>
                <option value="ALLOW">許可</option>
              </select>
            </div>
            <div className="w-full md:w-64">
              <Label htmlFor="sort">ソート</Label>
              <select
                id="sort"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as typeof sortOption)}
                data-testid="sort-option"
              >
                <option value="created_desc">作成日: 新しい順</option>
                <option value="created_asc">作成日: 古い順</option>
                <option value="updated_desc">更新日: 新しい順</option>
                <option value="updated_asc">更新日: 古い順</option>
                <option value="phrase_asc">フレーズ: A→Z</option>
                <option value="phrase_desc">フレーズ: Z→A</option>
                <option value="category_asc">カテゴリ: NG→許可</option>
                <option value="category_desc">カテゴリ: 許可→NG</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 新規作成・編集フォーム */}
      {(showAddForm || editingDictionary) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingDictionary ? '辞書項目編集' : '新規辞書項目作成'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={editingDictionary ? handleUpdate : handleCreate} className="space-y-4">
              <div>
                <Label htmlFor="phrase">フレーズ *</Label>
                <Input
                  id="phrase"
                  value={formData.phrase}
                  onChange={(e) => setFormData({ ...formData, phrase: e.target.value })}
                  required
                  placeholder="チェック対象のフレーズを入力"
                />
              </div>
              <div>
                <Label htmlFor="category">カテゴリ *</Label>
                <select
                  id="category"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as 'NG' | 'ALLOW' })}
                >
                  <option value="NG">NG（使用禁止）</option>
                  <option value="ALLOW">許可（使用可能）</option>
                </select>
              </div>
              <div>
                <Label htmlFor="notes">備考</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="備考や使用例など（任意）"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">
                  {editingDictionary ? '更新' : '作成'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (editingDictionary) {
                      cancelEdit()
                    } else {
                      setShowAddForm(false)
                      setFormData({ phrase: '', category: 'NG', notes: '' })
                    }
                  }}
                >
                  キャンセル
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 辞書一覧 */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">すべて ({filteredDictionaries.length})</TabsTrigger>
          <TabsTrigger value="ng">NG ({ngDictionaries.length})</TabsTrigger>
          <TabsTrigger value="allow">許可 ({allowDictionaries.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <DictionaryList
            dictionaries={filteredDictionaries}
            selectedIds={selectedIds}
            onToggleSelect={(id) => setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })}
            onEdit={startEdit}
            onDelete={handleDeleteRequest}
          />
        </TabsContent>

        <TabsContent value="ng">
          <DictionaryList
            dictionaries={ngDictionaries}
            selectedIds={selectedIds}
            onToggleSelect={(id) => setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })}
            onEdit={startEdit}
            onDelete={handleDeleteRequest}
          />
        </TabsContent>

        <TabsContent value="allow">
          <DictionaryList
            dictionaries={allowDictionaries}
            selectedIds={selectedIds}
            onToggleSelect={(id) => setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })}
            onEdit={startEdit}
            onDelete={handleDeleteRequest}
          />
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4" data-testid="confirm-delete">
            <h3 className="text-lg font-semibold mb-4">辞書項目を削除</h3>
            <p className="text-gray-600 mb-6">
              この辞書項目を削除しますか？この操作は取り消せません。
            </p>
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteDialog(null)}
              >
                キャンセル
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDelete}
                data-testid="confirm-button"
              >
                削除
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate Embeddings Confirmation Dialog */}
      {showRegenerateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4" data-testid="confirm-regenerate">
            <h3 className="text-lg font-semibold mb-4">埋め込みを再生成</h3>
            <p className="text-gray-600 mb-6">
              すべての辞書項目のEmbeddingを再生成しますか？この処理には時間がかかる場合があります。
            </p>
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowRegenerateDialog(false)}
              >
                キャンセル
              </Button>
              <Button 
                onClick={handleRefreshAllEmbeddings}
                data-testid="confirm-button"
              >
                再生成
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicates Dialog */}
      {showDuplicatesDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">重複検出</h3>
            <div className="max-h-80 overflow-auto border rounded">
              {duplicates === null ? (
                <div className="p-4 text-sm text-muted-foreground">読み込み中...</div>
              ) : duplicates.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">重複は見つかりませんでした</div>
              ) : (
                <ul className="divide-y">
                  {duplicates.map((d) => (
                    <li key={d.phrase} className="p-3">
                      <div className="font-medium">{d.phrase}</div>
                      <div className="text-xs text-muted-foreground">{d.items.length} 件</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setShowDuplicatesDialog(false)}>閉じる</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface DictionaryListProps {
  dictionaries: Dictionary[]
  selectedIds: Set<number>
  onToggleSelect: (id: number) => void
  onEdit: (dictionary: Dictionary) => void
  onDelete: (id: number) => void
}

function DictionaryList({ dictionaries, selectedIds, onToggleSelect, onEdit, onDelete }: DictionaryListProps) {
  if (dictionaries.length === 0) {
    return (
      <div className="space-y-2" data-testid="dictionary-list">
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            辞書項目がありません
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-2" data-testid="dictionary-list">
      {dictionaries.map((dictionary) => (
        <Card key={dictionary.id} data-testid="dictionary-item">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start gap-3">
              <div className="pt-1">
                <input
                  type="checkbox"
                  aria-label="select"
                  checked={selectedIds.has(dictionary.id)}
                  onChange={() => onToggleSelect(dictionary.id)}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium" data-testid="phrase-text">{dictionary.phrase}</span>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      dictionary.category === 'NG'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                    data-testid="phrase-category"
                  >
                    {dictionary.category}
                  </span>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      dictionary.vector
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {dictionary.vector ? 'Embedding済み' : 'Embedding未済'}
                  </span>
                </div>
                {dictionary.notes && (
                  <p className="text-sm text-muted-foreground mb-2">{dictionary.notes}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  作成日: {new Date(dictionary.created_at!).toLocaleDateString('ja-JP')}
                </p>
              </div>
              <div className="flex gap-2" data-testid="phrase-actions">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(dictionary)}
                  data-testid="edit-button"
                >
                  編集
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(dictionary.id)}
                  data-testid="delete-button"
                >
                  削除
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
