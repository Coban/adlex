import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}))

import AdminDashboard from '@/app/admin/page'
import { useAuth } from '@/contexts/AuthContext'

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ローディング中は「読み込み中...」を表示', () => {
    const value: ReturnType<typeof useAuth> = {
      user: null,
      organization: null,
      userProfile: null,
      loading: true,
      signOut: async () => {}
    }
    vi.mocked(useAuth).mockReturnValue(value)

    render(<AdminDashboard />)
    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  it('管理者以外はアクセス拒否が表示される', () => {
    const value: ReturnType<typeof useAuth> = {
      user: null,
      organization: null,
      userProfile: { id: 'u', role: 'user', created_at: '', email: '', updated_at: null, organization_id: null } as any,
      loading: false,
      signOut: async () => {}
    }
    vi.mocked(useAuth).mockReturnValue(value)

    render(<AdminDashboard />)
    expect(screen.getByText('アクセスが拒否されました')).toBeInTheDocument()
  })

  it('管理者はダッシュボードと統計カードが表示される', () => {
    const value: ReturnType<typeof useAuth> = {
      user: null,
      organization: { id: 'o1', name: 'Org', created_at: '', updated_at: null } as any,
      userProfile: { id: 'u', role: 'admin', created_at: '', email: '', updated_at: null, organization_id: 'o1' } as any,
      loading: false,
      signOut: async () => {}
    }
    vi.mocked(useAuth).mockReturnValue(value)

    render(<AdminDashboard />)
    expect(screen.getByText('管理ダッシュボード')).toBeInTheDocument()
    expect(screen.getByTestId('stats-cards')).toBeInTheDocument()
    expect(screen.getByTestId('total-users')).toBeInTheDocument()
    expect(screen.getByTestId('total-checks')).toBeInTheDocument()
    expect(screen.getByTestId('active-users')).toBeInTheDocument()
  })
})


