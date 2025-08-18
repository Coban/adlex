import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}))

// MSWサーバーのセットアップ
const server = setupServer(
  http.get('/api/admin/stats', () => {
    return HttpResponse.json({
      stats: {
        totalUsers: 100,
        totalChecks: 5000,
        totalDictionaries: 250,
        totalOrganizations: 20,
        activeUsers: 75,
        checksThisMonth: 800,
        totalViolations: 1200,
        errorRate: '2.5'
      },
      recentActivity: [],
      dailyChecks: []
    })
  }),
  http.get('/api/admin/performance', () => {
    return HttpResponse.json({
      performance: {
        avgProcessingTime: '3.2',
        maxProcessingTime: '8.5',
        minProcessingTime: '1.1',
        totalChecks24h: 245,
        successRate: '97.8',
        errorRate: '2.2'
      },
      statusBreakdown: {
        completed: 240,
        processing: 3,
        failed: 2
      },
      hourlyActivity: [],
      systemHealth: {
        status: 'healthy',
        uptime: '99.9%',
        lastIncident: null
      }
    })
  })
)

// MSWのライフサイクル管理
beforeEach(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

import AdminDashboard from '@/app/admin/page'
import { useAuth } from '@/contexts/AuthContext'
import { UserProfile, Organization } from '@/types/auth'

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
      signOut: async () => {},
      refresh: async () => {}
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
      signOut: async () => {},
      refresh: async () => {}
    }
    vi.mocked(useAuth).mockReturnValue(value)

    render(<AdminDashboard />)
    expect(screen.getByText('アクセスが拒否されました')).toBeInTheDocument()
  })

  it('管理者はダッシュボードと統計カードが表示される', async () => {
    const value: ReturnType<typeof useAuth> = {
      user: null,
      organization: { id: 1, name: 'Org', created_at: '', updated_at: null, max_checks: 100, plan: 'basic', trial_ends_at: null, used_checks: 10, icon_url: null, logo_url: null } as Organization,
      userProfile: { id: 'u', role: 'admin', created_at: '', email: '', updated_at: null, organization_id: 1 } as UserProfile,
      loading: false,
      signOut: async () => {},
      refresh: async () => {}
    }
    vi.mocked(useAuth).mockReturnValue(value)

    render(<AdminDashboard />)
    expect(screen.getByText('管理ダッシュボード')).toBeInTheDocument()
    
    // データ読み込み完了を待つ
    await waitFor(() => {
      expect(screen.getByTestId('stats-cards')).toBeInTheDocument()
    })
    
    expect(screen.getByTestId('total-users')).toBeInTheDocument()
    expect(screen.getByTestId('total-checks')).toBeInTheDocument()
    expect(screen.getByTestId('active-users')).toBeInTheDocument()
  })
})


