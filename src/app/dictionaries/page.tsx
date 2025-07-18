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
  const [editingDictionary, setEditingDictionary] = useState<Dictionary | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    phrase: '',
    category: 'NG' as 'NG' | 'ALLOW',
    notes: ''
  })
  const [message, setMessage] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState<number | null>(null)

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
              console.log('Loaded dictionaries via fallback:', data.length, 'items')
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
      console.log('Loading dictionaries for organization:', organization.id)
      const { data, error } = await supabase
        .from('dictionaries')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Dictionary loading error:', error)
        throw error
      }
      
      console.log('Loaded dictionaries:', data?.length || 0, 'items')
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

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(false)
    }, 5000)

    if (!authLoading) {
      const currentOrg = organization ?? fallbackOrganization
      if (currentOrg) {
        loadDictionaries()
        loadEmbeddingStats()
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
  }, [organization, fallbackOrganization, authLoading, loadDictionaries, loadEmbeddingStats])

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

      setMessage('埋め込みの再生成が完了しました')
      setTimeout(() => setMessage(''), 5000)
      
      if (result.failures && result.failures.length > 0) {
        console.warn('Embedding生成に失敗した項目:', result.failures)
      }

      loadDictionaries()
      loadEmbeddingStats()
    } catch (error) {
      console.error('Embedding再生成に失敗しました:', error)
      setMessage('Embedding再生成に失敗しました')
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setEmbeddingRefreshLoading(false)
      setIsRegenerating(false)
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

  const filteredDictionaries = dictionaries.filter(dict => {
    const matchesSearch = dict.phrase.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (dict.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
    const matchesCategory = selectedCategory === 'ALL' || dict.category === selectedCategory
    return matchesSearch && matchesCategory
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

      {/* 検索・フィルター */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
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
            </div>
            <div className="w-48">
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
            onEdit={startEdit}
            onDelete={handleDeleteRequest}
          />
        </TabsContent>

        <TabsContent value="ng">
          <DictionaryList
            dictionaries={ngDictionaries}
            onEdit={startEdit}
            onDelete={handleDeleteRequest}
          />
        </TabsContent>

        <TabsContent value="allow">
          <DictionaryList
            dictionaries={allowDictionaries}
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
    </div>
  )
}

interface DictionaryListProps {
  dictionaries: Dictionary[]
  onEdit: (dictionary: Dictionary) => void
  onDelete: (id: number) => void
}

function DictionaryList({ dictionaries, onEdit, onDelete }: DictionaryListProps) {
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
            <div className="flex justify-between items-start">
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
