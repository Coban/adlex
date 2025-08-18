import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import TextChecker from '../TextChecker'

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-1', email: 'test@example.com' }
  }))
}))

// Mock Supabase client
const mockSupabase = {
  auth: {
    getSession: vi.fn(async () => ({ data: { session: { access_token: 't' } as { access_token: string } }, error: null }))
  },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabase)
}))

// Mock EventSource
class MockEventSource {
  url: string
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  constructor(url: string) { this.url = url }
  close() { /* noop */ }
}

// Attach static constants
Object.assign(MockEventSource, {
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2
})

describe('TextChecker (stream + polling)', () => {
  const originalFetch = global.fetch
  const OriginalEventSource = global.EventSource

  beforeEach(() => {
    vi.clearAllMocks()
    global.EventSource = MockEventSource as unknown as typeof EventSource
  })

  afterEach(() => {
    global.fetch = originalFetch as typeof fetch
    global.EventSource = OriginalEventSource as typeof EventSource
  })

  it('チェックを開始し、完了までの基本フローが動作する', async () => {
    // POST /api/checks → { id }
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 101 }) }) as typeof fetch

    // Supabase polling: checks -> completed, then violations -> []
    const checksSingle = vi.fn()
      .mockResolvedValueOnce({ data: { id: 101, status: 'completed', original_text: '入力', modified_text: '修正' }, error: null })
    const violationsSelect = vi.fn().mockResolvedValue({ data: [], error: null })

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'checks') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: checksSingle })) })) }
      }
      if (table === 'violations') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => violationsSelect) })) }
      }
      return {}
    })

    render(<TextChecker />)

    // 入力とボタン有効化
    const textarea = screen.getByTestId('text-input') as HTMLTextAreaElement
    await userEvent.type(textarea, '入力')
    const button = screen.getByTestId('check-button')
    expect(button).not.toBeDisabled()

    // クリックで開始
    await userEvent.click(button)

    // 完了表示まで待つ
    await waitFor(() => {
      expect(screen.getAllByTestId('status-message')[0].textContent ?? '').toContain('チェック完了')
    })
  })

  it('未認証時はエラーを表示する（セッションなし）', async () => {
    mockSupabase.auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null } as any)
    render(<TextChecker />)
    const textarea = screen.getByTestId('text-input') as HTMLTextAreaElement
    await userEvent.type(textarea, 'テキスト')
    await userEvent.click(screen.getByTestId('check-button'))

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument()
    })
  })
})

