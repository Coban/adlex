'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database.types'

type Dictionary = Database['public']['Tables']['dictionaries']['Row']

interface EmbeddingStats {
  organizationId: number;
  totalItems: number;
  itemsWithEmbedding: number;
  itemsWithoutEmbedding: number;
  embeddingCoverageRate: number;
}

export default function DictionariesPage() {
  const { organization, user } = useAuth()
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([])
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

  const loadDictionaries = useCallback(async () => {
    if (!organization) return
    
    try {
      const { data, error } = await supabase
        .from('dictionaries')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDictionaries(data || [])
    } catch (error) {
      console.error('辞書の読み込みに失敗しました:', error)
    } finally {
      setLoading(false)
    }
  }, [organization])

  const loadEmbeddingStats = useCallback(async () => {
    if (!organization || !user || user.role !== 'admin') return
    
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
  }, [organization, user])

  useEffect(() => {
    if (organization) {
      loadDictionaries()
      loadEmbeddingStats()
    }
  }, [organization, loadDictionaries, loadEmbeddingStats])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization) return

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
        throw new Error(result.error || '辞書項目の作成に失敗しました')
      }

      if (result.warning) {
        alert(result.warning)
      }

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
        throw new Error(result.error || '辞書項目の更新に失敗しました')
      }

      if (result.warning) {
        alert(result.warning)
      }

      setEditingDictionary(null)
      setFormData({ phrase: '', category: 'NG', notes: '' })
      loadDictionaries()
      loadEmbeddingStats()
    } catch (error) {
      console.error('辞書項目の更新に失敗しました:', error)
      alert(error instanceof Error ? error.message : '辞書項目の更新に失敗しました')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('この辞書項目を削除しますか？')) return

    try {
      const { error } = await supabase
        .from('dictionaries')
        .delete()
        .eq('id', id)

      if (error) throw error
      loadDictionaries()
      loadEmbeddingStats()
    } catch (error) {
      console.error('辞書項目の削除に失敗しました:', error)
    }
  }

  const handleRefreshAllEmbeddings = async () => {
    if (!confirm('すべての辞書項目のEmbeddingを再生成しますか？この処理には時間がかかる場合があります。')) return

    setEmbeddingRefreshLoading(true)
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
        throw new Error(result.error || 'Embedding再生成に失敗しました')
      }

      alert(result.message)
      if (result.failures && result.failures.length > 0) {
        console.warn('Embedding生成に失敗した項目:', result.failures)
      }

      loadDictionaries()
      loadEmbeddingStats()
    } catch (error) {
      console.error('Embedding再生成に失敗しました:', error)
      alert(error instanceof Error ? error.message : 'Embedding再生成に失敗しました')
    } finally {
      setEmbeddingRefreshLoading(false)
    }
  }

  const startEdit = (dictionary: Dictionary) => {
    setEditingDictionary(dictionary)
    setFormData({
      phrase: dictionary.phrase,
      category: dictionary.category,
      notes: dictionary.notes || ''
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

  const isAdmin = user?.role === 'admin'

  if (loading) {
    return <div className="p-6">読み込み中...</div>
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
              onClick={handleRefreshAllEmbeddings} 
              disabled={embeddingRefreshLoading}
              variant="outline"
            >
              {embeddingRefreshLoading ? 'Embedding再生成中...' : 'Embedding再生成'}
            </Button>
          )}
          <Button onClick={() => setShowAddForm(true)} disabled={showAddForm}>
            新規作成
          </Button>
        </div>
      </div>

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
              <Input
                id="search"
                placeholder="フレーズや備考で検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-48">
              <Label htmlFor="category">カテゴリ</Label>
              <select
                id="category"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as 'ALL' | 'NG' | 'ALLOW')}
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
            onDelete={handleDelete}
          />
        </TabsContent>

        <TabsContent value="ng">
          <DictionaryList
            dictionaries={ngDictionaries}
            onEdit={startEdit}
            onDelete={handleDelete}
          />
        </TabsContent>

        <TabsContent value="allow">
          <DictionaryList
            dictionaries={allowDictionaries}
            onEdit={startEdit}
            onDelete={handleDelete}
          />
        </TabsContent>
      </Tabs>
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
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          辞書項目がありません
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {dictionaries.map((dictionary) => (
        <Card key={dictionary.id}>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">{dictionary.phrase}</span>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      dictionary.category === 'NG'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}
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
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(dictionary)}
                >
                  編集
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(dictionary.id)}
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
