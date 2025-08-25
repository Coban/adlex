import { useState } from 'react'

import { authFetch } from '@/lib/api-client'
import { ErrorFactory } from '@/lib/errors'

import { Dictionary, DictionaryFormData, Organization } from '../types'

/**
 * 辞書項目フォーム管理用のカスタムフック
 */
export function useDictionaryForm(
  organization: Organization | null,
  fallbackOrganization: Organization | null,
  onSuccess: () => void
) {
  const [editingDictionary, setEditingDictionary] = useState<Dictionary | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState<DictionaryFormData>({
    phrase: '',
    category: 'NG',
    notes: ''
  })
  const [message, setMessage] = useState('')

  const showMessage = (text: string, duration = 3000) => {
    setMessage(text)
    setTimeout(() => setMessage(''), duration)
  }

  const resetForm = () => {
    setFormData({ phrase: '', category: 'NG', notes: '' })
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
    resetForm()
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const currentOrg = organization ?? fallbackOrganization
    if (!currentOrg) return

    try {
      const response = await authFetch('/api/dictionaries', {
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
        throw ErrorFactory.createApiError(500, result.error ?? '辞書項目の作成に失敗しました')
      }

      if (result.warning) {
        alert(result.warning)
      }

      showMessage('辞書に追加しました')
      resetForm()
      setShowAddForm(false)
      onSuccess()
    } catch (error) {
      console.error('辞書項目の作成に失敗しました:', error)
      alert(error instanceof Error ? error.message : '辞書項目の作成に失敗しました')
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDictionary) return

    try {
      const response = await authFetch(`/api/dictionaries/${editingDictionary.id}`, {
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
        throw ErrorFactory.createApiError(500, result.error ?? '辞書項目の更新に失敗しました')
      }

      if (result.warning) {
        alert(result.warning)
      }

      showMessage('辞書を更新しました')
      setEditingDictionary(null)
      resetForm()
      onSuccess()
    } catch (error) {
      console.error('辞書項目の更新に失敗しました:', error)
      alert(error instanceof Error ? error.message : '辞書項目の更新に失敗しました')
    }
  }

  return {
    editingDictionary,
    showAddForm,
    setShowAddForm,
    formData,
    setFormData,
    message,
    startEdit,
    cancelEdit,
    handleCreate,
    handleUpdate,
  }
}