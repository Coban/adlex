import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import AdminDashboard from '@/app/admin/page'

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
      user: null,
      userProfile: null,
      loading: true,
      organization: null,
      signOut: vi.fn(),
      refresh: vi.fn()
    })

    render(<AdminDashboard />)
    
    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  it('未認証ユーザーにはアクセス拒否メッセージを表示する', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
      organization: null,
      signOut: vi.fn(),
      refresh: vi.fn()
    })

    render(<AdminDashboard />)
    
    expect(screen.getByText('アクセスが拒否されました')).toBeInTheDocument()
    expect(screen.getByText('このページにアクセスするには管理者権限が必要です。')).toBeInTheDocument()
  })

  it('非管理者ユーザーにはアクセス拒否メッセージを表示する', () => {
    mockUseAuth.mockReturnValue({
      user: { 
        id: 'user-1', 
        email: 'test@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2024-01-01T00:00:00Z'
      },
      userProfile: {
        id: 'user-1',
        email: 'test@example.com',
        role: 'user',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        organization_id: null
      },
      loading: false,
      organization: null,
      signOut: vi.fn(),
      refresh: vi.fn()
    })

    render(<AdminDashboard />)
    
    expect(screen.getByText('アクセスが拒否されました')).toBeInTheDocument()
    expect(screen.getByText('このページにアクセスするには管理者権限が必要です。')).toBeInTheDocument()
  })

  it('管理者ユーザーには管理ダッシュボードを表示する', () => {
    mockUseAuth.mockReturnValue({
      user: { 
        id: 'admin-1', 
        email: 'admin@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2024-01-01T00:00:00Z'
      },
      userProfile: {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        organization_id: null
      },
      loading: false,
      organization: null,
      signOut: vi.fn(),
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
      user: { 
        id: 'admin-1', 
        email: 'admin@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2024-01-01T00:00:00Z'
      },
      userProfile: {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        organization_id: null
      },
      loading: false,
      organization: null,
      signOut: vi.fn(),
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
    // NODE_ENVは.envファイルから読み込まれます

    mockUseAuth.mockReturnValue({
      user: { 
        id: 'user-1', 
        email: 'test@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2024-01-01T00:00:00Z'
      },
      userProfile: {
        id: 'user-1',
        email: 'test@example.com',
        role: 'user',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        organization_id: null
      },
      loading: false,
      organization: null,
      signOut: vi.fn(),
      refresh: vi.fn()
    })

    render(<AdminDashboard />)
    
    // デバッグ情報の存在を確認（具体的な内容は環境によって異なる）
    const debugElement = screen.getByText(/Debug:/)
    expect(debugElement).toBeInTheDocument()

    // .envファイルにより環境変数が設定されます
  })

  it('本番環境ではデバッグ情報を表示しない', () => {
    // .env.testでNODE_ENV=testが設定されているため、
    // vi.stubEnvを使用して本番環境をシミュレート
    vi.stubEnv('NODE_ENV', 'production')

    mockUseAuth.mockReturnValue({
      user: { 
        id: 'user-1', 
        email: 'test@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2024-01-01T00:00:00Z'
      },
      userProfile: {
        id: 'user-1',
        email: 'test@example.com',
        role: 'user',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        organization_id: null
      },
      loading: false,
      organization: null,
      signOut: vi.fn(),
      refresh: vi.fn()
    })

    render(<AdminDashboard />)
    
    // 本番環境では管理者権限のないユーザーにデバッグ情報を表示しない
    expect(screen.queryByText(/Debug:/)).not.toBeInTheDocument()

    // 環境変数モックを復元（テスト間の影響を防ぐため）
    vi.unstubAllEnvs()
  })
})