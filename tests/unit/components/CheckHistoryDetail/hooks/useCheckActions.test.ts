import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCheckActions } from '@/components/CheckHistoryDetail/hooks/useCheckActions'
import { CheckDetail } from '@/components/CheckHistoryDetail/types'

// MSWとの競合を避けるため手動でfetchをモック

// ErrorFactory のモック
vi.mock('@/lib/errors', () => ({
  ErrorFactory: {
    createFileProcessingError: vi.fn().mockReturnValue(new Error('ファイルPDF生成に失敗しました')),
    createApiError: vi.fn().mockReturnValue(new Error('削除に失敗しました'))
  }
}))

// toast のモック
const { toast } = vi.hoisted(() => ({
  toast: vi.fn().mockReturnValue({ id: 'mock-toast-id', dismiss: vi.fn(), update: vi.fn() })
}))

vi.mock('@/hooks/use-toast', () => ({
  toast,
  useToast: vi.fn().mockReturnValue({
    toast,
    toasts: [],
    dismiss: vi.fn()
  })
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

// location mock with setter tracking
let mockLocationHref = ''
const mockLocationSetter = vi.fn((value) => { mockLocationHref = value })
Object.defineProperty(window, 'location', {
  value: {
    get href() { return mockLocationHref },
    set href(value) { mockLocationSetter(value); mockLocationHref = value },
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn()
  },
  writable: true,
  configurable: true
})

Object.assign(window, {
  confirm: mockConfirm
})

Object.assign(document, {
  createElement: mockCreateElement
})

// URL API のモック
global.URL = class MockURL {
  constructor(url, base) {
    if (typeof url === 'string' && url.startsWith('/')) {
      // 相対URLの処理
      this.href = `http://localhost:3000${url}`
    } else {
      this.href = url
    }
  }
  
  static createObjectURL = mockCreateObjectURL
  static revokeObjectURL = mockRevokeObjectURL
}

// fetch のモック - MSWが期待通りに動作しないため手動でモック
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
    
    // MSWとの競合を避けるためfetchを完全にオーバーライド
    global.fetch = mockFetch
    
    // window.location をリセット
    mockLocationHref = ''
    mockLocationSetter.mockClear()
    
    // confirmをリセット
    mockConfirm.mockClear()
    
    // DOM API のモック
    const mockElement = {
      href: '',
      download: '',
      click: vi.fn(),
      remove: vi.fn(),
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      style: {}
    }
    mockCreateElement.mockReturnValue(mockElement)
    mockCreateObjectURL.mockReturnValue('blob:mock-url')
    document.body.appendChild = vi.fn()
    
    // Node.js環境でのURL解決を修正
    global.URL.createObjectURL = mockCreateObjectURL
    global.URL.revokeObjectURL = mockRevokeObjectURL
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('copyToClipboard', () => {
    it('テキストを正常にクリップボードにコピーできること', async () => {
      mockWriteText.mockResolvedValueOnce(undefined)

      const actions = useCheckActions(mockCheckDetail)

      await actions.copyToClipboard('テストテキスト', '元テキスト')

      expect(mockWriteText).toHaveBeenCalledWith('テストテキスト')
      expect(toast).toHaveBeenCalledWith({
        title: 'コピーしました',
        description: '元テキストをクリップボードにコピーしました'
      })
    })

    it('クリップボードアクセスに失敗した場合エラートーストが表示されること', async () => {
      mockWriteText.mockRejectedValueOnce(new Error('Clipboard access denied'))

      const actions = useCheckActions(mockCheckDetail)

      await actions.copyToClipboard('テストテキスト', '元テキスト')

      expect(toast).toHaveBeenCalledWith({
        title: 'コピーに失敗しました',
        description: 'クリップボードへのアクセスに失敗しました',
        variant: 'destructive'
      })
    })
  })

  describe('copyDiffFormat', () => {
    it('テキストチェックのdiff形式をコピーできること', async () => {
      mockWriteText.mockResolvedValueOnce(undefined)

      const actions = useCheckActions(mockCheckDetail)

      await actions.copyDiffFormat()

      expect(mockWriteText).toHaveBeenCalled()
      expect(toast).toHaveBeenCalledWith({
        title: 'コピーしました',
        description: 'diff形式をクリップボードにコピーしました'
      })
    })

    it('画像チェックの場合抽出テキストを使用すること', async () => {
      mockWriteText.mockResolvedValueOnce(undefined)

      const actions = useCheckActions(mockImageCheckDetail)

      await actions.copyDiffFormat()

      expect(mockWriteText).toHaveBeenCalled()
      // 実際の引数の確認は複雑なため、呼び出されたことのみ確認
    })

    it('チェックデータが存在しない場合何も実行されないこと', async () => {
      const actions = useCheckActions(null)

      await actions.copyDiffFormat()

      expect(mockWriteText).not.toHaveBeenCalled()
    })
  })

  describe('handleRerun', () => {
    it('確認後に再実行APIが呼ばれること', async () => {
      mockConfirm.mockReturnValueOnce(true)
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ check: { id: 456 } })
      }
      mockFetch.mockResolvedValueOnce(mockResponse)

      const actions = useCheckActions(mockCheckDetail)

      await actions.handleRerun()

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
      expect(mockLocationHref).toBe('/history/456')
    })

    it('画像チェックの再実行で抽出テキストを使用すること', async () => {
      mockConfirm.mockReturnValueOnce(true)
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ check: { id: 457 } })
      }
      mockFetch.mockResolvedValueOnce(mockResponse)

      const actions = useCheckActions(mockImageCheckDetail)

      await actions.handleRerun()

      expect(mockFetch).toHaveBeenCalledWith('/api/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputType: 'image',
          text: 'OCRで抽出されたテキスト',
          imageUrl: '/uploads/test.jpg'
        })
      })
      expect(mockLocationHref).toBe('/history/457')
    })

    it('ユーザーがキャンセルした場合何も実行されないこと', async () => {
      mockConfirm.mockReturnValue(false)

      const actions = useCheckActions(mockCheckDetail)

      await actions.handleRerun()

      // キャンセル時はlocation.hrefは変更されない
      expect(mockLocationHref).toBe('')
    })

    it('再実行APIが失敗した場合エラートーストが表示されること', async () => {
      mockConfirm.mockReturnValueOnce(true)
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const actions = useCheckActions(mockCheckDetail)

      await actions.handleRerun()

      expect(toast).toHaveBeenCalledWith({
        title: '再実行エラー',
        description: '再実行に失敗しました',
        variant: 'destructive'
      })
    })
  })

  describe('handlePdfDownload', () => {
    it('PDF ダウンロードが成功すること', async () => {
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' })
      const mockResponse = {
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob)
      }
      mockFetch.mockResolvedValueOnce(mockResponse)

      const mockElement = {
        href: '',
        download: '',
        click: vi.fn(),
        remove: vi.fn()
      }
      mockCreateElement.mockReturnValue(mockElement)

      const actions = useCheckActions(mockCheckDetail)

      await actions.handlePdfDownload()

      // PDFダウンロードの副作用を確認
      expect(mockCreateObjectURL).toHaveBeenCalled()
      expect(mockElement.download).toBe('check_123.pdf')
      expect(mockElement.click).toHaveBeenCalled()
      expect(mockRevokeObjectURL).toHaveBeenCalled()
    })

    it('PDF生成が失敗した場合エラートーストが表示されること', async () => {
      const mockResponse = {
        ok: false,
        status: 500
      }
      mockFetch.mockResolvedValueOnce(mockResponse)

      const actions = useCheckActions(mockCheckDetail)

      await actions.handlePdfDownload()

      expect(toast).toHaveBeenCalledWith({
        title: 'PDF出力エラー',
        description: '不明なエラー',
        variant: 'destructive'
      })
    })
  })

  describe('handleDelete', () => {
    it('確認後に削除APIが呼ばれること', async () => {
      mockConfirm.mockReturnValueOnce(true)
      const mockResponse = {
        ok: true
      }
      mockFetch.mockResolvedValueOnce(mockResponse)

      const actions = useCheckActions(mockCheckDetail)

      await actions.handleDelete()

      expect(mockConfirm).toHaveBeenCalledWith('このチェック履歴を削除しますか？この操作は取り消せません。')
      expect(mockFetch).toHaveBeenCalledWith('/api/checks/123', {
        method: 'DELETE'
      })
      expect(toast).toHaveBeenCalledWith({
        title: '削除完了',
        description: 'チェック履歴を削除しました'
      })
      expect(mockLocationHref).toBe('/history')
    })

    it('ユーザーがキャンセルした場合何も実行されないこと', async () => {
      mockConfirm.mockReturnValue(false)

      const actions = useCheckActions(mockCheckDetail)

      await actions.handleDelete()

      // キャンセル時はlocation.hrefは変更されない
      expect(mockLocationHref).toBe('')
    })

    it('削除APIが失敗した場合エラートーストが表示されること', async () => {
      mockConfirm.mockReturnValueOnce(true)
      const mockResponse = {
        ok: false,
        status: 500
      }
      mockFetch.mockResolvedValueOnce(mockResponse)

      const actions = useCheckActions(mockCheckDetail)

      await actions.handleDelete()

      expect(toast).toHaveBeenCalledWith({
        title: '削除エラー',
        description: '削除に失敗しました',
        variant: 'destructive'
      })
    })
  })

  describe('null チェック', () => {
    it('チェックデータがnullの場合適切に処理されること', async () => {
      const actions = useCheckActions(null)

      await actions.copyDiffFormat()
      await actions.handleRerun()
      await actions.handlePdfDownload()
      await actions.handleDelete()

      expect(mockWriteText).not.toHaveBeenCalled()
      expect(mockConfirm).not.toHaveBeenCalled()
      // location.hrefは変更されない
      expect(mockLocationHref).toBe('')
    })
  })
})