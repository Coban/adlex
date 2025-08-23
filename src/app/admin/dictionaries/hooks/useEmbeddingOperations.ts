import { useState } from 'react'
import { authFetch } from '@/lib/api-client'
import { ErrorFactory } from '@/lib/errors'

/**
 * Embedding操作（再生成など）用のカスタムフック
 */
export function useEmbeddingOperations(
  onSuccess: () => void,
  setEmbeddingRefreshLoading: (loading: boolean) => void
) {
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regenerateJobId, setRegenerateJobId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const showMessage = (text: string, duration = 3000) => {
    setMessage(text)
    setTimeout(() => setMessage(''), duration)
  }

  const pollEmbeddingJob = async (jobId: string) => {
    let finished = false
    try {
      while (!finished) {
        const res = await authFetch(`/api/dictionaries/embeddings/refresh?jobId=${encodeURIComponent(jobId)}`, {
          method: 'GET'
        })
        const status = await res.json()
        if (!res.ok) throw ErrorFactory.createApiError(res.status, status.error ?? 'ジョブの取得に失敗しました')
        if (status.status === 'completed') {
          showMessage(`埋め込みの再生成が完了しました（成功: ${status.success}, 失敗: ${status.failure}）`, 5000)
          finished = true
          setRegenerateJobId(null)
          onSuccess()
        } else if (status.status === 'failed') {
          showMessage('Embedding再生成ジョブが失敗しました', 5000)
          finished = true
          setRegenerateJobId(null)
        } else {
          // queued / processing
          showMessage(`埋め込みを再生成中... (${status.processed}/${status.total})`)
          await new Promise(r => setTimeout(r, 1500))
        }
      }
    } catch (e) {
      console.error('ジョブポーリングに失敗:', e)
      setRegenerateJobId(null)
    }
  }

  const handleRefreshAllEmbeddings = async () => {
    setShowRegenerateDialog(false)
    setIsRegenerating(true)
    setEmbeddingRefreshLoading(true)
    showMessage('埋め込みを再生成中...')
    
    try {
      const response = await authFetch('/api/dictionaries/embeddings/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      })

      const result = await response.json()

      if (!response.ok) {
        throw ErrorFactory.createApiError(500, result.error ?? 'Embedding再生成に失敗しました')
      }

      if (result.jobId) {
        setRegenerateJobId(result.jobId)
        pollEmbeddingJob(result.jobId)
      } else {
        // 後方互換: 同期レスポンスの場合
        showMessage('埋め込みの再生成が完了しました', 5000)
        onSuccess()
      }
    } catch (error) {
      console.error('Embedding再生成に失敗しました:', error)
      showMessage('Embedding再生成に失敗しました')
    } finally {
      setEmbeddingRefreshLoading(false)
      setIsRegenerating(false)
    }
  }

  return {
    showRegenerateDialog,
    setShowRegenerateDialog,
    isRegenerating,
    regenerateJobId,
    message,
    handleRefreshAllEmbeddings,
  }
}