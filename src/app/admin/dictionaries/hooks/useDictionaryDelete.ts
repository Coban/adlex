import { useState } from 'react'

import { createClient } from '@/infra/supabase/clientClient'

/**
 * 辞書項目削除用のカスタムフック
 */
export function useDictionaryDelete(
  onSuccess: () => void
) {
  const [showDeleteDialog, setShowDeleteDialog] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  const showMessage = (text: string, duration = 3000) => {
    setMessage(text)
    setTimeout(() => setMessage(''), duration)
  }

  const handleDeleteRequest = (id: number) => {
    setShowDeleteDialog(id)
  }

  const handleDelete = async () => {
    if (!showDeleteDialog) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('dictionaries')
        .delete()
        .eq('id', showDeleteDialog)

      if (error) throw error
      
      showMessage('辞書から削除しました')
      setShowDeleteDialog(null)
      onSuccess()
    } catch (error) {
      console.error('辞書項目の削除に失敗しました:', error)
    }
  }

  return {
    showDeleteDialog,
    setShowDeleteDialog,
    message,
    handleDeleteRequest,
    handleDelete,
  }
}