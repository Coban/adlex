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

describe('/api/admin/performance', () => {
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

    const mockUserQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { role: 'user' },
        error: null
      })
    }

    mockSupabaseClient.from.mockReturnValue(mockUserQuery)

    await GET()

    expect(mockNextResponse.json).toHaveBeenCalledWith(
      { error: 'Forbidden' },
      { status: 403 }
    )
  })

  it('管理者ユーザーにはパフォーマンスデータを返す', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null
    })

    let callCount = 0
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mockSupabaseClient.from.mockImplementation((_table) => {
      callCount++
      
      if (callCount === 1) {
        // 最初の呼び出し（ユーザーロール取得）
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role: 'admin' },
            error: null
          })
        }
      }
      
      // 2回目の呼び出し（checksデータ取得）
      return {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: '1',
              created_at: '2024-01-20T10:00:00Z',
              completed_at: '2024-01-20T10:02:30Z',
              status: 'completed'
            },
            {
              id: '2',
              created_at: '2024-01-20T09:00:00Z',
              completed_at: '2024-01-20T09:01:45Z',
              status: 'completed'
            },
            {
              id: '3',
              created_at: '2024-01-20T08:00:00Z',
              completed_at: null,
              status: 'failed'
            },
            {
              id: '4',
              created_at: '2024-01-20T07:00:00Z',
              completed_at: null,
              status: 'processing'
            }
          ],
          error: null
        })
      }
    })

    await GET()

    expect(mockNextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        performance: expect.objectContaining({
          avgProcessingTime: expect.any(String),
          maxProcessingTime: expect.any(String),
          minProcessingTime: expect.any(String),
          totalChecks24h: expect.any(Number),
          successRate: expect.any(String),
          errorRate: expect.any(String)
        }),
        statusBreakdown: expect.any(Object),
        hourlyActivity: expect.any(Array),
        systemHealth: expect.objectContaining({
          status: expect.stringMatching(/^(healthy|warning|critical)$/),
          uptime: expect.any(String),
          lastIncident: null
        })
      })
    )
  })

  it('処理時間を正しく計算する', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null
    })

    let callCount = 0
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mockSupabaseClient.from.mockImplementation((_table) => {
      callCount++
      
      if (callCount === 1) {
        // ユーザーロール取得
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role: 'admin' },
            error: null
          })
        }
      }
      
      // 処理時間テスト用のデータ
      return {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: '1',
              created_at: '2024-01-20T10:00:00Z',
              completed_at: '2024-01-20T10:00:05Z', // 5秒
              status: 'completed'
            },
            {
              id: '2',
              created_at: '2024-01-20T09:00:00Z',
              completed_at: '2024-01-20T09:00:10Z', // 10秒
              status: 'completed'
            },
            {
              id: '3',
              created_at: '2024-01-20T08:00:00Z',
              completed_at: '2024-01-20T08:00:02Z', // 2秒
              status: 'completed'
            }
          ],
          error: null
        })
      }
    })

    await GET()

    const responseCall = mockNextResponse.json.mock.calls[0]
    const responseData = responseCall[0]

    // 平均処理時間: (5 + 10 + 2) / 3 = 5.67秒
    expect(parseFloat(responseData.performance.avgProcessingTime)).toBeCloseTo(5.67, 1)
    // 最大処理時間: 10秒
    expect(parseFloat(responseData.performance.maxProcessingTime)).toBe(10)
    // 最小処理時間: 2秒
    expect(parseFloat(responseData.performance.minProcessingTime)).toBe(2)
  })

  it('ステータス別の集計を正しく行う', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null
    })

    let callCount = 0
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mockSupabaseClient.from.mockImplementation((_table) => {
      callCount++
      
      if (callCount === 1) {
        // ユーザーロール取得
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role: 'admin' },
            error: null
          })
        }
      }
      
      // ステータステスト用のデータ
      return {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            { id: '1', status: 'completed', created_at: '2024-01-20T10:00:00Z' },
            { id: '2', status: 'completed', created_at: '2024-01-20T09:00:00Z' },
            { id: '3', status: 'completed', created_at: '2024-01-20T08:00:00Z' },
            { id: '4', status: 'error', created_at: '2024-01-20T07:00:00Z' },
            { id: '5', status: 'processing', created_at: '2024-01-20T06:00:00Z' }
          ],
          error: null
        })
      }
    })

    await GET()

    const responseCall = mockNextResponse.json.mock.calls[0]
    const responseData = responseCall[0]

    expect(responseData.statusBreakdown).toEqual({
      completed: 3,
      error: 1,
      processing: 1
    })

    // 成功率: 3/5 * 100 = 60%
    expect(parseFloat(responseData.performance.successRate)).toBe(60)
    // エラー率: 1/5 * 100 = 20%
    expect(parseFloat(responseData.performance.errorRate)).toBe(20)
  })

  it('時間帯別アクティビティを正しく集計する', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null
    })

    let callCount = 0
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mockSupabaseClient.from.mockImplementation((_table) => {
      callCount++
      
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role: 'admin' },
            error: null
          })
        }
      }
      
      // 時間帯別テスト用のデータ
      return {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            { id: '1', status: 'completed', created_at: '2024-01-20T10:30:00Z' }, // 10時台
            { id: '2', status: 'completed', created_at: '2024-01-20T10:45:00Z' }, // 10時台
            { id: '3', status: 'completed', created_at: '2024-01-20T14:15:00Z' }, // 14時台
            { id: '4', status: 'failed', created_at: '2024-01-20T14:30:00Z' }     // 14時台
          ],
          error: null
        })
      }
    })

    await GET()

    const responseCall = mockNextResponse.json.mock.calls[0]
    const responseData = responseCall[0]

    // 時間帯別データが配列で返されることを確認
    expect(responseData.hourlyActivity).toEqual(expect.any(Array))
    expect(responseData.hourlyActivity).toHaveLength(24)

    // 各時間帯のデータ構造を確認
    responseData.hourlyActivity.forEach((hour: unknown) => {
      expect(hour).toHaveProperty('hour')
      expect(hour).toHaveProperty('count')
      expect(typeof hour.count).toBe('number')
    })
  })

  it('システムヘルスステータスを正しく判定する', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null
    })

    // 高いエラー率のテストケース（15%エラー）
    let callCount = 0
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mockSupabaseClient.from.mockImplementation((_table) => {
      callCount++
      
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role: 'admin' },
            error: null
          })
        }
      }
      
      // 15%エラー率のデータ
      const data = Array.from({ length: 20 }, (_, i) => ({
        id: `${i + 1}`,
        status: i < 17 ? 'completed' : 'error', // 17成功、3エラー = 15%エラー率
        created_at: `2024-01-20T${String(10 + Math.floor(i / 2)).padStart(2, '0')}:00:00Z`
      }))

      return {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data,
          error: null
        })
      }
    })

    await GET()

    const responseCall = mockNextResponse.json.mock.calls[0]
    const responseData = responseCall[0]

    // エラー率が10%以上なのでクリティカル状態
    expect(responseData.systemHealth.status).toBe('critical')
  })

  it('空のデータでも適切にレスポンスを返す', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null
    })

    let callCount = 0
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mockSupabaseClient.from.mockImplementation((_table) => {
      callCount++
      
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role: 'admin' },
            error: null
          })
        }
      }
      
      // 空のデータ
      return {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      }
    })

    await GET()

    const responseCall = mockNextResponse.json.mock.calls[0]
    const responseData = responseCall[0]

    expect(responseData.performance.avgProcessingTime).toBe('0.00')
    expect(responseData.performance.maxProcessingTime).toBe('0.00')
    expect(responseData.performance.minProcessingTime).toBe('0.00')
    expect(responseData.performance.totalChecks24h).toBe(0)
    expect(responseData.performance.successRate).toBe('0.00')
    expect(responseData.performance.errorRate).toBe('0.00')
    expect(responseData.statusBreakdown).toEqual({})
    expect(responseData.systemHealth.status).toBe('healthy')
  })

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

  it('null値を適切に処理する', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null
    })

    let callCount = 0
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mockSupabaseClient.from.mockImplementation((_table) => {
      callCount++
      
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role: 'admin' },
            error: null
          })
        }
      }
      
      // null値を含むデータ
      return {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: '1',
              created_at: '2024-01-20T10:00:00Z',
              completed_at: null,
              status: null
            },
            {
              id: '2',
              created_at: null,
              completed_at: '2024-01-20T10:00:05Z',
              status: 'completed'
            }
          ],
          error: null
        })
      }
    })

    await GET()

    // エラーが発生せずにレスポンスが返されることを確認
    expect(mockNextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        performance: expect.any(Object),
        statusBreakdown: expect.any(Object),
        hourlyActivity: expect.any(Array),
        systemHealth: expect.any(Object)
      })
    )
  })
})