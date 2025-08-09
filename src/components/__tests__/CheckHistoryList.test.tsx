import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }))

// Mock fetch
const originalFetch = global.fetch

import CheckHistoryList from '../CheckHistoryList'

describe('CheckHistoryList (smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // default: empty list
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      checks: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1, hasNext: false, hasPrev: false },
      userRole: 'user',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as any
  })

  it('空一覧のプレースホルダーを表示', async () => {
    render(<CheckHistoryList />)
    expect(await screen.findByText('該当する履歴がありません。')).toBeInTheDocument()
  })

  it('検索入力とCSV出力ボタンが表示される', async () => {
    render(<CheckHistoryList />)
    expect(await screen.findByTestId('history-search')).toBeInTheDocument()
    expect(screen.getByTestId('csv-export')).toBeInTheDocument()
  })

  it('APIエラー時はエラーメッセージを表示', async () => {
    global.fetch = vi.fn(async () => new Response('oops', { status: 500 })) as any
    render(<CheckHistoryList />)
    expect(await screen.findByText('履歴の取得に失敗しました')).toBeInTheDocument()
  })

  it.skip('履歴がある場合の1件描画', async () => {})
})

afterAll(() => {
  global.fetch = originalFetch
})


