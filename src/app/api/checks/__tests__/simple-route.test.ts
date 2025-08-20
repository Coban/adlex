import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// queue manager は到達させないが、保険でモック（hoisted）
const { addToQueueMock, supabaseMock } = vi.hoisted(() => {
  // Create comprehensive query builder mock
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    containedBy: vi.fn().mockReturnThis(),
    rangeGt: vi.fn().mockReturnThis(),
    rangeGte: vi.fn().mockReturnThis(),
    rangeLt: vi.fn().mockReturnThis(),
    rangeLte: vi.fn().mockReturnThis(),
    rangeAdjacent: vi.fn().mockReturnThis(),
    overlaps: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  }

  return {
    addToQueueMock: vi.fn(async () => {}),
    supabaseMock: {
      auth: { getUser: vi.fn() },
      from: vi.fn().mockReturnValue(mockQuery),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
  }
})

vi.mock('@/lib/queue-manager', () => ({
  queueManager: { addToQueue: addToQueueMock },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => supabaseMock),
}))

import { POST } from '../route'

function mockUserProfile({ used = 0, max = 100, role = 'user' as 'user' | 'admin' }) {
  return {
    id: 'u',
    role,
    organization_id: 1,
    organizations: {
      id: 1,
      name: 'Org',
      used_checks: used,
      max_checks: max,
    },
  }
}

describe.skip('Checks API POST (simple validations) - DEPRECATED: Use repository tests instead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未認証は401', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('no') })
    const req = new NextRequest('http://localhost:3000/api/checks', { method: 'POST', body: JSON.stringify({}) })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('ユーザー未発見は404', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: { message: 'no' } }), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'no' } }) }
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }
    })
    const req = new NextRequest('http://localhost:3000/api/checks', { method: 'POST', body: JSON.stringify({ text: 'a' }) })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('使用量超過は429', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockUserProfile({ used: 10, max: 10 }), error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: mockUserProfile({ used: 10, max: 10 }), error: null }) }
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }
    })
    const req = new NextRequest('http://localhost:3000/api/checks', { method: 'POST', body: JSON.stringify({ text: 'a' }) })
    const res = await POST(req)
    expect(res.status).toBe(429)
  })

  it('テキストチェック: text必須で400', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockUserProfile({ used: 0, max: 100 }), error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: mockUserProfile({ used: 0, max: 100 }), error: null }) }
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }
    })
    const req = new NextRequest('http://localhost:3000/api/checks', { method: 'POST', body: JSON.stringify({}) })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('テキストチェック: 空文字は400', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockUserProfile({ used: 0, max: 100 }), error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: mockUserProfile({ used: 0, max: 100 }), error: null }) }
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }
    })
    const req = new NextRequest('http://localhost:3000/api/checks', { method: 'POST', body: JSON.stringify({ text: '   ' }) })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('テキストチェック: 長すぎると400', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockUserProfile({ used: 0, max: 100 }), error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: mockUserProfile({ used: 0, max: 100 }), error: null }) }
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }
    })
    const longText = 'x'.repeat(10001)
    const req = new NextRequest('http://localhost:3000/api/checks', { method: 'POST', body: JSON.stringify({ text: longText }) })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('画像チェック: image_url必須で400', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockUserProfile({ used: 0, max: 100 }), error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: mockUserProfile({ used: 0, max: 100 }), error: null }) }
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }
    })
    const req = new NextRequest('http://localhost:3000/api/checks', { method: 'POST', body: JSON.stringify({ input_type: 'image' }) })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it.skip('正常系やDB挿入失敗はskip（重い）', async () => {})
})


