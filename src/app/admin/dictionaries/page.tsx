'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'

// モジュール化されたフック群
import { ActionButtons } from './components/ActionButtons'
import {
  DeleteConfirmationDialog,
  RegenerateEmbeddingsDialog,
  DuplicatesDialog,
} from './components/ConfirmationDialogs'
import { DictionaryFilters } from './components/DictionaryFilters'
import { DictionaryForm } from './components/DictionaryForm'
import { DictionaryList } from './components/DictionaryList'
import { EmbeddingStatsCard, DictionaryStatsCard } from './components/DictionaryStats'
import { StatusMessages } from './components/StatusMessages'
import { useBulkOperations } from './hooks/useBulkOperations'
import { useDictionaries } from './hooks/useDictionaries'
import { useDictionaryDelete } from './hooks/useDictionaryDelete'
import { useDictionaryForm } from './hooks/useDictionaryForm'
import { useEmbeddingOperations } from './hooks/useEmbeddingOperations'
// ユーティリティ関数
import { CategoryFilter, SortOption } from './types'
import { matchesAdvancedQuery } from './utils/search'
import { sortDictionaries } from './utils/sorting'

export default function DictionariesPage() {
  const { userProfile, loading: authLoading } = useAuth()

  // データ管理フック
  const {
    dictionaries,
    fallbackOrganization,
    loading,
    embeddingStats,
    embeddingRefreshLoading,
    setEmbeddingRefreshLoading,
    dictionaryStats,
    refreshData,
  } = useDictionaries()

  // フォーム管理フック
  const dictionaryForm = useDictionaryForm(
    null, // organization - useDictionaries内で管理
    fallbackOrganization,
    refreshData
  )

  // 削除操作フック
  const dictionaryDelete = useDictionaryDelete(refreshData)

  // Embedding操作フック
  const embeddingOps = useEmbeddingOperations(refreshData, setEmbeddingRefreshLoading)

  // 一括操作フック
  const bulkOps = useBulkOperations(refreshData)

  // フィルター・ソート状態
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('ALL')
  const [sortOption, setSortOption] = useState<SortOption>('created_desc')

  // データフィルタリング・ソート
  const filteredDictionaries = sortDictionaries(
    dictionaries.filter(dict => {
      // Category filter first
      const matchesCategory = selectedCategory === 'ALL' || dict.category === selectedCategory
      if (!matchesCategory) return false

      // Advanced search on searchTerm
      if (!searchTerm.trim()) return true
      return matchesAdvancedQuery(dict, searchTerm)
    }),
    sortOption
  )

  const ngDictionaries = filteredDictionaries.filter(d => d.category === 'NG')
  const allowDictionaries = filteredDictionaries.filter(d => d.category === 'ALLOW')

  const isAdmin = userProfile?.role === 'admin'
  const effectiveOrganization = fallbackOrganization

  // ローディング状態の処理
  if (authLoading) {
    return <div className="p-6">認証中...</div>
  }
  
  if (loading) {
    return <div className="p-6">辞書読み込み中...</div>
  }

  // 組織が設定されていない場合
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
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">辞書管理</h1>
          <p className="text-muted-foreground">組織の薬機法チェック辞書を管理します</p>
        </div>
        <ActionButtons
          isAdmin={isAdmin}
          embeddingRefreshLoading={embeddingRefreshLoading}
          importing={bulkOps.importing}
          showAddForm={dictionaryForm.showAddForm}
          onDetectDuplicates={bulkOps.handleDetectDuplicates}
          onBulkCategory={bulkOps.handleBulkCategoryUpdate}
          onBulkNotes={bulkOps.handleBulkNotesUpdate}
          onExportCSV={bulkOps.handleExportCSV}
          onImportCSV={bulkOps.handleImportCSV}
          onRegenerateEmbeddings={() => embeddingOps.setShowRegenerateDialog(true)}
          onShowAddForm={() => dictionaryForm.setShowAddForm(true)}
        />
      </div>

      {/* ステータスメッセージ */}
      <StatusMessages
        message={dictionaryForm.message || dictionaryDelete.message || embeddingOps.message || bulkOps.message}
        isRegenerating={embeddingOps.isRegenerating}
      />

      {/* 統計情報 */}
      {isAdmin && embeddingStats && (
        <EmbeddingStatsCard stats={embeddingStats} />
      )}

      {isAdmin && dictionaryStats && (
        <DictionaryStatsCard stats={dictionaryStats} />
      )}

      {/* 検索・フィルター */}
      <DictionaryFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        sortOption={sortOption}
        setSortOption={setSortOption}
      />

      {/* 新規作成・編集フォーム */}
      <DictionaryForm
        editingDictionary={dictionaryForm.editingDictionary}
        showAddForm={dictionaryForm.showAddForm}
        formData={dictionaryForm.formData}
        setFormData={dictionaryForm.setFormData}
        onSubmit={dictionaryForm.editingDictionary ? dictionaryForm.handleUpdate : dictionaryForm.handleCreate}
        onCancel={() => {
          if (dictionaryForm.editingDictionary) {
            dictionaryForm.cancelEdit()
          } else {
            dictionaryForm.setShowAddForm(false)
            dictionaryForm.setFormData({ phrase: '', category: 'NG', notes: '' })
          }
        }}
      />

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
            selectedIds={bulkOps.selectedIds}
            onToggleSelect={(id) => bulkOps.setSelectedIds(prev => {
              const next = new Set(prev)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })}
            onEdit={dictionaryForm.startEdit}
            onDelete={dictionaryDelete.handleDeleteRequest}
          />
        </TabsContent>

        <TabsContent value="ng">
          <DictionaryList
            dictionaries={ngDictionaries}
            selectedIds={bulkOps.selectedIds}
            onToggleSelect={(id) => bulkOps.setSelectedIds(prev => {
              const next = new Set(prev)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })}
            onEdit={dictionaryForm.startEdit}
            onDelete={dictionaryDelete.handleDeleteRequest}
          />
        </TabsContent>

        <TabsContent value="allow">
          <DictionaryList
            dictionaries={allowDictionaries}
            selectedIds={bulkOps.selectedIds}
            onToggleSelect={(id) => bulkOps.setSelectedIds(prev => {
              const next = new Set(prev)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })}
            onEdit={dictionaryForm.startEdit}
            onDelete={dictionaryDelete.handleDeleteRequest}
          />
        </TabsContent>
      </Tabs>

      {/* 確認ダイアログ群 */}
      <DeleteConfirmationDialog
        isOpen={dictionaryDelete.showDeleteDialog !== null}
        onConfirm={dictionaryDelete.handleDelete}
        onCancel={() => dictionaryDelete.setShowDeleteDialog(null)}
      />

      <RegenerateEmbeddingsDialog
        isOpen={embeddingOps.showRegenerateDialog}
        onConfirm={embeddingOps.handleRefreshAllEmbeddings}
        onCancel={() => embeddingOps.setShowRegenerateDialog(false)}
      />

      <DuplicatesDialog
        isOpen={bulkOps.showDuplicatesDialog}
        duplicates={bulkOps.duplicates}
        onClose={() => bulkOps.setShowDuplicatesDialog(false)}
      />
    </div>
  )
}