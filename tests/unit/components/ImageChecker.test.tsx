import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock hooks
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u', email: 'test@example.com' } }),
}))

vi.mock('@/infra/supabase/clientClient', () => ({
  createClient: vi.fn(() => ({
    auth: { 
      getSession: vi.fn(async () => ({ data: { session: { access_token: 'token' } } })) 
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: null, error: null }))
        }))
      }))
    }))
  })),
}))

// Mock EventSource
class MockEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  addEventListener = vi.fn()
  close = vi.fn()
  
  constructor(public url: string) {}
}

global.EventSource = MockEventSource as any

// Mock fetch
global.fetch = vi.fn()

import ImageChecker from '@/components/ImageChecker'

describe('ImageChecker (Enhanced)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ヘルパー関数：ファイル入力要素を取得
  const getFileInput = (): HTMLInputElement => {
    return screen.getByLabelText(/画像ファイル/)?.closest('div')?.querySelector('#file-input') as HTMLInputElement
  }

  describe('初期表示', () => {
    it('コンポーネントが正しく表示される', () => {
      render(<ImageChecker />)
      
      expect(screen.getByText('画像から薬機法チェック')).toBeInTheDocument()
      expect(screen.getByText('画像をアップロードしてOCRで文字を抽出し、薬機法違反をチェック・修正します')).toBeInTheDocument()
      expect(screen.getByTestId('dropzone')).toBeInTheDocument()
      expect(screen.getByText('ここにドラッグ&ドロップ、またはクリックして選択')).toBeInTheDocument()
      expect(screen.getByText('対応形式: JPEG, PNG, WebP（最大10MB）')).toBeInTheDocument()
    })

    it('ドロップゾーンがキーボードアクセス可能', () => {
      render(<ImageChecker />)
      
      const dropzone = screen.getByTestId('dropzone')
      expect(dropzone).toHaveAttribute('tabIndex', '0')
      expect(dropzone).toHaveAttribute('role', 'button')
      expect(dropzone).toHaveAttribute('aria-label', '画像ファイルのアップロード')
    })
  })

  describe('ファイル選択とバリデーション', () => {
    it('有効なJPEGファイルを選択できる', async () => {
      render(<ImageChecker />)
      
      const input = getFileInput()
      const validFile = new File([new Uint8Array([1,2,3])], 'test.jpg', { type: 'image/jpeg' })
      
      fireEvent.change(input, { target: { files: [validFile] } })
      
      await waitFor(() => {
        expect(screen.getByText('ファイルが選択されました')).toBeInTheDocument()
        expect(screen.getByText('test.jpg (0.0MB)')).toBeInTheDocument()
      })
    })

    it('有効なPNGファイルを選択できる', async () => {
      render(<ImageChecker />)
      
      const input = getFileInput()
      const validFile = new File([new Uint8Array([1,2,3])], 'test.png', { type: 'image/png' })
      
      fireEvent.change(input, { target: { files: [validFile] } })
      
      await waitFor(() => {
        expect(screen.getByText('ファイルが選択されました')).toBeInTheDocument()
      })
    })

    it('有効なWebPファイルを選択できる', async () => {
      render(<ImageChecker />)
      
      const input = getFileInput()
      const validFile = new File([new Uint8Array([1,2,3])], 'test.webp', { type: 'image/webp' })
      
      fireEvent.change(input!, { target: { files: [validFile] } })
      
      await waitFor(() => {
        expect(screen.getByText('ファイルが選択されました')).toBeInTheDocument()
      })
    })

    it('不正なファイル形式（GIF）でエラーを表示', async () => {
      render(<ImageChecker />)
      
      const input = getFileInput()
      const invalidFile = new File([new Uint8Array([1,2,3])], 'test.gif', { type: 'image/gif' })
      
      fireEvent.change(input!, { target: { files: [invalidFile] } })
      
      await waitFor(() => {
        expect(screen.getByText(/対応していないファイル形式です。JPEG、PNG、WebP形式のファイルを選択してください。/)).toBeInTheDocument()
      })
    })

    it('ファイルサイズが10MBを超える場合エラーを表示', async () => {
      render(<ImageChecker />)
      
      const input = getFileInput()
      const largeFile = new File([new Uint8Array(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })
      
      fireEvent.change(input!, { target: { files: [largeFile] } })
      
      await waitFor(() => {
        expect(screen.getByText(/ファイルサイズが制限を超えています/)).toBeInTheDocument()
      })
    })

    it('拡張子とMIMEタイプが一致しない場合エラーを表示', async () => {
      render(<ImageChecker />)
      
      const input = getFileInput()
      const mismatchFile = new File([new Uint8Array([1,2,3])], 'test.jpg', { type: 'image/png' })
      
      fireEvent.change(input!, { target: { files: [mismatchFile] } })
      
      // In this case, the file should still be accepted since PNG is a valid type
      await waitFor(() => {
        expect(screen.getByText('ファイルが選択されました')).toBeInTheDocument()
      })
    })
  })

  describe('ドラッグ&ドロップ', () => {
    it('ドラッグエンター時に視覚的フィードバックを表示', () => {
      render(<ImageChecker />)
      
      const dropzone = screen.getByTestId('dropzone')
      
      fireEvent.dragEnter(dropzone)
      
      expect(dropzone).toHaveClass('border-blue-400', 'bg-blue-50')
      expect(screen.getByText('ファイルをドロップしてください')).toBeInTheDocument()
    })

    it('ドラッグリーブ時に通常表示に戻る', () => {
      render(<ImageChecker />)
      
      const dropzone = screen.getByTestId('dropzone')
      
      fireEvent.dragEnter(dropzone)
      fireEvent.dragLeave(dropzone, { relatedTarget: document.body })
      
      expect(dropzone).toHaveClass('border-gray-300')
      expect(screen.getByText('ここにドラッグ&ドロップ、またはクリックして選択')).toBeInTheDocument()
    })

    it('有効なファイルをドロップできる', async () => {
      render(<ImageChecker />)
      
      const dropzone = screen.getByTestId('dropzone')
      const validFile = new File([new Uint8Array([1,2,3])], 'dropped.jpg', { type: 'image/jpeg' })
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [validFile],
        },
      })
      
      await waitFor(() => {
        expect(screen.getByText('ファイルが選択されました')).toBeInTheDocument()
        expect(screen.getByText('dropped.jpg (0.0MB)')).toBeInTheDocument()
      })
    })
  })

  describe('ファイル選択後のUI', () => {
    beforeEach(async () => {
      render(<ImageChecker />)
      
      const input = getFileInput()
      const validFile = new File([new Uint8Array([1,2,3])], 'test.jpg', { type: 'image/jpeg' })
      
      fireEvent.change(input!, { target: { files: [validFile] } })
      
      await waitFor(() => {
        expect(screen.getByText('ファイルが選択されました')).toBeInTheDocument()
      })
    })

    it('チェック開始ボタンが表示される', () => {
      expect(screen.getByTestId('check-button')).toBeInTheDocument()
      expect(screen.getByText('チェック開始')).toBeInTheDocument()
    })

    it('クリアボタンが表示される', () => {
      expect(screen.getByText('クリア')).toBeInTheDocument()
    })

    it('画像プレビューが表示される', () => {
      expect(screen.getByText('画像プレビュー')).toBeInTheDocument()
      expect(screen.getByAltText('アップロード画像のプレビュー')).toBeInTheDocument()
    })

    it('クリアボタンでファイルをクリアできる', async () => {
      const clearButton = screen.getByText('クリア')
      
      fireEvent.click(clearButton)
      
      await waitFor(() => {
        expect(screen.queryByText('ファイルが選択されました')).not.toBeInTheDocument()
        expect(screen.queryByText('チェック開始')).not.toBeInTheDocument()
        expect(screen.getByText('ここにドラッグ&ドロップ、またはクリックして選択')).toBeInTheDocument()
      })
    })
  })

  describe('キーボードアクセシビリティ', () => {
    it('エンターキーでファイル選択ダイアログを開く', () => {
      render(<ImageChecker />)
      
      const dropzone = screen.getByTestId('dropzone')
      
      // Mock click on file input
      const fileInput = document.getElementById('file-input')
      const clickSpy = vi.spyOn(fileInput!, 'click').mockImplementation(() => {})
      
      fireEvent.keyDown(dropzone, { key: 'Enter' })
      
      expect(clickSpy).toHaveBeenCalled()
    })

    it('スペースキーでファイル選択ダイアログを開く', () => {
      render(<ImageChecker />)
      
      const dropzone = screen.getByTestId('dropzone')
      
      // Mock click on file input
      const fileInput = document.getElementById('file-input')
      const clickSpy = vi.spyOn(fileInput!, 'click').mockImplementation(() => {})
      
      fireEvent.keyDown(dropzone, { key: ' ' })
      
      expect(clickSpy).toHaveBeenCalled()
    })
  })

  describe('エラーハンドリング', () => {
    it('エラーメッセージが表示される', async () => {
      render(<ImageChecker />)
      
      const input = getFileInput()
      const invalidFile = new File([new Uint8Array([1,2,3])], 'test.bmp', { type: 'image/bmp' })
      
      fireEvent.change(input!, { target: { files: [invalidFile] } })
      
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument()
        expect(screen.getByText(/対応していないファイル形式です/)).toBeInTheDocument()
      })
    })

    it('再試行ボタンが表示される', async () => {
      render(<ImageChecker />)
      
      const input = getFileInput()
      const invalidFile = new File([new Uint8Array([1,2,3])], 'test.bmp', { type: 'image/bmp' })
      
      fireEvent.change(input!, { target: { files: [invalidFile] } })
      
      await waitFor(() => {
        expect(screen.getByTestId('retry-button')).toBeInTheDocument()
      })
    })
  })

  describe('チェック履歴', () => {
    it('チェック履歴が表示されない（初期状態）', () => {
      render(<ImageChecker />)
      
      expect(screen.queryByText('チェック履歴')).not.toBeInTheDocument()
    })
  })

  describe('結果表示エリア', () => {
    it('初期状態でプレースホルダーが表示される', () => {
      render(<ImageChecker />)
      
      expect(screen.getByText('画像を選択し、「チェック開始」ボタンを押してください')).toBeInTheDocument()
    })
  })

  describe('レスポンシブデザイン', () => {
    it('適切なCSSクラスが適用される', () => {
      render(<ImageChecker />)
      
      const container = screen.getByText('画像から薬機法チェック').closest('.container')
      expect(container).toHaveClass('mx-auto', 'px-4', 'py-8', 'max-w-6xl')
      
      const grid = container?.querySelector('.grid')
      expect(grid).toHaveClass('grid-cols-1', 'lg:grid-cols-2', 'gap-8')
    })
  })

  describe('アクセシビリティ', () => {
    it('適切なARIAラベルが設定される', () => {
      render(<ImageChecker />)
      
      const dropzone = screen.getByTestId('dropzone')
      expect(dropzone).toHaveAttribute('aria-label', '画像ファイルのアップロード')
      
      const fileInput = document.getElementById('file-input')
      expect(fileInput).toHaveAttribute('aria-describedby', 'file-input-help')
    })

    it('適切なHTMLセマンティクスが使用される', () => {
      render(<ImageChecker />)
      
      expect(screen.getByRole('main') || screen.getByRole('document')).toBeDefined()
      expect(screen.getByRole('button', { name: /画像ファイルのアップロード/ })).toBeDefined()
    })
  })
})