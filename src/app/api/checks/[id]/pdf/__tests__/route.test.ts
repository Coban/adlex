import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSupabase: any = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

import { GET } from '../route'

describe('Checks PDF [id]/pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('無効なIDは400', async () => {
    const req = new NextRequest('http://localhost:3000/api/checks/abc/pdf')
    const res = await GET(req, { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })

  it('未認証は401', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('x') })
    const req = new NextRequest('http://localhost:3000/api/checks/1/pdf')
    const res = await GET(req, { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(401)
  })

  it('ユーザー未所属は404', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'u', organization_id: null }, error: null }),
        }
      }
      return { select: vi.fn(), eq: vi.fn(), is: vi.fn(), single: vi.fn() }
    })
    const req = new NextRequest('http://localhost:3000/api/checks/1/pdf')
    const res = await GET(req, { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(404)
  })

  it('チェック未発見は404', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'u', organization_id: 1, role: 'admin' }, error: null }),
        }
      }
      if (table === 'checks') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: new Error('not found') }),
        }
      }
      return { select: vi.fn(), eq: vi.fn(), is: vi.fn(), single: vi.fn() }
    })
    const req = new NextRequest('http://localhost:3000/api/checks/2/pdf')
    const res = await GET(req, { params: Promise.resolve({ id: '2' }) })
    expect(res.status).toBe(404)
  })

  it('他人のチェックは403', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'u', organization_id: 1, role: 'user' }, error: null }),
        }
      }
      if (table === 'checks') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 3, user_id: 'other', organization_id: 1 }, error: null }),
        }
      }
      return { select: vi.fn(), eq: vi.fn(), is: vi.fn(), single: vi.fn() }
    })
    const req = new NextRequest('http://localhost:3000/api/checks/3/pdf')
    const res = await GET(req, { params: Promise.resolve({ id: '3' }) })
    expect(res.status).toBe(403)
  })

  it.skip('PDF生成は重いためskip', async () => {})
})


