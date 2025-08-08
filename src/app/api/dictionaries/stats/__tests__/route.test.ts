import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { GET } from "../route"

// @ts-nocheck

const mockSupabase = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

describe("/api/dictionaries/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => ({ data: { organization_id: 1, role: 'admin' }, error: null })) })) })) }
      }
      if (table === 'dictionaries') {
        return { 
          select: vi.fn(() => ({ 
            eq: vi.fn(() => ({ data: [{ id: 1, category: 'NG', phrase: 'A' }, { id: 2, category: 'ALLOW', phrase: 'B' }], error: null })),
            in: vi.fn((_col: string, _vals: number[]) => ({ data: [{ id: 1, phrase: 'A' }, { id: 2, phrase: 'B' }], error: null })),
          })) 
        }
      }
      if (table === 'checks') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ gte: vi.fn(() => ({ data: [{ id: 10 }], error: null })) })) })) }
      }
      if (table === 'violations') {
        return { select: vi.fn(() => ({ in: vi.fn((_col: string, _vals: number[]) => ({ data: [{ dictionary_id: 1, check_id: 10 }], error: null })) })) }
      }
      return { select: vi.fn(() => ({})) }
    })
  })

  it('returns stats for admin', async () => {
    const req = new NextRequest('http://localhost/api/dictionaries/stats')
    const res = await GET(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.totals.total).toBe(2)
    expect(json.totals.ng).toBe(1)
    expect(json.topUsed[0].dictionary_id).toBe(1)
  })

  it('401 when unauthenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('x') })
    const req = new NextRequest('http://localhost/api/dictionaries/stats')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })
})


