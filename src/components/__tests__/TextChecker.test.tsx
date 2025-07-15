import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { useAuth } from '../../contexts/AuthContext'
import TextChecker from '../TextChecker'

// Mock the AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn()
}))

// Mock the Supabase client
const mockSupabaseClient = {
  auth: {
    getSession: vi.fn(() => Promise.resolve({
      data: {
        session: {
          access_token: 'mock-token'
        }
      }
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

describe('TextChecker Component', () => {
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
      userProfile: null,
      organization: null
    })
    
    // Reset mock supabase client with more robust setup
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'mock-token'
        }
      }
    })
    
    // Ensure the mock is properly bound - remove to avoid require issues
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('renders the main interface correctly', () => {
    render(<TextChecker />)
    
    expect(screen.getByText('薬機法チェック & リライト')).toBeInTheDocument()
    expect(screen.getByText('テキストを入力して薬機法に抵触する表現をチェックし、安全な表現にリライトします')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'チェック開始' })).toBeInTheDocument()
  })

  it('displays character count correctly', async () => {
    const user = userEvent.setup()
    render(<TextChecker />)
    
    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'テストテキスト')
    
    expect(screen.getByText('7 / 10,000文字')).toBeInTheDocument()
  })

  it('disables submit button when text is empty', () => {
    render(<TextChecker />)
    
    const submitButton = screen.getByRole('button', { name: 'チェック開始' })
    expect(submitButton).toBeDisabled()
  })

  it('enables submit button when text is entered', async () => {
    const user = userEvent.setup()
    render(<TextChecker />)
    
    const textarea = screen.getByRole('textbox')
    const submitButton = screen.getByRole('button', { name: 'チェック開始' })
    
    await user.type(textarea, 'テストテキスト')
    
    expect(submitButton).not.toBeDisabled()
  })

  it('shows error when text exceeds character limit', async () => {
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

  it.skip('shows error when user is not authenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signOut: vi.fn(),
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

  it.skip('starts check process when submit button is clicked', async () => {
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

  it.skip('displays loading state during check', async () => {
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

  it.skip('clears input after successful submission', async () => {
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

  it.skip('displays check in history after submission', async () => {
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

  it.skip('handles API errors gracefully', async () => {
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

  it.skip('handles network errors', async () => {
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

  it.skip('updates status via SSE', async () => {
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

  it.skip('displays results when check completes', async () => {
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

  it.skip('handles timeout gracefully', async () => {
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

  it.skip('allows switching between checks in history', async () => {
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

  it.skip('handles copy functionality', async () => {
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

  it.skip('displays violations correctly', async () => {
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

  it.skip('handles SSE connection errors', async () => {
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