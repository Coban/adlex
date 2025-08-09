import { describe, it, expect, vi, beforeEach } from 'vitest'

type SupabaseClient = {
  auth: { getUser: ReturnType<typeof vi.fn> }
  from: ReturnType<typeof vi.fn>
}

const mockSupabaseClient: SupabaseClient = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}))

import { GET } from '../route'

describe('Invitations List API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未認証は401', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('no') })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('ユーザー情報取得失敗は400', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: new Error('x') }),
    })
    const res = await GET()
    expect(res.status).toBe(400)
  })

  it('管理者以外は403', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { role: 'user', organization_id: 'o1' }, error: null }),
    })
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('組織未所属は400', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { role: 'admin', organization_id: null }, error: null }),
    })
    const res = await GET()
    expect(res.status).toBe(400)
  })

  it('取得失敗は500', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    // 1回目: 現ユーザー情報
    // 2回目: 招待一覧の取得でエラー
    const call = 0
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { role: 'admin', organization_id: 'o1' }, error: null }),
        }
      }
      if (table === 'user_invitations') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          // 最終で失敗
          then: undefined,
          // Vitest の期待に合わせ、呼び出し直で返すために仮の終端を用意
          // 実際のコードでは .select().eq().order() の戻りに対して
          // 呼び出し側は await をしている想定なので、直接戻り値に error を含むオブジェクトを返す
          // ここでは簡単に async 関数を返してエラーを注入
          // @ts-expect-error simplify
          async execute() { return { data: null, error: new Error('db') } },
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    })

    // 簡易的にチェーンの最後でエラーが返るように、直接エラー結果を返すモック
    mockSupabaseClient.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { role: 'admin', organization_id: 'o1' }, error: null }),
    } as any)
    mockSupabaseClient.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: new Error('db') }),
    } as any)

    const res = await GET()
    expect(res.status).toBe(500)
  })
})


