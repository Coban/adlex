import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCheckDetail } from '@/components/CheckHistoryDetail/hooks/useCheckDetail'

// fetch のモック
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useCheckDetail', () => {
  const mockCheckData = {
    check: {
      id: 123,
      originalText: 'テストテキスト',
      modifiedText: '修正されたテキスト',
      inputType: 'text',
      extractedText: null,
      imageUrl: null,
      status: 'completed',
      createdAt: '2024-01-01T00:00:00Z',
      violations: []
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('正常なデータ取得', () => {
    it('チェック詳細を正常に取得できること', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCheckData)
      })

      const { result } = renderHook(() => useCheckDetail(123))

      expect(result.current.loading).toBe(true)
      expect(result.current.check).toBe(null)
      expect(result.current.error).toBe(null)

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.check).toEqual(mockCheckData.check)
      expect(result.current.error).toBe(null)
      expect(mockFetch).toHaveBeenCalledWith('/api/checks/123')
    })

    it('checkIdが変更された場合に再取得されること', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCheckData)
      })

      const { result, rerender } = renderHook(
        ({ checkId }) => useCheckDetail(checkId),
        { initialProps: { checkId: 123 } }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/checks/123')

      // checkId を変更
      rerender({ checkId: 456 })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/checks/456')
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('エラーハンドリング', () => {
    it('404エラーの場合適切なエラーメッセージが設定されること', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        clone: vi.fn().mockReturnThis(),
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('')
      })

      const { result } = renderHook(() => useCheckDetail(123))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.check).toBe(null)
      expect(result.current.error).toContain('指定されたリソースが見つかりません')
    })

    it('403エラーの場合適切なエラーメッセージが設定されること', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        clone: vi.fn().mockReturnThis(),
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('')
      })

      const { result } = renderHook(() => useCheckDetail(123))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toContain('この操作を実行する権限がありません')
    })

    it('その他のAPIエラーの場合適切なエラーメッセージが設定されること', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        clone: vi.fn().mockReturnThis(),
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('')
      })

      const { result } = renderHook(() => useCheckDetail(123))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toContain('チェック履歴の取得に失敗しました')
    })

    it('ネットワークエラーの場合適切なエラーメッセージが設定されること', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'))

      const { result } = renderHook(() => useCheckDetail(123))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.check).toBe(null)
      expect(result.current.error).toBe('Network connection failed')
    })

    it('予期しないエラーの場合汎用エラーメッセージが設定されること', async () => {
      mockFetch.mockRejectedValueOnce('Unknown error type')

      const { result } = renderHook(() => useCheckDetail(123))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('予期しないエラーが発生しました')
    })
  })

  describe('ローディング状態', () => {
    it('データ取得中はloadingがtrueになること', () => {
      // レスポンスを遅延させる
      let resolveResponse: (value: any) => void
      const responsePromise = new Promise((resolve) => {
        resolveResponse = resolve
      })
      
      mockFetch.mockReturnValue(responsePromise)

      const { result } = renderHook(() => useCheckDetail(123))

      expect(result.current.loading).toBe(true)
      expect(result.current.check).toBe(null)
      expect(result.current.error).toBe(null)

      // 解決しても、まだ待つ
      resolveResponse!({
        ok: true,
        json: () => Promise.resolve(mockCheckData)
      })
    })
  })
})