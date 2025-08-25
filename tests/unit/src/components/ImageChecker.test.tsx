import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImageChecker from '@/components/ImageChecker'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

// モック設定
vi.mock('@/contexts/AuthContext')
vi.mock('@/hooks/use-toast')
vi.mock('@/infra/supabase/clientClient')
vi.mock('@/lib/api-client')

const mockUseAuth = vi.mocked(useAuth)
const mockUseToast = vi.mocked(useToast)

// テスト用のファイルオブジェクト作成関数
function createMockFile(name: string, size: number, type: string): File {
  return new File(['test content'], name, {
    type,
    lastModified: Date.now(),
  })
}

// Canvas と Image のモック
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: vi.fn(() => ({
    drawImage: vi.fn(),
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  })),
})

Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
  value: vi.fn((callback: (blob: Blob | null) => void) => {
    callback(new Blob(['processed'], { type: 'image/jpeg' }))
  }),
})

// Image コンストラクターのモック
global.Image = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn((event: string, handler: () => void) => {
    if (event === 'load') {
      setTimeout(handler, 0)
    }
  }),
  removeEventListener: vi.fn(),
  set src(value: string) {
    // srcが設定されたらloadイベントを発火
    setTimeout(() => {
      const loadEvent = new Event('load')
      this.dispatchEvent(loadEvent)
    }, 0)
  },
  width: 800,
  height: 600,
})) as any

describe('ImageChecker', () => {
  const mockToast = vi.fn()
  const mockUser = { id: '1', email: 'test@example.com' }

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      signIn: vi.fn(),
      signOut: vi.fn(),
      loading: false,
    })
    mockUseToast.mockReturnValue({ toast: mockToast })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('基本的なレンダリング', () => {
    it('初期状態で正しくレンダリングされる', () => {
      render(<ImageChecker />)
      
      expect(screen.getByText('画像から薬機法チェック')).toBeInTheDocument()
      expect(screen.getByText('画像をアップロードしてOCR処理を行い、薬機法に抵触する表現をチェック・修正します')).toBeInTheDocument()
      expect(screen.getByTestId('dropzone')).toBeInTheDocument()
      expect(screen.getByText('チェック開始')).toBeInTheDocument()
    })

    it('ドロップゾーンが適切なARIAラベルを持つ', () => {
      render(<ImageChecker />)
      
      const dropzone = screen.getByTestId('dropzone')
      expect(dropzone).toHaveAttribute('aria-label', '画像ファイルをアップロード')
      expect(dropzone).toHaveAttribute('role', 'button')
      expect(dropzone).toHaveAttribute('tabIndex', '0')
    })
  })

  describe('ファイル選択機能', () => {
    it('有効なファイルが選択できる', async () => {
      render(<ImageChecker />)
      
      const fileInput = screen.getByLabelText('ファイル選択')
      const validFile = createMockFile('test.jpg', 1024 * 1024, 'image/jpeg') // 1MB
      
      await act(async () => {
        await userEvent.upload(fileInput, validFile)
      })
      
      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument()
        expect(screen.getByText('サイズ: 1.00MB')).toBeInTheDocument()
      })
    })

    it('無効なファイル形式でエラーが表示される', async () => {
      render(<ImageChecker />)
      
      const fileInput = screen.getByLabelText('ファイル選択')
      const invalidFile = createMockFile('test.pdf', 1024, 'application/pdf')
      
      await act(async () => {
        await userEvent.upload(fileInput, invalidFile)
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument()
        expect(screen.getByText('対応していないファイル形式です（JPEG/PNG/WebP）')).toBeInTheDocument()
      })
    })

    it('ファイルサイズが大きすぎるとエラーが表示される', async () => {
      render(<ImageChecker />)
      
      const fileInput = screen.getByLabelText('ファイル選択')
      const largeFile = createMockFile('large.jpg', 11 * 1024 * 1024, 'image/jpeg') // 11MB
      
      await act(async () => {
        await userEvent.upload(fileInput, largeFile)
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument()
        expect(screen.getByText('ファイルサイズが10MBを超えています')).toBeInTheDocument()
      })
    })

    it('ファイルクリア機能が動作する', async () => {
      render(<ImageChecker />)
      
      const fileInput = screen.getByLabelText('ファイル選択')
      const validFile = createMockFile('test.jpg', 1024, 'image/jpeg')
      
      await act(async () => {
        await userEvent.upload(fileInput, validFile)
      })
      
      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument()
      })
      
      const clearButton = screen.getByTestId('clear-file-button')
      await act(async () => {
        await userEvent.click(clearButton)
      })
      
      await waitFor(() => {
        expect(screen.queryByText('test.jpg')).not.toBeInTheDocument()
      })
    })
  })

  describe('ドラッグ&ドロップ機能', () => {
    it('ドラッグオーバー時に視覚的フィードバックが表示される', async () => {
      render(<ImageChecker />)
      
      const dropzone = screen.getByTestId('dropzone')
      
      await act(async () => {
        fireEvent.dragEnter(dropzone, {
          dataTransfer: {
            types: ['Files'],
          },
        })
      })
      
      await waitFor(() => {
        expect(dropzone).toHaveClass('border-blue-400', 'bg-blue-50')
        expect(screen.getByText('画像をドロップしてください')).toBeInTheDocument()
      })
    })

    it('ドラッグリーブ時に通常状態に戻る', async () => {
      render(<ImageChecker />)
      
      const dropzone = screen.getByTestId('dropzone')
      
      await act(async () => {
        fireEvent.dragEnter(dropzone, {
          dataTransfer: { types: ['Files'] },
        })
      })
      
      await act(async () => {
        fireEvent.dragLeave(dropzone, {
          relatedTarget: null,
        })
      })
      
      await waitFor(() => {
        expect(dropzone).toHaveClass('border-gray-300')
        expect(dropzone).not.toHaveClass('border-blue-400', 'bg-blue-50')
      })
    })

    it('ファイルドロップが正しく処理される', async () => {
      render(<ImageChecker />)
      
      const dropzone = screen.getByTestId('dropzone')
      const validFile = createMockFile('dropped.png', 2048, 'image/png')
      
      await act(async () => {
        fireEvent.drop(dropzone, {
          dataTransfer: {
            files: [validFile],
          },
        })
      })
      
      await waitFor(() => {
        expect(screen.getByText('dropped.png')).toBeInTheDocument()
        expect(screen.getByText('サイズ: 0.00MB')).toBeInTheDocument()
      })
    })
  })

  describe('キーボードアクセシビリティ', () => {
    it('Enterキーでファイル選択ダイアログが開く', async () => {
      render(<ImageChecker />)
      
      const dropzone = screen.getByTestId('dropzone')
      const fileInput = screen.getByLabelText('ファイル選択')
      
      const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => {})
      
      await act(async () => {
        fireEvent.keyDown(dropzone, { key: 'Enter' })
      })
      
      expect(clickSpy).toHaveBeenCalled()
    })

    it('スペースキーでファイル選択ダイアログが開く', async () => {
      render(<ImageChecker />)
      
      const dropzone = screen.getByTestId('dropzone')
      const fileInput = screen.getByLabelText('ファイル選択')
      
      const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => {})
      
      await act(async () => {
        fireEvent.keyDown(dropzone, { key: ' ' })
      })
      
      expect(clickSpy).toHaveBeenCalled()
    })
  })

  describe('チェック機能', () => {
    it('認証されていない場合エラーが表示される', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        signIn: vi.fn(),
        signOut: vi.fn(),
        loading: false,
      })
      
      render(<ImageChecker />)
      
      const fileInput = screen.getByLabelText('ファイル選択')
      const validFile = createMockFile('test.jpg', 1024, 'image/jpeg')
      
      await act(async () => {
        await userEvent.upload(fileInput, validFile)
      })
      
      const checkButton = screen.getByTestId('check-button')
      
      await act(async () => {
        await userEvent.click(checkButton)
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument()
        expect(screen.getByText(/認証が必要です/)).toBeInTheDocument()
      })
    })

    it('ファイルが選択されていない場合ボタンが無効化される', () => {
      render(<ImageChecker />)
      
      const checkButton = screen.getByTestId('check-button')
      expect(checkButton).toBeDisabled()
    })

    it('有効なファイル選択後にボタンが有効化される', async () => {
      render(<ImageChecker />)
      
      const fileInput = screen.getByLabelText('ファイル選択')
      const validFile = createMockFile('test.jpg', 1024, 'image/jpeg')
      
      await act(async () => {
        await userEvent.upload(fileInput, validFile)
      })
      
      await waitFor(() => {
        const checkButton = screen.getByTestId('check-button')
        expect(checkButton).not.toBeDisabled()
      })
    })
  })

  describe('チェック履歴機能', () => {
    it('チェック履歴が表示される', async () => {
      // E2Eモックを有効化
      Object.defineProperty(process.env, 'NEXT_PUBLIC_SKIP_AUTH', {
        value: 'true',
        writable: true
      })
      
      render(<ImageChecker />)
      
      const fileInput = screen.getByLabelText('ファイル選択')
      const validFile = createMockFile('test.jpg', 1024, 'image/jpeg')
      
      await act(async () => {
        await userEvent.upload(fileInput, validFile)
      })
      
      const checkButton = screen.getByTestId('check-button')
      
      await act(async () => {
        await userEvent.click(checkButton)
      })
      
      // チェック履歴の表示を待機
      await waitFor(() => {
        expect(screen.getByText('チェック履歴')).toBeInTheDocument()
        expect(screen.getByTestId('check-history-item')).toBeInTheDocument()
      })
    })

    it('キャンセルボタンが動作する', async () => {
      Object.defineProperty(process.env, 'NEXT_PUBLIC_SKIP_AUTH', {
        value: 'true',
        writable: true
      })
      
      render(<ImageChecker />)
      
      const fileInput = screen.getByLabelText('ファイル選択')
      const validFile = createMockFile('test.jpg', 1024, 'image/jpeg')
      
      await act(async () => {
        await userEvent.upload(fileInput, validFile)
      })
      
      const checkButton = screen.getByTestId('check-button')
      
      await act(async () => {
        await userEvent.click(checkButton)
      })
      
      //処理中の状態になるまで待機
      await waitFor(() => {
        expect(screen.getByTestId('cancel-button')).toBeInTheDocument()
      })
      
      const cancelButton = screen.getByTestId('cancel-button')
      
      await act(async () => {
        await userEvent.click(cancelButton)
      })
      
      await waitFor(() => {
        expect(screen.getByText(/キャンセルされました/)).toBeInTheDocument()
      })
    })
  })

  describe('レスポンシブデザイン', () => {
    it('モバイルビューポートでレイアウトが調整される', () => {
      // ビューポートサイズをモバイルに設定
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })
      
      render(<ImageChecker />)
      
      const container = screen.getByRole('main', { hidden: true }) || document.querySelector('.container')
      expect(container).toBeInTheDocument()
      
      // グリッドレイアウトが適用されていることを確認
      const gridContainer = document.querySelector('.grid')
      expect(gridContainer).toHaveClass('grid-cols-1')
    })
  })

  describe('エラーハンドリング', () => {
    it('エラー状態の再試行ボタンが動作する', async () => {
      render(<ImageChecker />)
      
      const fileInput = screen.getByLabelText('ファイル選択')
      const invalidFile = createMockFile('test.txt', 1024, 'text/plain')
      
      await act(async () => {
        await userEvent.upload(fileInput, invalidFile)
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument()
      })
      
      const retryButton = screen.getByTestId('error-dismiss-button')
      
      await act(async () => {
        await userEvent.click(retryButton)
      })
      
      await waitFor(() => {
        expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
      })
    })
  })

  describe('結果表示機能', () => {
    it('結果タブが正しく表示される', async () => {
      Object.defineProperty(process.env, 'NEXT_PUBLIC_SKIP_AUTH', {
        value: 'true',
        writable: true
      })
      
      render(<ImageChecker />)
      
      const fileInput = screen.getByLabelText('ファイル選択')
      const validFile = createMockFile('test.jpg', 1024, 'image/jpeg')
      
      await act(async () => {
        await userEvent.upload(fileInput, validFile)
      })
      
      const checkButton = screen.getByTestId('check-button')
      
      await act(async () => {
        await userEvent.click(checkButton)
      })
      
      // 結果完了まで待機
      await waitFor(() => {
        expect(screen.getByTestId('results-section')).toBeInTheDocument()
      }, { timeout: 3000 })
      
      expect(screen.getByText('プレビュー')).toBeInTheDocument()
      expect(screen.getByTestId('results-tab')).toBeInTheDocument()
    })

    it('コピー機能が動作する', async () => {
      Object.defineProperty(process.env, 'NEXT_PUBLIC_SKIP_AUTH', {
        value: 'true',
        writable: true
      })
      
      render(<ImageChecker />)
      
      const fileInput = screen.getByLabelText('ファイル選択')
      const validFile = createMockFile('test.jpg', 1024, 'image/jpeg')
      
      await act(async () => {
        await userEvent.upload(fileInput, validFile)
      })
      
      const checkButton = screen.getByTestId('check-button')
      
      await act(async () => {
        await userEvent.click(checkButton)
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('results-section')).toBeInTheDocument()
      }, { timeout: 3000 })
      
      const copyButton = screen.getByTestId('copy-button')
      
      await act(async () => {
        await userEvent.click(copyButton)
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('copy-success')).toBeInTheDocument()
      })
    })
  })
})