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
    vi.mocked(useAuth).mockReturnValue({
      organization: null,
      userProfile: null,
      loading: true,
      signOut: vi.fn()
    } as any)

    render(<AdminDashboard />)
    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  it('管理者以外はアクセス拒否が表示される', () => {
    vi.mocked(useAuth).mockReturnValue({
      organization: null,
      userProfile: { role: 'user' },
      loading: false,
      signOut: vi.fn()
    } as any)

    render(<AdminDashboard />)
    expect(screen.getByText('アクセスが拒否されました')).toBeInTheDocument()
  })

  it('管理者はダッシュボードと統計カードが表示される', () => {
    vi.mocked(useAuth).mockReturnValue({
      organization: { id: 'o1', name: 'Org' },
      userProfile: { role: 'admin' },
      loading: false,
      signOut: vi.fn()
    } as any)

    render(<AdminDashboard />)
    expect(screen.getByText('管理ダッシュボード')).toBeInTheDocument()
    expect(screen.getByTestId('stats-cards')).toBeInTheDocument()
    expect(screen.getByTestId('total-users')).toBeInTheDocument()
    expect(screen.getByTestId('total-checks')).toBeInTheDocument()
    expect(screen.getByTestId('active-users')).toBeInTheDocument()
  })
})


