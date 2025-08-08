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

describe("/api/dictionaries/duplicates", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => ({ data: { organization_id: 1, role: 'admin' }, error: null })) })) })) }
      }
      if (table === 'dictionaries') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(() => ({ data: [
          { id: 1, phrase: 'A', category: 'NG', notes: null },
          { id: 2, phrase: 'A', category: 'ALLOW', notes: null },
          { id: 3, phrase: 'B', category: 'NG', notes: null },
        ], error: null })) })) })) }
      }
      return { select: vi.fn(() => ({})) }
    })
  })

  it('returns duplicates groups', async () => {
    const req = new NextRequest('http://localhost/api/dictionaries/duplicates')
    const res = await GET(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.duplicates.length).toBe(1)
    expect(json.duplicates[0].phrase).toBe('A')
  })
})


