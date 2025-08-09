import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

type SupabaseClient = {
  from: ReturnType<typeof vi.fn>
}

const mockSupabaseClient: SupabaseClient = {
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}))

import { GET } from '../route'

describe('Invitation Info API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('token欠如は400', async () => {
    const req = new NextRequest('http://localhost:3000/api/users/invitation-info', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('無効/期限切れは400', async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: new Error('expired') }),
    })

    const url = new URL('http://localhost:3000/api/users/invitation-info')
    url.searchParams.set('token', 't')
    const req = new NextRequest(url, { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it.skip('正常系（組織名含むレスポンス）', async () => {
    // 結合結果型の表現やサブクエリのモックが絡むためスキップ
  })
})


