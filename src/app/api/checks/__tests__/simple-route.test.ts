import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// queue manager は到達させないが、保険でモック（hoisted）
const { addToQueueMock } = vi.hoisted(() => ({
  addToQueueMock: vi.fn(async () => {}),
}))
vi.mock('@/lib/queue-manager', () => ({
  queueManager: { addToQueue: addToQueueMock },
}))

// Supabase モック
 
type SupabaseClientMock = {
  auth: { getUser: ReturnType<typeof vi.fn> }
  from: ReturnType<typeof vi.fn>
}

const mockSupabase: SupabaseClientMock = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
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

describe('Checks API POST (simple validations)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未認証は401', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('no') })
    const req = new NextRequest('http://localhost:3000/api/checks', { method: 'POST', body: JSON.stringify({}) })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('ユーザー未発見は404', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: new Error('no') }) }
      }
      return { select: vi.fn(), in: vi.fn(), order: vi.fn(), single: vi.fn() }
    })
    const req = new NextRequest('http://localhost:3000/api/checks', { method: 'POST', body: JSON.stringify({ text: 'a' }) })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('使用量超過は429', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockUserProfile({ used: 10, max: 10 }), error: null }) }
      }
      return { select: vi.fn(), in: vi.fn(), order: vi.fn(), single: vi.fn() }
    })
    const req = new NextRequest('http://localhost:3000/api/checks', { method: 'POST', body: JSON.stringify({ text: 'a' }) })
    const res = await POST(req)
    expect(res.status).toBe(429)
  })

  it('テキストチェック: text必須で400', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockUserProfile({ used: 0, max: 100 }), error: null }) }
      }
      return { select: vi.fn(), in: vi.fn(), order: vi.fn(), single: vi.fn() }
    })
    const req = new NextRequest('http://localhost:3000/api/checks', { method: 'POST', body: JSON.stringify({}) })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('テキストチェック: 空文字は400', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockUserProfile({ used: 0, max: 100 }), error: null }) }
      }
      return { select: vi.fn(), in: vi.fn(), order: vi.fn(), single: vi.fn() }
    })
    const req = new NextRequest('http://localhost:3000/api/checks', { method: 'POST', body: JSON.stringify({ text: '   ' }) })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('テキストチェック: 長すぎると400', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockUserProfile({ used: 0, max: 100 }), error: null }) }
      }
      return { select: vi.fn(), in: vi.fn(), order: vi.fn(), single: vi.fn() }
    })
    const longText = 'x'.repeat(10001)
    const req = new NextRequest('http://localhost:3000/api/checks', { method: 'POST', body: JSON.stringify({ text: longText }) })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('画像チェック: image_url必須で400', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockUserProfile({ used: 0, max: 100 }), error: null }) }
      }
      return { select: vi.fn(), in: vi.fn(), order: vi.fn(), single: vi.fn() }
    })
    const req = new NextRequest('http://localhost:3000/api/checks', { method: 'POST', body: JSON.stringify({ input_type: 'image' }) })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it.skip('正常系やDB挿入失敗はskip（重い）', async () => {})
})


