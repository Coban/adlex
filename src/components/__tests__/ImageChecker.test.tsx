import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u' } }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({ auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } })),
}))

// Mock fetch for upload and checks (we won't reach network in simple tests)
// const _globalFetch = vi.spyOn(globalThis, 'fetch')

import ImageChecker from '../ImageChecker'

describe('ImageChecker (smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('初期文言とドロップゾーンが表示される', () => {
    render(<ImageChecker />)
    expect(screen.getByText('画像から薬機法チェック')).toBeInTheDocument()
    expect(screen.getByTestId('dropzone')).toBeInTheDocument()
  })

  it('不正なファイル形式だとエラーを表示（バリデーションのみ）', () => {
    const { container } = render(<ImageChecker />)
    const input = container.querySelector('#file-input') as HTMLInputElement
    const file = new File([new Uint8Array([1,2,3])], 'x.gif', { type: 'image/gif' })
    // jsdom では DataTransfer が未定義のため、直接 files 相当を渡す
    fireEvent.change(input, { target: { files: [file] } as never })
    expect(screen.getByText(/対応していないファイル形式/)).toBeInTheDocument()
  })

  it.skip('正常系（アップロード→チェック開始→SSE）', () => {})
})


