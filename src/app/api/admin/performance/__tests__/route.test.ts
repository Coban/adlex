import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockRepositories } from '@/test/mocks/repositories'
import { GET } from '../route'

// Mock the repository provider
vi.mock('@/lib/repositories', () => ({
  getRepositories: vi.fn(),
}))

// Mock Supabase auth
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn()
    }
  }))
}))

import { getRepositories } from '@/lib/repositories'
import { createClient } from '@/lib/supabase/server'

describe('/api/admin/performance', () => {
  let mockRepositories: ReturnType<typeof createMockRepositories>

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create fresh repository mocks for each test
    mockRepositories = createMockRepositories()
    
    // Setup default Supabase client mock
    const mockSupabaseClient = {
      auth: {
        getUser: vi.fn()
      }
    }
    
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient)
    vi.mocked(getRepositories).mockResolvedValue(mockRepositories)
  })

  it('未認証ユーザーには401エラーを返す', async () => {
    const mockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('Unauthorized')
        })
      }
    }
    
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient)

    const response = await GET()
    const responseData = await response.json()

    expect(response.status).toBe(401)
    expect(responseData.error).toBe('Unauthorized')
  })

  it('非管理者ユーザーには403エラーを返す', async () => {
    const mockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null
        })
      }
    }
    
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient)
    mockRepositories.users.isAdmin.mockResolvedValue(false)

    const response = await GET()
    const responseData = await response.json()

    expect(response.status).toBe(403)
    expect(responseData.error).toBe('Forbidden')
  })

  it('管理者ユーザーにはパフォーマンスデータを返す', async () => {
    const mockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'admin-1' } },
          error: null
        })
      }
    }
    
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient)
    mockRepositories.users.isAdmin.mockResolvedValue(true)
    
    // Mock performance metrics
    const mockPerformanceMetrics = {
      avgProcessingTime: 5.67,
      maxProcessingTime: 10.0,
      minProcessingTime: 2.0,
      totalChecks24h: 100,
      successRate: 95.5,
      errorRate: 4.5,
      statusBreakdown: {
        completed: 95,
        error: 4,
        processing: 1
      },
      hourlyActivity: Array.from({ length: 24 }, (_, i) => ({
        hour: `${i}:00`,
        count: Math.floor(Math.random() * 10)
      }))
    }
    
    mockRepositories.checks.getPerformanceMetrics = vi.fn().mockResolvedValue(mockPerformanceMetrics)

    const response = await GET()
    const responseData = await response.json()

    expect(response.status).toBe(200)
    expect(responseData).toEqual({
      performance: {
        avgProcessingTime: '5.67',
        maxProcessingTime: '10.00',
        minProcessingTime: '2.00',
        totalChecks24h: 100,
        successRate: '95.50',
        errorRate: '4.50'
      },
      statusBreakdown: mockPerformanceMetrics.statusBreakdown,
      hourlyActivity: mockPerformanceMetrics.hourlyActivity,
      systemHealth: {
        status: 'healthy', // errorRate < 5
        uptime: '99.9%',
        lastIncident: null
      }
    })
  })

  it('リポジトリエラー時には500エラーを返す', async () => {
    const mockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'admin-1' } },
          error: null
        })
      }
    }
    
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient)
    mockRepositories.users.isAdmin.mockResolvedValue(true)
    
    // Mock repository error
    mockRepositories.checks.getPerformanceMetrics = vi.fn().mockRejectedValue(new Error('Database connection error'))

    const response = await GET()
    const responseData = await response.json()

    expect(response.status).toBe(500)
    expect(responseData.error).toBe('Internal server error')
  })

  it('システムヘルスステータスを正しく判定する', async () => {
    const mockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'admin-1' } },
          error: null
        })
      }
    }
    
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient)
    mockRepositories.users.isAdmin.mockResolvedValue(true)
    
    // Test critical status (errorRate >= 10)
    const mockCriticalMetrics = {
      avgProcessingTime: 5.0,
      maxProcessingTime: 10.0,
      minProcessingTime: 2.0,
      totalChecks24h: 100,
      successRate: 85.0,
      errorRate: 15.0, // Critical
      statusBreakdown: {},
      hourlyActivity: []
    }
    
    mockRepositories.checks.getPerformanceMetrics = vi.fn().mockResolvedValue(mockCriticalMetrics)

    const response = await GET()
    const responseData = await response.json()

    expect(responseData.systemHealth.status).toBe('critical')
  })
})