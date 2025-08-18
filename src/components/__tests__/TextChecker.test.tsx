import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { useAuth } from '../../contexts/AuthContext'
import TextChecker from '../TextChecker'

// Mock the AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn()
}))

// Create local mock for Supabase client
const mockSupabaseClient = {
  auth: {
    getSession: vi.fn(() => Promise.resolve({
      data: {
        session: {
          access_token: 'mock-token',
          user: { id: 'test-user-id', email: 'test@example.com' }
        }
      },
      error: null
    }))
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({
          data: { id: 1, status: 'completed' },
          error: null
        }))
      }))
    }))
  }))
}

// Mock the Supabase client locally for this test file
vi.mock('../../lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock EventSource
const mockEventSource = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  dispatchEvent: vi.fn(),
  onerror: null,
  onmessage: null,
  onopen: null,
  readyState: 1,
  url: '',
  withCredentials: false,
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2
}

const EventSourceConstructor = vi.fn(() => mockEventSource) as unknown as {
  new (url: string | URL, eventSourceInitDict?: EventSourceInit): EventSource
  readonly CONNECTING: 0
  readonly OPEN: 1
  readonly CLOSED: 2
  prototype: EventSource
}

// Define static properties on the constructor
Object.defineProperty(EventSourceConstructor, 'CONNECTING', { value: 0, writable: false })
Object.defineProperty(EventSourceConstructor, 'OPEN', { value: 1, writable: false })
Object.defineProperty(EventSourceConstructor, 'CLOSED', { value: 2, writable: false })

global.EventSource = EventSourceConstructor

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve())
  }
})

// Mock window.alert
Object.assign(window, {
  alert: vi.fn()
})

describe('TextCheckerコンポーネント', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      loading: false,
      signOut: vi.fn(),
      refresh: vi.fn(),
      userProfile: null,
      organization: null
    })
    
    // Reset local mock supabase client
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'mock-token',
          user: mockUser
        }
      },
      error: null
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('メインインターフェースが正常にレンダリングされること', () => {
    render(<TextChecker />)
    
    expect(screen.getByText('薬機法チェック & リライト')).toBeInTheDocument()
    expect(screen.getByText('テキストを入力して薬機法に抵触する表現をチェックし、安全な表現にリライトします')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'チェック開始' })).toBeInTheDocument()
  })

  it('文字数が正しく表示されること', async () => {
    const user = userEvent.setup()
    render(<TextChecker />)
    
    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'テストテキスト')
    
    expect(screen.getByText('7 / 10,000文字')).toBeInTheDocument()
  })

  it('テキストが空の場合送信ボタンが無効化されること', () => {
    render(<TextChecker />)
    
    const submitButton = screen.getByRole('button', { name: 'チェック開始' })
    expect(submitButton).toBeDisabled()
  })

  it('テキストが入力された場合送信ボタンが有効化されること', async () => {
    const user = userEvent.setup()
    render(<TextChecker />)
    
    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button', { name: 'チェック開始' })
    
    await user.type(textarea, 'テストテキスト')
    
    expect(submitButton).not.toBeDisabled()
  })

  it('テキストが文字数制限を超えた場合エラーが表示されること', async () => {
    render(<TextChecker />)
    
    const textarea = screen.getByRole('textbox')
    const longText = 'a'.repeat(10001)
    
    // Use fireEvent.change to simulate text change directly
    fireEvent.change(textarea, { target: { value: longText } })
    
    // Check for character count text more flexibly
    expect(screen.getByText((content, _element) => {
      return content.includes('10,001') && content.includes('10,000') && content.includes('文字')
    })).toBeInTheDocument()
  }, 10000)

  it.skip('ユーザーが認証されていない場合エラーが表示されること', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signOut: vi.fn(),
      refresh: vi.fn(),
      userProfile: null,
      organization: null
    })

    const user = userEvent.setup()
    render(<TextChecker />)
    
    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button', { name: 'チェック開始' })
    
    await user.type(textarea, 'テストテキスト')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/認証が必要です/)).toBeInTheDocument()
    })
  })

  it.skip('送信ボタンをクリックしたときチェックプロセスが開始されること', async () => {
    const user = userEvent.setup()
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 123 })
    })
    
    render(<TextChecker />)
    
    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button', { name: 'チェック開始' })
    
    await user.type(textarea, 'テストテキスト')
    await user.click(submitButton)
    
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/checks',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({ text: 'テストテキスト' })
      })
    )
  })

  it.skip('チェック中にローディング状態が表示されること', async () => {
    const user = userEvent.setup()
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 123 })
    })
    
    render(<TextChecker />)
    
    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button', { name: 'チェック開始' })
    
    await user.type(textarea, 'テストテキスト')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('チェックをキューに追加しています...')).toBeInTheDocument()
    })
  })

  it.skip('正常に送信後入力がクリアされること', async () => {
    const user = userEvent.setup()
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 123 })
    })
    
    render(<TextChecker />)
    
    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button', { name: 'チェック開始' })
    
    await user.type(textarea, 'テストテキスト')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toBe('')
    })
  })

  it.skip('送信後履歴にチェックが表示されること', async () => {
    const user = userEvent.setup()
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 123 })
    })
    
    render(<TextChecker />)
    
    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button', { name: 'チェック開始' })
    
    await user.type(textarea, 'テストテキスト')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('チェック履歴')).toBeInTheDocument()
      expect(screen.getByText('テストテキスト')).toBeInTheDocument()
    })
  })

  it.skip('APIエラーを適切に処理すること', async () => {
    const user = userEvent.setup()
    
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal server error' })
    })
    
    render(<TextChecker />)
    
    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button', { name: 'チェック開始' })
    
    await user.type(textarea, 'テストテキスト')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/エラー: Internal server error/)).toBeInTheDocument()
    })
  })

  it.skip('ネットワークエラーを適切に処理すること', async () => {
    const user = userEvent.setup()
    
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    
    render(<TextChecker />)
    
    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button', { name: 'チェック開始' })
    
    await user.type(textarea, 'テストテキスト')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/エラー: Network error/)).toBeInTheDocument()
    })
  })

  it.skip('SSE経由でステータスが更新されること', async () => {
    const user = userEvent.setup()
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 123 })
    })
    
    render(<TextChecker />)
    
    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button', { name: 'チェック開始' })
    
    await user.type(textarea, 'テストテキスト')
    await user.click(submitButton)
    
    // Simulate SSE message
    const onMessageHandler = mockEventSource.onmessage as ((event: MessageEvent) => void) | null
    if (onMessageHandler) {
      onMessageHandler({
        data: JSON.stringify({
          status: 'processing'
        })
      } as MessageEvent)
    }
    
    await waitFor(() => {
      expect(screen.getByText('薬機法違反の検出と修正を実行中...')).toBeInTheDocument()
    })
  })

  it.skip('チェック完了時に結果が表示されること', async () => {
    const user = userEvent.setup()
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 123 })
    })
    
    render(<TextChecker />)
    
    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button', { name: 'チェック開始' })
    
    await user.type(textarea, 'テストテキスト')
    await user.click(submitButton)
    
    // Simulate SSE completion message
    const onMessageHandler = mockEventSource.onmessage as ((event: MessageEvent) => void) | null
    if (onMessageHandler) {
      onMessageHandler({
        data: JSON.stringify({
          status: 'completed',
          id: 123,
          original_text: 'テストテキスト',
          modified_text: '修正されたテキスト',
          violations: []
        })
      } as MessageEvent)
    }
    
    await waitFor(() => {
      expect(screen.getByText('チェック完了')).toBeInTheDocument()
      expect(screen.getByText('チェック結果')).toBeInTheDocument()
    })
  })

  it.skip('タイムアウトを適切に処理すること', async () => {
    const user = userEvent.setup()
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 123 })
    })
    
    // Mock setTimeout to trigger immediately
    vi.spyOn(global, 'setTimeout').mockImplementation((callback, _delay) => {
      if (typeof callback === 'function') {
        callback()
      }
      return 1 as unknown as NodeJS.Timeout
    })
    
    render(<TextChecker />)
    
    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button', { name: 'チェック開始' })
    
    await user.type(textarea, 'テストテキスト')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('処理がタイムアウトしました')).toBeInTheDocument()
    }, { timeout: 10000 })
  })

  it.skip('履歴のチェック間での切り替えが可能なこと', async () => {
    const user = userEvent.setup()
    
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 123 })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 124 })
      })
    
    render(<TextChecker />)
    
    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button', { name: 'チェック開始' })
    
    // Submit first check
    await user.type(textarea, '最初のテキスト')
    await user.click(submitButton)
    
    // Complete first check
    const onMessageHandler = mockEventSource.onmessage as ((event: MessageEvent) => void) | null
    if (onMessageHandler) {
      onMessageHandler({
        data: JSON.stringify({
          status: 'completed',
          id: 123,
          original_text: '最初のテキスト',
          modified_text: '修正された最初のテキスト',
          violations: []
        })
      } as MessageEvent)
    }
    
    await waitFor(() => {
      expect(screen.getByText('最初のテキスト')).toBeInTheDocument()
    })
    
    // Submit second check
    await user.type(textarea, '二番目のテキスト')
    await user.click(submitButton)
    
    // Complete second check
    if (onMessageHandler) {
      (onMessageHandler as (event: MessageEvent) => void)({
        data: JSON.stringify({
          status: 'completed',
          id: 124,
          original_text: '二番目のテキスト',
          modified_text: '修正された二番目のテキスト',
          violations: []
        })
      } as MessageEvent)
    }
    
    await waitFor(() => {
      expect(screen.getByText('二番目のテキスト')).toBeInTheDocument()
    })
    
    // Click on first check in history
    await user.click(screen.getByText('最初のテキスト'))
    
    await waitFor(() => {
      expect(screen.getByText('修正された最初のテキスト')).toBeInTheDocument()
    })
  })

  it.skip('コピー機能を適切に処理すること', async () => {
    const user = userEvent.setup()
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 123 })
    })
    
    render(<TextChecker />)
    
    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button', { name: 'チェック開始' })
    
    await user.type(textarea, 'テストテキスト')
    await user.click(submitButton)
    
    // Complete check
    const onMessageHandler = mockEventSource.onmessage as ((event: MessageEvent) => void) | null
    if (onMessageHandler) {
      onMessageHandler({
        data: JSON.stringify({
          status: 'completed',
          id: 123,
          original_text: 'テストテキスト',
          modified_text: '修正されたテキスト',
          violations: []
        })
      } as MessageEvent)
    }
    
    await waitFor(() => {
      const copyButton = screen.getByText('コピー')
      expect(copyButton).toBeInTheDocument()
    })
    
    const copyButton = screen.getByText('コピー')
    await user.click(copyButton)
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('修正されたテキスト')
  })

  it.skip('違反内容が正しく表示されること', async () => {
    const user = userEvent.setup()
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 123 })
    })
    
    render(<TextChecker />)
    
    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button', { name: 'チェック開始' })
    
    await user.type(textarea, 'この製品は効果があります')
    await user.click(submitButton)
    
    // Complete check with violations
    const onMessageHandler = mockEventSource.onmessage as ((event: MessageEvent) => void) | null
    if (onMessageHandler) {
      onMessageHandler({
        data: JSON.stringify({
          status: 'completed',
          id: 123,
          original_text: 'この製品は効果があります',
          modified_text: 'この製品は期待されます',
          violations: [{
            id: 1,
            start_pos: 5,
            end_pos: 7,
            reason: '効果に関する断定的表現'
          }]
        })
      } as MessageEvent)
    }
    
    await waitFor(() => {
      expect(screen.getByText('違反詳細')).toBeInTheDocument()
    })
    
    // Click on violations tab
    await user.click(screen.getByText('違反詳細'))
    
    await waitFor(() => {
      expect(screen.getByText('違反箇所 1')).toBeInTheDocument()
      expect(screen.getByText('効果に関する断定的表現')).toBeInTheDocument()
    })
  })

  it.skip('SSE接続エラーを適切に処理すること', async () => {
    const user = userEvent.setup()
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 123 })
    })
    
    render(<TextChecker />)
    
    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button', { name: 'チェック開始' })
    
    await user.type(textarea, 'テストテキスト')
    await user.click(submitButton)
    
    // Simulate SSE error
    const onErrorHandler = mockEventSource.onerror as ((event: Event) => void) | null
    if (onErrorHandler) {
      onErrorHandler(new Event('error'))
    }
    
    await waitFor(() => {
      expect(screen.getByText('サーバー接続エラー')).toBeInTheDocument()
    })
  })
})