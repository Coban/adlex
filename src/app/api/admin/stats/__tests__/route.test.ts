import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { GET } from '../route'

// モック用の変数をvi.mock外で定義
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn()
    },
    from: vi.fn()
  }))
}))

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal()
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

// テスト内で使用するモックインスタンス
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn()
  },
  from: vi.fn()
}

const mockNextResponse = {
  json: vi.fn((data, init) => ({
    json: () => Promise.resolve(data),
    status: init?.status || 200,
    ok: (init?.status || 200) < 400
  }))
}

describe('/api/admin/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // モックをリセット
    const { createClient } = vi.mocked(require('@/lib/supabase/server'))
    createClient.mockReturnValue(mockSupabaseClient as any)
    
    const { NextResponse } = vi.mocked(require('next/server'))
    NextResponse.json.mockImplementation(mockNextResponse.json)
  })

  it('未認証ユーザーには401エラーを返す', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Unauthorized')
    })

    const request = new NextRequest('http://localhost/api/admin/stats')
    const response = await GET()

    expect(mockNextResponse.json).toHaveBeenCalledWith(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  })

  it('非管理者ユーザーには403エラーを返す', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null
    })

    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({
      data: { role: 'user' },
      error: null
    })

    mockSupabaseClient.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle
    })

    mockSelect.mockImplementation((fields) => {
      if (fields === 'role') {
        return { eq: mockEq, single: mockSingle }
      }
      return { eq: mockEq, single: mockSingle }
    })

    const request = new NextRequest('http://localhost/api/admin/stats')
    const response = await GET()

    expect(mockNextResponse.json).toHaveBeenCalledWith(
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

    // ユーザーロール取得のモック
    const mockUserQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { role: 'admin' },
        error: null
      })
    }

    // カウントクエリのモック
    const mockCountQuery = {
      select: vi.fn().mockReturnThis(),
      count: 100,
      error: null
    }

    // データクエリのモック
    const mockDataQuery = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      data: [
        {
          id: '1',
          status: 'completed',
          created_at: '2024-01-20T10:00:00Z',
          users: {
            display_name: 'Test User',
            email: 'test@example.com'
          }
        }
      ],
      error: null
    }

    // Promise.allで呼び出される各クエリの結果をモック
    mockSupabaseClient.from.mockImplementation((table) => {
      switch (table) {
        case 'users':
          if (mockUserQuery.select.mock.calls.some(call => call[0] === 'role')) {
            return mockUserQuery
          }
          return {
            select: vi.fn(() => mockCountQuery),
            count: 100
          }
        case 'checks':
          return {
            select: vi.fn().mockImplementation((fields) => {
              if (fields === 'id') {
                return mockCountQuery
              }
              if (fields === 'user_id') {
                return {
                  gte: vi.fn(() => mockCountQuery),
                  count: 75
                }
              }
              if (fields === 'status') {
                return {
                  gte: vi.fn(() => ({
                    data: [{ status: 'completed' }, { status: 'completed' }, { status: 'failed' }],
                    error: null
                  }))
                }
              }
              if (fields === 'created_at') {
                return {
                  gte: vi.fn().mockReturnThis(),
                  order: vi.fn(() => ({
                    data: [
                      { created_at: '2024-01-20T10:00:00Z' },
                      { created_at: '2024-01-19T15:00:00Z' }
                    ],
                    error: null
                  }))
                }
              }
              // 複雑なセレクト（最近のチェック用）
              return {
                order: vi.fn().mockReturnThis(),
                limit: vi.fn(() => mockDataQuery)
              }
            }),
            gte: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            count: 1000
          }
        case 'dictionaries':
          return {
            select: vi.fn(() => mockCountQuery),
            count: 250
          }
        case 'organizations':
          return {
            select: vi.fn(() => mockCountQuery),
            count: 20
          }
        case 'violations':
          return {
            select: vi.fn(() => mockCountQuery),
            count: 500
          }
        default:
          return mockCountQuery
      }
    })

    const request = new NextRequest('http://localhost/api/admin/stats')
    const response = await GET()

    expect(mockNextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        stats: expect.objectContaining({
          totalUsers: expect.any(Number),
          totalChecks: expect.any(Number),
          totalDictionaries: expect.any(Number),
          totalOrganizations: expect.any(Number),
          activeUsers: expect.any(Number),
          checksThisMonth: expect.any(Number),
          totalViolations: expect.any(Number),
          errorRate: expect.any(String)
        }),
        recentActivity: expect.any(Array),
        dailyChecks: expect.any(Array)
      })
    )
  })

  it('データベースエラー時には500エラーを返す', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null
    })

    mockSupabaseClient.from.mockImplementation(() => {
      throw new Error('Database connection error')
    })

    const request = new NextRequest('http://localhost/api/admin/stats')
    const response = await GET()

    expect(mockNextResponse.json).toHaveBeenCalledWith(
      { error: 'Internal server error' },
      { status: 500 }
    )
  })

  it('空のデータベースでも適切にレスポンスを返す', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null
    })

    // 空のデータベースの状態をモック
    mockSupabaseClient.from.mockImplementation((table) => {
      if (table === 'users' && mockSupabaseClient.from.mock.calls.length === 1) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role: 'admin' },
            error: null
          })
        }
      }
      
      return {
        select: vi.fn().mockImplementation(() => ({
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          count: 0,
          data: [],
          error: null
        })),
        count: 0,
        data: [],
        error: null
      }
    })

    const request = new NextRequest('http://localhost/api/admin/stats')
    const response = await GET()

    expect(mockNextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        stats: expect.objectContaining({
          totalUsers: 0,
          totalChecks: 0,
          totalDictionaries: 0,
          totalOrganizations: 0,
          activeUsers: 0,
          checksThisMonth: 0,
          totalViolations: 0,
          errorRate: '0.00'
        }),
        recentActivity: [],
        dailyChecks: expect.any(Array)
      })
    )
  })

  it('日別チェックデータが正しく生成される', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null
    })

    // 管理者ロールのモック
    const mockUserQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { role: 'admin' },
        error: null
      })
    }

    // 統計データのモック
    mockSupabaseClient.from.mockImplementation((table) => {
      if (table === 'users' && mockSupabaseClient.from.mock.calls.length === 1) {
        return mockUserQuery
      }
      
      // 日別チェックデータ用のモック
      if (table === 'checks') {
        return {
          select: vi.fn().mockImplementation((fields) => {
            if (fields === 'created_at') {
              return {
                gte: vi.fn().mockReturnThis(),
                order: vi.fn(() => ({
                  data: [
                    { created_at: '2024-01-20T10:00:00Z' },
                    { created_at: '2024-01-20T14:00:00Z' },
                    { created_at: '2024-01-19T09:00:00Z' }
                  ],
                  error: null
                }))
              }
            }
            // その他のクエリ用のデフォルトレスポンス
            return {
              gte: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              count: 0,
              data: [],
              error: null
            }
          }),
          count: 0
        }
      }
      
      // その他のテーブル用のデフォルトレスポンス
      return {
        select: vi.fn(() => ({
          count: 0,
          data: [],
          error: null
        })),
        count: 0
      }
    })

    const request = new NextRequest('http://localhost/api/admin/stats')
    const response = await GET()

    const responseData = await mockNextResponse.json.mock.results[0].value.json()
    expect(responseData.dailyChecks).toHaveLength(7) // 過去7日間
    expect(responseData.dailyChecks[0]).toHaveProperty('date')
    expect(responseData.dailyChecks[0]).toHaveProperty('count')
  })
})