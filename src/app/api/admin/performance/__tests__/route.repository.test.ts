import { describe, it, expect, vi, beforeEach } from 'vitest'

import { GET } from '../route'
import { createMockRepositories } from '@/test/mocks/repositories'

// Mock the repository provider
vi.mock('@/lib/repositories', () => ({
  getRepositories: vi.fn(),
}))

// Mock Supabase auth
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({
    auth: {
      getUser: vi.fn()
    }
  }))
}))

vi.mock('next/server', async (importOriginal) => {
  const actual: typeof import('next/server') = await importOriginal()
  return {
    ...actual,
    NextResponse: {
      json: vi.fn((data, init) => ({
        json: () => Promise.resolve(data),
        status: init?.status || 200,
        ok: (init?.status || 200) < 400
      }))
    }
  }
})

import { getRepositories } from '@/lib/repositories'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

describe('/api/admin/performance with Repository Pattern', () => {
  let mockRepositories: ReturnType<typeof createMockRepositories>
  let mockSupabaseClient: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create fresh repository mocks for each test
    mockRepositories = createMockRepositories()
    
    // Setup default Supabase client mock
    mockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'admin-123',
              email: 'admin@example.com'
            }
          },
          error: null
        })
      }
    }
    
    // Setup mocks to return our instances
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient)
    vi.mocked(getRepositories).mockResolvedValue(mockRepositories)
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
    // Setup non-admin user
    mockRepositories.users.isAdmin = vi.fn().mockResolvedValue(false)

    await GET()

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: 'Forbidden' },
      { status: 403 }
    )
    expect(mockRepositories.users.isAdmin).toHaveBeenCalledWith('admin-123')
  })

  it('管理者ユーザーにはパフォーマンスデータを返す', async () => {
    // Setup admin user
    mockRepositories.users.isAdmin = vi.fn().mockResolvedValue(true)
    
    // Setup performance metrics
    mockRepositories.checks.getPerformanceMetrics = vi.fn().mockResolvedValue({
      avgProcessingTime: 5.67,
      maxProcessingTime: 10,
      minProcessingTime: 2,
      totalChecks24h: 4,
      successRate: 75,
      errorRate: 25,
      statusBreakdown: {
        completed: 3,
        failed: 1,
        processing: 0,
        pending: 0
      },
      hourlyActivity: Array.from({ length: 24 }, (_, i) => ({
        hour: String(i).padStart(2, '0'),
        count: i === 10 ? 2 : i === 14 ? 2 : 0
      }))
    })

    await GET()

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        performance: expect.objectContaining({
          avgProcessingTime: '5.67',
          maxProcessingTime: '10.00',
          minProcessingTime: '2.00',
          totalChecks24h: 4,
          successRate: '75.00',
          errorRate: '25.00'
        }),
        statusBreakdown: expect.objectContaining({
          completed: 3,
          failed: 1,
          processing: 0,
          pending: 0
        }),
        hourlyActivity: expect.any(Array),
        systemHealth: expect.objectContaining({
          status: 'critical', // 25% error rate > 10%
          uptime: '99.9%',
          lastIncident: null
        })
      })
    )
    
    expect(mockRepositories.checks.getPerformanceMetrics).toHaveBeenCalled()
  })

  it('低エラー率では健全なシステムヘルスを返す', async () => {
    // Setup admin user
    mockRepositories.users.isAdmin = vi.fn().mockResolvedValue(true)
    
    // Setup metrics with low error rate
    mockRepositories.checks.getPerformanceMetrics = vi.fn().mockResolvedValue({
      avgProcessingTime: 3,
      maxProcessingTime: 5,
      minProcessingTime: 1,
      totalChecks24h: 100,
      successRate: 98,
      errorRate: 2,
      statusBreakdown: {
        completed: 98,
        failed: 2,
        processing: 0,
        pending: 0
      },
      hourlyActivity: []
    })

    await GET()

    const responseCall = vi.mocked(NextResponse.json).mock.calls[0]
    const responseData = responseCall[0] as any

    expect(responseData.systemHealth.status).toBe('healthy')
  })

  it('中程度のエラー率では警告状態を返す', async () => {
    // Setup admin user
    mockRepositories.users.isAdmin = vi.fn().mockResolvedValue(true)
    
    // Setup metrics with medium error rate (7%)
    mockRepositories.checks.getPerformanceMetrics = vi.fn().mockResolvedValue({
      avgProcessingTime: 4,
      maxProcessingTime: 8,
      minProcessingTime: 2,
      totalChecks24h: 100,
      successRate: 93,
      errorRate: 7,
      statusBreakdown: {
        completed: 93,
        failed: 7,
        processing: 0,
        pending: 0
      },
      hourlyActivity: []
    })

    await GET()

    const responseCall = vi.mocked(NextResponse.json).mock.calls[0]
    const responseData = responseCall[0] as any

    expect(responseData.systemHealth.status).toBe('warning')
  })

  it('空のデータでも適切にレスポンスを返す', async () => {
    // Setup admin user
    mockRepositories.users.isAdmin = vi.fn().mockResolvedValue(true)
    
    // Setup empty metrics
    mockRepositories.checks.getPerformanceMetrics = vi.fn().mockResolvedValue({
      avgProcessingTime: 0,
      maxProcessingTime: 0,
      minProcessingTime: 0,
      totalChecks24h: 0,
      successRate: 0,
      errorRate: 0,
      statusBreakdown: {},
      hourlyActivity: []
    })

    await GET()

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        performance: expect.objectContaining({
          avgProcessingTime: '0.00',
          maxProcessingTime: '0.00',
          minProcessingTime: '0.00',
          totalChecks24h: 0,
          successRate: '0.00',
          errorRate: '0.00'
        }),
        statusBreakdown: {},
        hourlyActivity: [],
        systemHealth: expect.objectContaining({
          status: 'healthy',
          uptime: '99.9%',
          lastIncident: null
        })
      })
    )
  })

  it('リポジトリエラー時には500エラーを返す', async () => {
    // Setup admin user
    mockRepositories.users.isAdmin = vi.fn().mockResolvedValue(true)
    
    // Setup repository to throw error
    mockRepositories.checks.getPerformanceMetrics = vi.fn().mockRejectedValue(
      new Error('Database connection error')
    )

    await GET()

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: 'Internal server error' },
      { status: 500 }
    )
  })

  it('時間帯別アクティビティを正しく返す', async () => {
    // Setup admin user
    mockRepositories.users.isAdmin = vi.fn().mockResolvedValue(true)
    
    // Setup metrics with hourly activity
    const hourlyActivity = Array.from({ length: 24 }, (_, i) => ({
      hour: String(i).padStart(2, '0'),
      count: i === 9 ? 5 : i === 14 ? 8 : i === 18 ? 3 : 0
    }))
    
    mockRepositories.checks.getPerformanceMetrics = vi.fn().mockResolvedValue({
      avgProcessingTime: 3.5,
      maxProcessingTime: 7,
      minProcessingTime: 1,
      totalChecks24h: 16,
      successRate: 100,
      errorRate: 0,
      statusBreakdown: {
        completed: 16,
        failed: 0,
        processing: 0,
        pending: 0
      },
      hourlyActivity
    })

    await GET()

    const responseCall = vi.mocked(NextResponse.json).mock.calls[0]
    const responseData = responseCall[0] as any

    expect(responseData.hourlyActivity).toHaveLength(24)
    expect(responseData.hourlyActivity[9]).toEqual({
      hour: '09',
      count: 5
    })
    expect(responseData.hourlyActivity[14]).toEqual({
      hour: '14',
      count: 8
    })
    expect(responseData.hourlyActivity[18]).toEqual({
      hour: '18',
      count: 3
    })
  })

  it('処理時間の統計を正しくフォーマットする', async () => {
    // Setup admin user
    mockRepositories.users.isAdmin = vi.fn().mockResolvedValue(true)
    
    // Setup metrics with specific processing times
    mockRepositories.checks.getPerformanceMetrics = vi.fn().mockResolvedValue({
      avgProcessingTime: 5.6789,
      maxProcessingTime: 10.1234,
      minProcessingTime: 2.5678,
      totalChecks24h: 10,
      successRate: 90,
      errorRate: 10,
      statusBreakdown: {
        completed: 9,
        failed: 1
      },
      hourlyActivity: []
    })

    await GET()

    const responseCall = vi.mocked(NextResponse.json).mock.calls[0]
    const responseData = responseCall[0] as any

    // 小数点以下2桁にフォーマットされていることを確認
    expect(responseData.performance.avgProcessingTime).toBe('5.68')
    expect(responseData.performance.maxProcessingTime).toBe('10.12')
    expect(responseData.performance.minProcessingTime).toBe('2.57')
  })

  it('ステータス別の集計を正しく返す', async () => {
    // Setup admin user
    mockRepositories.users.isAdmin = vi.fn().mockResolvedValue(true)
    
    // Setup metrics with various statuses
    mockRepositories.checks.getPerformanceMetrics = vi.fn().mockResolvedValue({
      avgProcessingTime: 4,
      maxProcessingTime: 8,
      minProcessingTime: 2,
      totalChecks24h: 20,
      successRate: 60,
      errorRate: 20,
      statusBreakdown: {
        completed: 12,
        failed: 4,
        processing: 2,
        pending: 2
      },
      hourlyActivity: []
    })

    await GET()

    const responseCall = vi.mocked(NextResponse.json).mock.calls[0]
    const responseData = responseCall[0] as any

    expect(responseData.statusBreakdown).toEqual({
      completed: 12,
      failed: 4,
      processing: 2,
      pending: 2
    })
    
    // Total should be 20
    const total = Object.values(responseData.statusBreakdown as Record<string, number>)
      .reduce((sum, count) => sum + count, 0)
    expect(total).toBe(20)
  })
})