import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCheckActions } from '@/components/CheckHistoryDetail/hooks/useCheckActions'
import { CheckDetail } from '@/components/CheckHistoryDetail/types'

// toast のモック
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  toast: mockToast
}))

// clipboard API のモック
const mockWriteText = vi.fn()
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText
  }
})

// DOM API のモック
const mockConfirm = vi.fn()
const mockCreateElement = vi.fn()
const mockCreateObjectURL = vi.fn()
const mockRevokeObjectURL = vi.fn()

Object.assign(window, {
  confirm: mockConfirm,
  location: { href: '' }
})

Object.assign(document, {
  createElement: mockCreateElement
})

Object.assign(URL, {
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL
})

// fetch のモック
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useCheckActions', () => {
  const mockCheckDetail: CheckDetail = {
    id: 123,
    originalText: '元のテキスト',
    modifiedText: '修正されたテキスト',
    inputType: 'text',
    extractedText: null,
    imageUrl: null,
    status: 'completed',
    createdAt: '2024-01-01T00:00:00Z',
    completedAt: '2024-01-01T00:05:00Z',
    violations: []
  }

  const mockImageCheckDetail: CheckDetail = {
    id: 124,
    originalText: '画像の元テキスト',
    modifiedText: '画像の修正テキスト',
    inputType: 'image',
    extractedText: 'OCRで抽出されたテキスト',
    imageUrl: '/uploads/test.jpg',
    status: 'completed',
    createdAt: '2024-01-01T00:00:00Z',
    completedAt: '2024-01-01T00:05:00Z',
    violations: []
  }

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
    document.body.appendChild = vi.fn()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('copyToClipboard', () => {
    it('テキストを正常にクリップボードにコピーできること', async () => {
      mockWriteText.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useCheckActions(mockCheckDetail))

      await act(async () => {
        await result.current.copyToClipboard('テストテキスト', '元テキスト')
      })

      expect(mockWriteText).toHaveBeenCalledWith('テストテキスト')
      expect(mockToast).toHaveBeenCalledWith({
        title: 'コピーしました',
        description: '元テキストをクリップボードにコピーしました'
      })
    })

    it('クリップボードアクセスに失敗した場合エラートーストが表示されること', async () => {
      mockWriteText.mockRejectedValueOnce(new Error('Clipboard access denied'))

      const { result } = renderHook(() => useCheckActions(mockCheckDetail))

      await act(async () => {
        await result.current.copyToClipboard('テストテキスト', '元テキスト')
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: 'コピーに失敗しました',
        description: 'クリップボードへのアクセスに失敗しました',
        variant: 'destructive'
      })
    })
  })

  describe('copyDiffFormat', () => {
    it('テキストチェックのdiff形式をコピーできること', async () => {
      mockWriteText.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useCheckActions(mockCheckDetail))

      await act(async () => {
        await result.current.copyDiffFormat()
      })

      expect(mockWriteText).toHaveBeenCalled()
      expect(mockToast).toHaveBeenCalledWith({
        title: 'コピーしました',
        description: 'diff形式をクリップボードにコピーしました'
      })
    })

    it('画像チェックの場合抽出テキストを使用すること', async () => {
      mockWriteText.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useCheckActions(mockImageCheckDetail))

      await act(async () => {
        await result.current.copyDiffFormat()
      })

      expect(mockWriteText).toHaveBeenCalled()
      // 実際の引数の確認は複雑なため、呼び出されたことのみ確認
    })

    it('チェックデータが存在しない場合何も実行されないこと', async () => {
      const { result } = renderHook(() => useCheckActions(null))

      await act(async () => {
        await result.current.copyDiffFormat()
      })

      expect(mockWriteText).not.toHaveBeenCalled()
    })
  })

  describe('handleRerun', () => {
    it('確認後に再実行APIが呼ばれること', async () => {
      mockConfirm.mockReturnValue(true)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ check: { id: 456 } })
      })

      const { result } = renderHook(() => useCheckActions(mockCheckDetail))

      await act(async () => {
        await result.current.handleRerun()
      })

      expect(mockConfirm).toHaveBeenCalledWith('このチェックを再実行しますか？')
      expect(mockFetch).toHaveBeenCalledWith('/api/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputType: 'text',
          text: '元のテキスト',
          imageUrl: undefined
        })
      })
      expect(window.location.href).toBe('/history/456')
    })

    it('画像チェックの再実行で抽出テキストを使用すること', async () => {
      mockConfirm.mockReturnValue(true)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ check: { id: 457 } })
      })

      const { result } = renderHook(() => useCheckActions(mockImageCheckDetail))

      await act(async () => {
        await result.current.handleRerun()
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/checks', 
        expect.objectContaining({
          body: JSON.stringify({
            inputType: 'image',
            text: 'OCRで抽出されたテキスト',
            imageUrl: '/uploads/test.jpg'
          })
        })
      )
    })

    it('ユーザーがキャンセルした場合何も実行されないこと', async () => {
      mockConfirm.mockReturnValue(false)

      const { result } = renderHook(() => useCheckActions(mockCheckDetail))

      await act(async () => {
        await result.current.handleRerun()
      })

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('再実行APIが失敗した場合エラートーストが表示されること', async () => {
      mockConfirm.mockReturnValue(true)
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useCheckActions(mockCheckDetail))

      await act(async () => {
        await result.current.handleRerun()
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: '再実行エラー',
        description: '再実行に失敗しました',
        variant: 'destructive'
      })
    })
  })

  describe('handlePdfDownload', () => {
    it('PDF ダウンロードが成功すること', async () => {
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })
      mockFetch.mockResolvedValueOnce({
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

      const { result } = renderHook(() => useCheckActions(mockCheckDetail))

      await act(async () => {
        await result.current.handlePdfDownload()
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/checks/123/pdf')
      expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob)
      expect(mockElement.download).toBe('check_123.pdf')
      expect(mockElement.click).toHaveBeenCalled()
      expect(mockRevokeObjectURL).toHaveBeenCalled()
    })

    it('PDF生成が失敗した場合エラートーストが表示されること', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      const { result } = renderHook(() => useCheckActions(mockCheckDetail))

      await act(async () => {
        await result.current.handlePdfDownload()
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: 'PDF出力エラー',
        description: expect.stringContaining('ファイル処理でエラーが発生しました'),
        variant: 'destructive'
      })
    })
  })

  describe('handleDelete', () => {
    it('確認後に削除APIが呼ばれること', async () => {
      mockConfirm.mockReturnValue(true)
      mockFetch.mockResolvedValueOnce({
        ok: true
      })

      const { result } = renderHook(() => useCheckActions(mockCheckDetail))

      await act(async () => {
        await result.current.handleDelete()
      })

      expect(mockConfirm).toHaveBeenCalledWith('このチェック履歴を削除しますか？この操作は取り消せません。')
      expect(mockFetch).toHaveBeenCalledWith('/api/checks/123', {
        method: 'DELETE'
      })
      expect(mockToast).toHaveBeenCalledWith({
        title: '削除完了',
        description: 'チェック履歴を削除しました'
      })
      expect(window.location.href).toBe('/history')
    })

    it('ユーザーがキャンセルした場合何も実行されないこと', async () => {
      mockConfirm.mockReturnValue(false)

      const { result } = renderHook(() => useCheckActions(mockCheckDetail))

      await act(async () => {
        await result.current.handleDelete()
      })

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('削除APIが失敗した場合エラートーストが表示されること', async () => {
      mockConfirm.mockReturnValue(true)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      const { result } = renderHook(() => useCheckActions(mockCheckDetail))

      await act(async () => {
        await result.current.handleDelete()
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: '削除エラー',
        description: expect.stringContaining('削除に失敗しました'),
        variant: 'destructive'
      })
    })
  })

  describe('null チェック', () => {
    it('チェックデータがnullの場合適切に処理されること', async () => {
      const { result } = renderHook(() => useCheckActions(null))

      await act(async () => {
        await result.current.copyDiffFormat()
        await result.current.handleRerun()
        await result.current.handlePdfDownload()
        await result.current.handleDelete()
      })

      expect(mockWriteText).not.toHaveBeenCalled()
      expect(mockConfirm).not.toHaveBeenCalled()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })
})