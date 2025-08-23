import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useBulkOperations } from '@/app/admin/dictionaries/hooks/useBulkOperations'

// authFetch のモック
vi.mock('@/lib/api-client', () => ({
  authFetch: vi.fn()
}))

// DOM API のモック
const mockAlert = vi.fn()
const mockPrompt = vi.fn()
const mockCreateElement = vi.fn()
const mockCreateObjectURL = vi.fn()
const mockRevokeObjectURL = vi.fn()

Object.assign(window, {
  alert: mockAlert,
  prompt: mockPrompt
})

Object.assign(document, {
  createElement: mockCreateElement
})

Object.assign(URL, {
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL
})

describe('useBulkOperations', () => {
  // モック関数の参照を取得
  const { authFetch } = vi.hoisted(() => ({
    authFetch: vi.fn()
  }))

  const mockOnSuccess = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    
    // デフォルトのDOM要素モック
    const mockElement = {
      href: '',
      download: '',
      click: vi.fn(),
      remove: vi.fn()
    }
    mockCreateElement.mockReturnValue(mockElement)
    mockCreateObjectURL.mockReturnValue('blob:mock-url')
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('初期状態', () => {
    it('初期値が正しく設定されていること', () => {
      const { result } = renderHook(() => useBulkOperations(mockOnSuccess))

      expect(result.current.showDuplicatesDialog).toBe(false)
      expect(result.current.duplicates).toBe(null)
      expect(result.current.selectedIds.size).toBe(0)
      expect(result.current.importing).toBe(false)
      expect(result.current.message).toBe('')
    })
  })

  describe('handleDetectDuplicates', () => {
    it('重複検出が成功した場合', async () => {
      const mockDuplicates = [
        { phrase: 'テスト', count: 2, entries: [] }
      ]
      
      authFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ duplicates: mockDuplicates })
      })

      const { result } = renderHook(() => useBulkOperations(mockOnSuccess))

      await act(async () => {
        await result.current.handleDetectDuplicates()
      })

      expect(result.current.showDuplicatesDialog).toBe(true)
      expect(result.current.duplicates).toEqual(mockDuplicates)
      expect(authFetch).toHaveBeenCalledWith('/api/dictionaries/duplicates', { method: 'GET' })
    })

    it('重複検出でAPIエラーが発生した場合', async () => {
      authFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' })
      })

      const { result } = renderHook(() => useBulkOperations(mockOnSuccess))

      await act(async () => {
        await result.current.handleDetectDuplicates()
      })

      expect(result.current.showDuplicatesDialog).toBe(true)
      expect(result.current.duplicates).toEqual([])
    })
  })

  describe('handleBulkCategoryUpdate', () => {
    it('項目が選択されていない場合アラートが表示されること', async () => {
      const { result } = renderHook(() => useBulkOperations(mockOnSuccess))

      await act(async () => {
        await result.current.handleBulkCategoryUpdate()
      })

      expect(mockAlert).toHaveBeenCalledWith('項目を選択してください')
      expect(authFetch).not.toHaveBeenCalled()
    })

    it('有効なカテゴリで一括更新が成功すること', async () => {
      mockPrompt.mockReturnValue('NG')
      authFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: 2, failure: 0 })
      })

      const { result } = renderHook(() => useBulkOperations(mockOnSuccess))

      // 選択項目を設定
      act(() => {
        result.current.setSelectedIds(new Set([1, 2]))
      })

      await act(async () => {
        await result.current.handleBulkCategoryUpdate()
      })

      expect(mockPrompt).toHaveBeenCalledWith('一括カテゴリ変更: NG または ALLOW を入力', 'NG')
      expect(authFetch).toHaveBeenCalledWith('/api/dictionaries/bulk-update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [
            { id: 1, patch: { category: 'NG' } },
            { id: 2, patch: { category: 'NG' } }
          ]
        })
      })
      expect(result.current.selectedIds.size).toBe(0)
      expect(mockOnSuccess).toHaveBeenCalled()
    })

    it('無効なカテゴリが入力された場合アラートが表示されること', async () => {
      mockPrompt.mockReturnValue('INVALID')

      const { result } = renderHook(() => useBulkOperations(mockOnSuccess))

      act(() => {
        result.current.setSelectedIds(new Set([1]))
      })

      await act(async () => {
        await result.current.handleBulkCategoryUpdate()
      })

      expect(mockAlert).toHaveBeenCalledWith('NG/ALLOW のいずれかを指定してください')
      expect(authFetch).not.toHaveBeenCalled()
    })

    it('プロンプトがキャンセルされた場合何も実行されないこと', async () => {
      mockPrompt.mockReturnValue(null)

      const { result } = renderHook(() => useBulkOperations(mockOnSuccess))

      act(() => {
        result.current.setSelectedIds(new Set([1]))
      })

      await act(async () => {
        await result.current.handleBulkCategoryUpdate()
      })

      expect(authFetch).not.toHaveBeenCalled()
    })
  })

  describe('handleBulkNotesUpdate', () => {
    it('備考の一括更新が成功すること', async () => {
      mockPrompt.mockReturnValue('テスト備考')
      authFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: 1, failure: 0 })
      })

      const { result } = renderHook(() => useBulkOperations(mockOnSuccess))

      act(() => {
        result.current.setSelectedIds(new Set([1]))
      })

      await act(async () => {
        await result.current.handleBulkNotesUpdate()
      })

      expect(authFetch).toHaveBeenCalledWith('/api/dictionaries/bulk-update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [{ id: 1, patch: { notes: 'テスト備考' } }]
        })
      })
    })

    it('空の備考でnullクリアできること', async () => {
      mockPrompt.mockReturnValue('  ')
      authFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: 1, failure: 0 })
      })

      const { result } = renderHook(() => useBulkOperations(mockOnSuccess))

      act(() => {
        result.current.setSelectedIds(new Set([1]))
      })

      await act(async () => {
        await result.current.handleBulkNotesUpdate()
      })

      expect(authFetch).toHaveBeenCalledWith('/api/dictionaries/bulk-update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [{ id: 1, patch: { notes: null } }]
        })
      })
    })
  })

  describe('handleExportCSV', () => {
    it('CSVエクスポートが成功すること', async () => {
      const mockBlob = new Blob(['csv,data'], { type: 'text/csv' })
      authFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob)
      })

      const mockElement = {
        href: '',
        download: '',
        click: vi.fn(),
        remove: vi.fn()
      }
      mockCreateElement.mockReturnValue(mockElement)
      document.body.appendChild = vi.fn()

      const { result } = renderHook(() => useBulkOperations(mockOnSuccess))

      await act(async () => {
        await result.current.handleExportCSV()
      })

      expect(authFetch).toHaveBeenCalledWith('/api/dictionaries/export', { method: 'GET' })
      expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob)
      expect(mockElement.download).toBe('dictionaries.csv')
      expect(mockElement.click).toHaveBeenCalled()
      expect(mockRevokeObjectURL).toHaveBeenCalled()
    })

    it('エクスポートでエラーが発生した場合アラートが表示されること', async () => {
      authFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Export failed' })
      })

      const { result } = renderHook(() => useBulkOperations(mockOnSuccess))

      await act(async () => {
        await result.current.handleExportCSV()
      })

      expect(mockAlert).toHaveBeenCalled()
    })
  })

  describe('handleImportCSV', () => {
    it('CSVインポートが成功すること', async () => {
      const mockFile = new File(['test,csv,data'], 'test.csv', { type: 'text/csv' })
      mockFile.text = vi.fn().mockResolvedValue('test,csv,data')

      authFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ inserted: 3, skipped: [] })
      })

      const { result } = renderHook(() => useBulkOperations(mockOnSuccess))

      await act(async () => {
        await result.current.handleImportCSV(mockFile)
      })

      expect(result.current.importing).toBe(false)
      expect(authFetch).toHaveBeenCalledWith('/api/dictionaries/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
        },
        body: 'test,csv,data'
      })
      expect(mockOnSuccess).toHaveBeenCalled()
    })

    it('インポート中はimportingフラグがtrueになること', async () => {
      const mockFile = new File(['test,csv,data'], 'test.csv', { type: 'text/csv' })
      mockFile.text = vi.fn().mockResolvedValue('test,csv,data')

      // レスポンスを遅延させる
      let resolveResponse: (value: any) => void
      const responsePromise = new Promise((resolve) => {
        resolveResponse = resolve
      })
      
      authFetch.mockReturnValue(responsePromise)

      const { result } = renderHook(() => useBulkOperations(mockOnSuccess))

      // インポート開始
      act(() => {
        result.current.handleImportCSV(mockFile)
      })

      // インポート中であることを確認
      expect(result.current.importing).toBe(true)

      // レスポンスを解決
      await act(async () => {
        resolveResponse!({
          ok: true,
          json: () => Promise.resolve({ inserted: 1, skipped: [] })
        })
        await responsePromise
      })

      // インポート完了後はfalseになることを確認
      expect(result.current.importing).toBe(false)
    })

    it('インポートでエラーが発生した場合適切に処理されること', async () => {
      const mockFile = new File(['invalid,csv'], 'test.csv', { type: 'text/csv' })
      mockFile.text = vi.fn().mockResolvedValue('invalid,csv')

      authFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Invalid CSV format' })
      })

      const { result } = renderHook(() => useBulkOperations(mockOnSuccess))

      await act(async () => {
        await result.current.handleImportCSV(mockFile)
      })

      expect(result.current.importing).toBe(false)
      expect(mockAlert).toHaveBeenCalled()
      expect(mockOnSuccess).not.toHaveBeenCalled()
    })
  })

  describe('selectedIds管理', () => {
    it('選択項目を追加・削除できること', () => {
      const { result } = renderHook(() => useBulkOperations(mockOnSuccess))

      act(() => {
        result.current.setSelectedIds(new Set([1, 2, 3]))
      })

      expect(result.current.selectedIds.size).toBe(3)
      expect(result.current.selectedIds.has(1)).toBe(true)
      expect(result.current.selectedIds.has(2)).toBe(true)
      expect(result.current.selectedIds.has(3)).toBe(true)
    })
  })

  describe('duplicatesDialog管理', () => {
    it('重複ダイアログの表示状態を管理できること', () => {
      const { result } = renderHook(() => useBulkOperations(mockOnSuccess))

      act(() => {
        result.current.setShowDuplicatesDialog(true)
      })

      expect(result.current.showDuplicatesDialog).toBe(true)

      act(() => {
        result.current.setShowDuplicatesDialog(false)
      })

      expect(result.current.showDuplicatesDialog).toBe(false)
    })
  })

  describe('メッセージ表示', () => {
    it('一括更新成功時にメッセージが表示されること', async () => {
      vi.useFakeTimers()
      
      mockPrompt.mockReturnValue('NG')
      authFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: 2, failure: 1 })
      })

      const { result } = renderHook(() => useBulkOperations(mockOnSuccess))

      act(() => {
        result.current.setSelectedIds(new Set([1, 2, 3]))
      })

      await act(async () => {
        await result.current.handleBulkCategoryUpdate()
      })

      expect(result.current.message).toBe('一括更新完了: 成功 2 件 / 失敗 1 件')

      // 4秒後にメッセージがクリアされることを確認
      act(() => {
        vi.advanceTimersByTime(4000)
      })

      expect(result.current.message).toBe('')
      
      vi.useRealTimers()
    })

    it('インポート成功時にメッセージが表示されること', async () => {
      vi.useFakeTimers()
      
      const mockFile = new File(['test,data'], 'test.csv', { type: 'text/csv' })
      mockFile.text = vi.fn().mockResolvedValue('test,data')

      authFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ inserted: 5, skipped: ['duplicate1'] })
      })

      const { result } = renderHook(() => useBulkOperations(mockOnSuccess))

      await act(async () => {
        await result.current.handleImportCSV(mockFile)
      })

      expect(result.current.message).toBe('インポート完了: 追加 5 件, スキップ 1 件')

      // 5秒後にメッセージがクリアされることを確認
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(result.current.message).toBe('')
      
      vi.useRealTimers()
    })
  })
})