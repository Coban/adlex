import { describe, it, expect, vi, beforeEach } from 'vitest'


// Mock repositories first since this route uses repository pattern
const mockRepositories = {
  users: {
    isAdmin: vi.fn(),
    count: vi.fn()
  },
  dictionaries: {
    count: vi.fn()
  },
  organizations: {
    count: vi.fn()
  },
  violations: {
    countTotal: vi.fn()
  },
  checks: {
    getStats: vi.fn(),
    countActiveUsers: vi.fn(),
    countByDateRange: vi.fn()
  }
};

vi.mock('@/lib/repositories', () => ({
  getRepositories: vi.fn(() => mockRepositories)
}))

// Mock Supabase client
const mockSupabaseClient = {
  auth: { getUser: vi.fn() }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}))

// Static mock for NextResponse to avoid hoisting issues
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, init) => ({
      json: () => Promise.resolve(data),
      status: init?.status || 200,
      ok: (init?.status || 200) < 400
    }))
  }
}))

import { GET } from '../route'
import { NextResponse } from 'next/server'

describe('/api/admin/stats', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
  })

  it('未認証ユーザーには401エラーを返す', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Unauthorized')
    })

    await GET()

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  })

  it('非管理者ユーザーには403エラーを返す', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null
    })

    mockRepositories.users.isAdmin.mockResolvedValue(false)

    await GET()

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: 'Forbidden' },
      { status: 403 }
    )
  })

  it('管理者ユーザーには統計データを返す', async () => {
    // 認証とロールチェックのモック
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null
    })

    // Repository pattern mocks
    mockRepositories.users.isAdmin.mockResolvedValue(true)
    mockRepositories.users.count.mockResolvedValue(10)
    mockRepositories.dictionaries.count.mockResolvedValue(5)
    mockRepositories.organizations.count.mockResolvedValue(2)
    mockRepositories.violations.countTotal.mockResolvedValue(15)
    mockRepositories.checks.getStats.mockResolvedValue({
      totalChecks: 100,
      checksThisMonth: 25,
      errorRate: 0.05,
      recentChecks: [
        {
          id: 'check1',
          original_text: 'Sample text for testing purposes',
          status: 'completed',
          created_at: '2024-01-01T00:00:00Z',
          users: { email: 'user@test.com' }
        }
      ]
    })
    mockRepositories.checks.countActiveUsers.mockResolvedValue(8)
    mockRepositories.checks.countByDateRange.mockResolvedValue(35)

    await GET()

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        stats: expect.any(Object),
        recentActivity: expect.any(Array),
        dailyChecks: expect.any(Array)
      })
    )
  }, 10000)

  it('データベースエラー時には500エラーを返す', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null
    })

    // Mock repository to pass admin check but fail during stats collection
    mockRepositories.users.isAdmin.mockResolvedValue(true)
    mockRepositories.users.count.mockRejectedValue(new Error('Database connection error'))

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('Internal server error') // Match the actual catch block error message
  })

  it('空のデータベースでも適切にレスポンスを返す', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null
    })

    // Repository pattern mocks for empty database
    mockRepositories.users.isAdmin.mockResolvedValue(true)
    mockRepositories.users.count.mockResolvedValue(0)
    mockRepositories.dictionaries.count.mockResolvedValue(0)
    mockRepositories.organizations.count.mockResolvedValue(0)
    mockRepositories.violations.countTotal.mockResolvedValue(0)
    mockRepositories.checks.getStats.mockResolvedValue({
      totalChecks: 0,
      checksThisMonth: 0,
      errorRate: 0,
      recentChecks: []
    })
    mockRepositories.checks.countActiveUsers.mockResolvedValue(0)
    mockRepositories.checks.countByDateRange.mockResolvedValue(0)

    await GET()

    const responseCall = NextResponse.json.mock.calls[0]
    expect(responseCall[0]).toMatchObject({
      stats: expect.objectContaining({
        totalUsers: 0,
        totalChecks: 0,
        totalDictionaries: 0,
        totalOrganizations: 0,
        activeUsers: 0,
        checksThisMonth: 0,
        totalViolations: 0,
        errorRate: expect.any(String)
      }),
      recentActivity: [],
      dailyChecks: expect.any(Array)
    })
  })

  it('日別チェックデータが正しく生成される', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null
    })

    // Repository pattern mocks
    mockRepositories.users.isAdmin.mockResolvedValue(true)
    mockRepositories.users.count.mockResolvedValue(10)
    mockRepositories.dictionaries.count.mockResolvedValue(5)
    mockRepositories.organizations.count.mockResolvedValue(2)
    mockRepositories.violations.countTotal.mockResolvedValue(15)
    mockRepositories.checks.getStats.mockResolvedValue({
      totalChecks: 100,
      checksThisMonth: 25,
      errorRate: 0.05,
      recentChecks: [
        {
          id: 'check1',
          original_text: 'Sample text for testing',
          status: 'completed',
          created_at: '2024-01-20T10:00:00Z',
          users: { email: 'user@test.com' }
        }
      ]
    })
    mockRepositories.checks.countActiveUsers.mockResolvedValue(8)
    // Mock daily checks count for the last 7 days
    mockRepositories.checks.countByDateRange.mockResolvedValue(21)

    await GET()

    const responseData = await NextResponse.json.mock.results[0].value.json()
    expect(responseData.dailyChecks).toHaveLength(7) // 過去7日間
    expect(responseData.dailyChecks[0]).toHaveProperty('date')
    expect(responseData.dailyChecks[0]).toHaveProperty('count')
  })
})