import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// hoisted shared mocks
const { authState, mockSupabase } = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authState: { organization: null as any, userProfile: null as any, loading: false },
  mockSupabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  } as unknown as { auth: { getUser: ReturnType<typeof vi.fn> }, from: ReturnType<typeof vi.fn> },
}))

vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}))

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}))

import Page from '../page'

describe('DictionariesPage (smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.organization = null
    authState.userProfile = null
    authState.loading = false
  })

  it('組織未設定時にプレースホルダーが表示される', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const { findByText } = render(<Page />)
    expect(await findByText('辞書管理')).toBeInTheDocument()
    expect(await findByText(/組織が設定されていません/)).toBeInTheDocument()
    const button = await screen.findByTestId('add-phrase-button')
    expect(button).toBeDisabled()
  })

  it('組織あり・空一覧で空メッセージが表示される', async () => {
    authState.organization = { id: 1 }
    authState.userProfile = { role: 'user' }
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'dictionaries') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }
      }
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }
    })
    const { findByText } = render(<Page />)
    expect(await findByText('辞書管理')).toBeInTheDocument()
    expect(await screen.findByText('辞書項目がありません')).toBeInTheDocument()
  })
})


