import { toast } from '@/hooks/use-toast'
import { authFetch } from '@/lib/api-client'
import { ErrorFactory } from '@/lib/errors'

import { CheckDetail } from '../types'
import { generateDiffFormat } from '../utils/diffFormat'

/**
 * チェック詳細でのアクション操作用のカスタムフック
 */
export function useCheckActions(check: CheckDetail | null) {
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: 'コピーしました',
        description: `${label}をクリップボードにコピーしました`,
      })
    } catch {
      toast({
        title: 'コピーに失敗しました',
        description: 'クリップボードへのアクセスに失敗しました',
        variant: 'destructive'
      })
    }
  }

  const copyDiffFormat = async () => {
    if (!check) return

    const originalText = check.inputType === 'image' && check.extractedText 
      ? check.extractedText 
      : check.originalText
    
    const modifiedText = check.modifiedText ?? ''
    const diffText = generateDiffFormat(originalText, modifiedText)

    await copyToClipboard(diffText, 'diff形式')
  }

  const handleRerun = async () => {
    if (!check) return
    
    if (confirm('このチェックを再実行しますか？')) {
      try {
        const response = await authFetch('/api/checks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputType: check.inputType,
            text: check.inputType === 'image' ? check.extractedText ?? check.originalText : check.originalText,
            imageUrl: check.inputType === 'image' ? check.imageUrl : undefined
          })
        })
        if (response.ok) {
          const data = await response.json()
          window.location.href = `/history/${data.check.id}`
        }
      } catch {
        toast({ 
          title: '再実行エラー', 
          description: '再実行に失敗しました', 
          variant: 'destructive' 
        })
      }
    }
  }

  const handlePdfDownload = async () => {
    if (!check) return
    
    try {
      const res = await authFetch(`/api/checks/${check.id}/pdf`)
      if (!res.ok) {
        throw ErrorFactory.createFileProcessingError('PDF生成', 'PDF')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `check_${check.id}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast({ 
        title: 'PDF出力エラー', 
        description: e instanceof Error ? e.message : '不明なエラー', 
        variant: 'destructive' 
      })
    }
  }

  const handleDelete = async () => {
    if (!check) return
    
    if (confirm('このチェック履歴を削除しますか？この操作は取り消せません。')) {
      try {
        const response = await authFetch(`/api/checks/${check.id}`, {
          method: 'DELETE'
        })
        if (response.ok) {
          toast({ title: '削除完了', description: 'チェック履歴を削除しました' })
          window.location.href = '/history'
        } else {
          throw ErrorFactory.createApiError(response.status, '削除に失敗しました')
        }
      } catch (e) {
        toast({ 
          title: '削除エラー', 
          description: e instanceof Error ? e.message : '削除に失敗しました', 
          variant: 'destructive' 
        })
      }
    }
  }

  return {
    copyToClipboard,
    copyDiffFormat,
    handleRerun,
    handlePdfDownload,
    handleDelete,
  }
}