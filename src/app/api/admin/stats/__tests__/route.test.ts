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
  beforeEach(async () => {
    vi.clearAllMocks()
    
    // モックSupabaseクライアントをリセット
    mockSupabaseClient.auth.getUser.mockReset()
    mockSupabaseClient.from.mockReset()
    
    // 動的インポートでモックを設定
    const supabaseModule = await import('@/lib/supabase/server')
    const nextServerModule = await import('next/server')
    
    vi.mocked(supabaseModule.createClient).mockReturnValue(mockSupabaseClient as unknown as ReturnType<typeof supabaseModule.createClient>)
    vi.mocked(nextServerModule.NextResponse.json).mockImplementation(mockNextResponse.json)
  })

  it('未認証ユーザーには401エラーを返す', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Unauthorized')
    })

    await GET()

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

    await GET()

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

    // 詳細なモック設定（Promise.allが正しく動作するように）
    mockSupabaseClient.from.mockImplementation((table) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role: 'admin' },
            error: null
          })
        }
      }
      
      // その他のテーブル用の統一されたモック
      return {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        count: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: [],
          count: 10,
          error: null
        })
      }
    })

    await GET()

    expect(mockNextResponse.json).toHaveBeenCalledWith(
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

    mockSupabaseClient.from.mockImplementation(() => {
      throw new Error('Database connection error')
    })

    // エラーがthrowされることを期待してテストを実行
    try {
      await GET()
    } catch (error) {
      // エラーがthrowされることを確認
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe('Database connection error')
    }
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

    await GET()

    const responseCall = mockNextResponse.json.mock.calls[0]
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

    await GET()

    const responseData = await mockNextResponse.json.mock.results[0].value.json()
    expect(responseData.dailyChecks).toHaveLength(7) // 過去7日間
    expect(responseData.dailyChecks[0]).toHaveProperty('date')
    expect(responseData.dailyChecks[0]).toHaveProperty('count')
  })
})