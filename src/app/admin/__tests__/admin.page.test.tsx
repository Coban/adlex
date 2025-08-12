import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}))

import AdminDashboard from '@/app/admin/page'
import { useAuth } from '@/contexts/AuthContext'

// 型定義
type UserProfile = {
  id: string
  role: 'user' | 'admin' | null
  created_at: string | null
  email: string | null
  updated_at: string | null
  organization_id: number | null
}

type Organization = {
  id: number
  name: string
  created_at: string | null
  updated_at: string | null
  max_checks: number | null
  plan: 'trial' | 'basic' | null
  trial_ends_at: string | null
  used_checks: number | null
}

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
      userProfile: { id: 'u', role: 'user', created_at: '', email: '', updated_at: null, organization_id: null } as UserProfile,
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
      organization: { id: 1, name: 'Org', created_at: '', updated_at: null, max_checks: 100, plan: 'basic', trial_ends_at: null, used_checks: 10 } as Organization,
      userProfile: { id: 'u', role: 'admin', created_at: '', email: '', updated_at: null, organization_id: 1 } as UserProfile,
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


