import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import AdminDashboard from '../page'

// AuthContextをモック
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}))

// DashboardStatsコンポーネントをモック
vi.mock('@/components/admin/DashboardStats', () => ({
  DashboardStats: vi.fn(() => <div data-testid="dashboard-stats">Dashboard Stats Mock</div>)
}))

// Next.jsのLinkをモック
vi.mock('next/link', () => ({
  default: vi.fn(({ children, href, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ))
}))

const { useAuth } = await import('@/contexts/AuthContext')
const mockUseAuth = vi.mocked(useAuth)

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('認証中はローディング表示する', () => {
    mockUseAuth.mockReturnValue({
      userProfile: null,
      loading: true,
      organization: null,
      refresh: vi.fn()
    })

    render(<AdminDashboard />)
    
    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  it('未認証ユーザーにはアクセス拒否メッセージを表示する', () => {
    mockUseAuth.mockReturnValue({
      userProfile: null,
      loading: false,
      organization: null,
      refresh: vi.fn()
    })

    render(<AdminDashboard />)
    
    expect(screen.getByText('アクセスが拒否されました')).toBeInTheDocument()
    expect(screen.getByText('このページにアクセスするには管理者権限が必要です。')).toBeInTheDocument()
  })

  it('非管理者ユーザーにはアクセス拒否メッセージを表示する', () => {
    mockUseAuth.mockReturnValue({
      userProfile: {
        id: 'user-1',
        display_name: 'Test User',
        email: 'test@example.com',
        role: 'user'
      },
      loading: false,
      organization: null,
      refresh: vi.fn()
    })

    render(<AdminDashboard />)
    
    expect(screen.getByText('アクセスが拒否されました')).toBeInTheDocument()
    expect(screen.getByText('このページにアクセスするには管理者権限が必要です。')).toBeInTheDocument()
  })

  it('管理者ユーザーには管理ダッシュボードを表示する', () => {
    mockUseAuth.mockReturnValue({
      userProfile: {
        id: 'admin-1',
        display_name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin'
      },
      loading: false,
      organization: null,
      refresh: vi.fn()
    })

    render(<AdminDashboard />)
    
    // ページタイトル
    expect(screen.getByText('管理ダッシュボード')).toBeInTheDocument()
    expect(screen.getByText('システム全体の統計情報と管理機能')).toBeInTheDocument()
    
    // ナビゲーションボタン
    expect(screen.getByText('ユーザー管理')).toBeInTheDocument()
    expect(screen.getByText('組織設定')).toBeInTheDocument()
    expect(screen.getByText('システム設定')).toBeInTheDocument()
    expect(screen.getByText('分析レポート')).toBeInTheDocument()
    expect(screen.getByText('サポート')).toBeInTheDocument()
    
    // DashboardStatsコンポーネント
    expect(screen.getByTestId('dashboard-stats')).toBeInTheDocument()
  })

  it('ナビゲーションリンクが正しく設定されている', () => {
    mockUseAuth.mockReturnValue({
      userProfile: {
        id: 'admin-1',
        display_name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin'
      },
      loading: false,
      organization: null,
      refresh: vi.fn()
    })

    render(<AdminDashboard />)
    
    // 各ナビゲーションリンクのhref属性を確認
    expect(screen.getByText('ユーザー管理').closest('a')).toHaveAttribute('href', '/admin/users')
    expect(screen.getByText('組織設定').closest('a')).toHaveAttribute('href', '/admin/settings')
    expect(screen.getByText('システム設定').closest('a')).toHaveAttribute('href', '/admin/system-settings')
    expect(screen.getByText('分析レポート').closest('a')).toHaveAttribute('href', '/admin/analytics')
    expect(screen.getByText('サポート').closest('a')).toHaveAttribute('href', '/admin/support')
  })

  it('開発環境ではデバッグ情報を表示する', () => {
    // NODE_ENVを開発環境に設定
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    mockUseAuth.mockReturnValue({
      userProfile: {
        id: 'user-1',
        display_name: 'Test User',
        email: 'test@example.com',
        role: 'user'
      },
      loading: false,
      organization: null,
      refresh: vi.fn()
    })

    render(<AdminDashboard />)
    
    // デバッグ情報の存在を確認（具体的な内容は環境によって異なる）
    const debugElement = screen.getByText(/Debug:/)
    expect(debugElement).toBeInTheDocument()

    // 環境変数を元に戻す
    process.env.NODE_ENV = originalEnv
  })

  it('本番環境ではデバッグ情報を表示しない', () => {
    // NODE_ENVを本番環境に設定
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    mockUseAuth.mockReturnValue({
      userProfile: {
        id: 'user-1',
        display_name: 'Test User',
        email: 'test@example.com',
        role: 'user'
      },
      loading: false,
      organization: null,
      refresh: vi.fn()
    })

    render(<AdminDashboard />)
    
    // デバッグ情報が存在しないことを確認
    expect(screen.queryByText(/Debug:/)).not.toBeInTheDocument()

    // 環境変数を元に戻す
    process.env.NODE_ENV = originalEnv
  })
})