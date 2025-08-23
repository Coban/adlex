import { useState, useEffect } from 'react'
import { CheckDetail } from '../types'
import { ErrorFactory } from '@/lib/errors'

/**
 * チェック詳細データ取得用のカスタムフック
 */
export function useCheckDetail(checkId: number) {
  const [check, setCheck] = useState<CheckDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCheckDetail = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/checks/${checkId}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            throw ErrorFactory.createNotFoundError('チェック履歴', checkId)
          }
          if (response.status === 403) {
            throw ErrorFactory.createAuthorizationError('このチェック履歴にアクセスする権限がありません')
          }
          throw ErrorFactory.createApiError(response.status, 'チェック履歴の取得に失敗しました')
        }

        const data = await response.json()
        setCheck(data.check)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : '予期しないエラーが発生しました')
      } finally {
        setLoading(false)
      }
    }

    fetchCheckDetail()
  }, [checkId])

  return {
    check,
    loading,
    error,
  }
}