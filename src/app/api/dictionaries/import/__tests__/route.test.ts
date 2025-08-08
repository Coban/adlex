import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { POST } from "../route"

// @ts-nocheck

const mockSupabase = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

vi.mock("@/lib/ai-client", () => ({
  createEmbedding: vi.fn(() => Promise.resolve(new Array(384).fill(0.1))),
}))

describe("/api/dictionaries/import", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => ({ data: { organization_id: 1, role: "admin" }, error: null })) })) })),
        }
      }
      if (table === "dictionaries") {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ data: [], error: null })) })),
          insert: vi.fn(() => ({ })),
          update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ })) })) })),
        }
      }
      return { select: vi.fn(() => ({ })) }
    })
  })

  it("imports CSV rows", async () => {
    const csv = `\ufeffphrase,category,notes\nA,NG,alpha\nB,ALLOW,`;
    const req = new NextRequest("http://localhost/api/dictionaries/import", { method: 'POST', headers: { 'content-type': 'text/csv' }, body: csv })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.inserted).toBeGreaterThanOrEqual(2)
  })

  it("rejects when unauthenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('x') })
    const req = new NextRequest("http://localhost/api/dictionaries/import", { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: 'phrase,category\nA,NG' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})


