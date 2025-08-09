import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// useAuth をモック
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}))

import Home from '@/app/page'
import { useAuth } from '@/contexts/AuthContext'

describe('Home ページ', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ローディング中は「読み込み中...」が表示される', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      userProfile: null,
      organization: null,
      loading: true,
      signOut: vi.fn()
    })

    render(<Home />)
    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  it('認証済みユーザーにはようこそメッセージが表示され、管理者ボタンは表示されない', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', email: 'user@example.com' } as any,
      userProfile: { role: 'user' } as any,
      organization: null,
      loading: false,
      signOut: vi.fn()
    })

    render(<Home />)
    expect(screen.getByText('ようこそ、user@example.comさん')).toBeInTheDocument()
    expect(screen.getByText('テキストチェックを開始')).toBeInTheDocument()
    expect(screen.queryByText('組織ユーザー管理')).not.toBeInTheDocument()
    expect(screen.queryByText('管理者機能')).not.toBeInTheDocument()
  })

  it('管理者には管理者用のボタンと説明が表示される', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'a1', email: 'admin@example.com' } as any,
      userProfile: { role: 'admin' } as any,
      organization: { id: 'o1', name: 'Org' } as any,
      loading: false,
      signOut: vi.fn()
    })

    render(<Home />)
    expect(screen.getByText('ようこそ、admin@example.comさん')).toBeInTheDocument()
    expect(screen.getByText('組織ユーザー管理')).toBeInTheDocument()
    expect(screen.getByText('管理者機能')).toBeInTheDocument()
  })

  it('未認証ユーザーにはランディングのCTAとリンクが表示される', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      userProfile: null,
      organization: null,
      loading: false,
      signOut: vi.fn()
    })

    render(<Home />)
    expect(screen.getByText('AdLex - 薬機法チェック & リライト')).toBeInTheDocument()
    expect(screen.getByText('テキストチェックを開始')).toBeInTheDocument()
    expect(screen.getByText('サインイン')).toBeInTheDocument()
    expect(screen.getByText('サインアップ')).toBeInTheDocument()
    expect(screen.getByText('開発者向けデバッグ（匿名ログイン）')).toBeInTheDocument()
  })
})


