import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSupabase: any = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

import { POST } from '../route'

describe('Checks Cancel API [id]/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('無効なIDは400', async () => {
    const req = new NextRequest('http://localhost:3000/api/checks/abc/cancel', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })

  it('未認証は401', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('x') })
    const req = new NextRequest('http://localhost:3000/api/checks/1/cancel', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(401)
  })

  it.skip('ステータスチェックや更新系はskip', async () => {})
})


