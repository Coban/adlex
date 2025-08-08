import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PUT } from "../route"

// @ts-nocheck

const mockSupabase = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

describe("/api/dictionaries/bulk-update", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => ({ data: { organization_id: 1, role: 'admin' }, error: null })) })) })) }
      }
      if (table === 'dictionaries') {
        return {
          update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })) })),
        }
      }
      return { select: vi.fn(() => ({})) }
    })
  })

  it('bulk updates returns counts', async () => {
    const body = { updates: [{ id: 1, patch: { category: 'NG' } }, { id: 2, patch: { notes: 'x' } }] }
    const req = new NextRequest('http://localhost/api/dictionaries/bulk-update', { method: 'PUT', body: JSON.stringify(body) })
    const res = await PUT(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(2)
  })
})


