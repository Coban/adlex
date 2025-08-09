import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock next/link to a simple anchor for testing
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
     
    <a href={typeof href === 'string' ? href : '#'} {...props}>{children}</a>
  )
}))

// Mock toast to avoid side effects
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn()
}))

import CheckHistoryDetail from '../CheckHistoryDetail'

describe('CheckHistoryDetail', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch as any
  })

  it.skip('正常系: チェック詳細を取得して表示する（違反のハイライト含む）', async () => {
    const mockCheck = {
      id: 123,
      originalText: 'この製品は効果があります',
      modifiedText: 'この製品は期待されます',
      status: 'completed',
      createdAt: '2024-01-01T10:00:00Z',
      completedAt: '2024-01-01T10:10:00Z',
      userEmail: 'user@example.com',
      violations: [
        { id: 1, startPos: 4, endPos: 6, reason: '「効果」→「期待」 として表現する' }
      ]
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ check: mockCheck })
    }) as any

    const { container } = render(<CheckHistoryDetail checkId={123} />)

    // ローディングの後、ヘッダーと本文が表示される
    expect(await screen.findByText('チェック詳細 #123')).toBeInTheDocument()
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument()

    // 原文に違反ハイライトのspanが埋め込まれていること
    await waitFor(() => {
      expect(container.querySelectorAll('span.bg-red-100').length).toBeGreaterThan(0)
    })

    // トグルで違反の表示/非表示を切り替えられること
    const toggleBtn = screen.getByRole('button', { name: /違反を非表示|違反を表示/ })
    await userEvent.click(toggleBtn)
    // 非表示時はハイライトがなくなる
    await waitFor(() => {
      expect(container.querySelectorAll('span.bg-red-100').length).toBe(0)
    })
  })

  it('エラー系: 404 をユーザー向けメッセージに変換して表示', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as any

    render(<CheckHistoryDetail checkId={999} />)

    expect(await screen.findByText('指定されたチェック履歴が見つかりません')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '履歴一覧に戻る' })).toBeInTheDocument()
  })

  it.skip('コピー操作: 原文のコピーがclipboardに伝播する', async () => {
    const mockCheck = {
      id: 55,
      originalText: 'コピー対象のテキスト',
      modifiedText: null,
      status: 'completed',
      createdAt: '2024-01-01T10:00:00Z',
      completedAt: null,
      violations: []
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ check: mockCheck })
    }) as any

    const spy = vi.spyOn(navigator.clipboard, 'writeText')

    render(<CheckHistoryDetail checkId={55} />)
    // 原文カードのコピーアイコンをクリック
    const copyButtons = await screen.findAllByRole('button')
    // 最初のコピーアイコンをクリック（原文側）
    const copyBtn = copyButtons.find(b => b.querySelector('svg')) as HTMLButtonElement
    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith('コピー対象のテキスト')
    })
  })
})

