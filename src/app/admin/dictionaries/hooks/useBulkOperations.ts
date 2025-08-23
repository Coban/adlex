import { useState } from 'react'
import { authFetch } from '@/lib/api-client'
import { DuplicateGroup } from '../types'
import { ErrorFactory } from '@/lib/errors'

/**
 * 一括操作（重複検出、一括編集など）用のカスタムフック
 */
export function useBulkOperations(
  onSuccess: () => void
) {
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateGroup[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')

  const showMessage = (text: string, duration = 3000) => {
    setMessage(text)
    setTimeout(() => setMessage(''), duration)
  }

  const handleDetectDuplicates = async () => {
    setShowDuplicatesDialog(true)
    try {
      const res = await authFetch('/api/dictionaries/duplicates', { method: 'GET' })
      const json = await res.json()
      if (!res.ok) throw ErrorFactory.createApiError(res.status, json.error ?? '重複検出に失敗しました')
      setDuplicates(json.duplicates ?? [])
    } catch (e) {
      console.error('重複検出失敗', e)
      setDuplicates([])
    }
  }

  const handleBulkCategoryUpdate = async () => {
    if (selectedIds.size === 0) return alert('項目を選択してください')
    const category = window.prompt('一括カテゴリ変更: NG または ALLOW を入力', 'NG')
    if (!category) return
    const upper = category.toUpperCase()
    if (upper !== 'NG' && upper !== 'ALLOW') return alert('NG/ALLOW のいずれかを指定してください')
    
    try {
      const updates = Array.from(selectedIds).map(id => ({ 
        id, 
        patch: { category: upper as 'NG' | 'ALLOW' } 
      }))
      const res = await authFetch('/api/dictionaries/bulk-update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      })
      const json = await res.json()
      if (!res.ok) throw ErrorFactory.createApiError(res.status, json.error ?? '一括更新に失敗しました')
      showMessage(`一括更新完了: 成功 ${json.success ?? 0} 件 / 失敗 ${json.failure ?? 0} 件`, 4000)
      setSelectedIds(new Set())
      onSuccess()
    } catch (e) {
      alert(e instanceof Error ? e.message : '一括更新に失敗しました')
    }
  }

  const handleBulkNotesUpdate = async () => {
    if (selectedIds.size === 0) return alert('項目を選択してください')
    const notes = window.prompt('一括で備考を設定します。空でクリア。', '')
    if (notes === null) return
    
    try {
      const value = notes.trim()
      const patch = value === '' ? { notes: null } : { notes: value }
      const updates = Array.from(selectedIds).map(id => ({ id, patch }))
      const res = await authFetch('/api/dictionaries/bulk-update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      })
      const json = await res.json()
      if (!res.ok) throw ErrorFactory.createApiError(res.status, json.error ?? '一括更新に失敗しました')
      showMessage(`一括更新完了: 成功 ${json.success ?? 0} 件 / 失敗 ${json.failure ?? 0} 件`, 4000)
      setSelectedIds(new Set())
      onSuccess()
    } catch (e) {
      alert(e instanceof Error ? e.message : '一括更新に失敗しました')
    }
  }

  const handleExportCSV = async () => {
    try {
      const res = await authFetch('/api/dictionaries/export', { method: 'GET' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw ErrorFactory.createApiError(res.status, j.error ?? 'エクスポートに失敗しました')
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
  }

  const handleImportCSV = async (file: File) => {
    setImporting(true)
    try {
      const text = await file.text()
      const res = await authFetch('/api/dictionaries/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
        },
        body: text,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw ErrorFactory.createApiError(res.status, json.error ?? 'インポートに失敗しました')
      }
      showMessage(`インポート完了: 追加 ${json.inserted ?? 0} 件, スキップ ${json.skipped?.length ?? 0} 件`, 5000)
      onSuccess()
    } catch (e) {
      console.error('CSVインポート失敗', e)
      alert(e instanceof Error ? e.message : 'CSVインポートに失敗しました')
    } finally {
      setImporting(false)
    }
  }

  return {
    message,
    showDuplicatesDialog,
    setShowDuplicatesDialog,
    duplicates,
    selectedIds,
    setSelectedIds,
    importing,
    handleDetectDuplicates,
    handleBulkCategoryUpdate,
    handleBulkNotesUpdate,
    handleExportCSV,
    handleImportCSV,
  }
}