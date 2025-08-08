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

describe("/api/dictionaries/export", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ single: vi.fn(() => ({ data: { organization_id: 1, role: "admin" }, error: null })) })),
          })),
        }
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ order: vi.fn(() => ({ data: [{ phrase: "A", category: "NG", notes: "n" }], error: null })) })),
        })),
      }
    })
  })

  it("returns CSV for admin", async () => {
    const req = new NextRequest("http://localhost/api/dictionaries/export")
    const res = await GET(req)
    const text = await res.text()
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/csv")
    expect(text).toContain("phrase,category,notes")
    expect(text).toContain("A,NG,n")
  })

  it("returns 401 when unauthenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error("x") })
    const req = new NextRequest("http://localhost/api/dictionaries/export")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })
})


