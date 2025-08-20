import { NextRequest } from "next/server"
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock repositories
const mockRepositories = {
  users: {
    findById: vi.fn()
  },
  dictionaries: {
    findByOrganizationId: vi.fn(),
  }
};

vi.mock('@/core/ports', () => ({
  getRepositories: vi.fn(() => mockRepositories)
}))

// Mock Supabase client
const mockSupabase = {
  auth: { getUser: vi.fn() },
};

vi.mock("@/infra/supabase/serverClient", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

import { GET } from "@/app/api/dictionaries/export/route"

describe("/api/dictionaries/export", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default successful auth
    mockSupabase.auth.getUser.mockResolvedValue({ 
      data: { user: { id: 'u1' } }, 
      error: null 
    })
    
    // Default admin user
    mockRepositories.users.findById.mockResolvedValue({
      organization_id: 1,
      role: 'admin'
    })
  })

  it("returns CSV for admin", async () => {
    // Setup mock data
    mockRepositories.dictionaries.findByOrganizationId.mockResolvedValue([
      { phrase: "A", category: "NG", notes: "n" }
    ])
    
    const req = new NextRequest("http://localhost/api/dictionaries/export")
    const res = await GET(req)
    const text = await res.text()
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/csv")
    expect(text).toContain("phrase,category,notes")
    expect(text).toContain("A,NG,n")
  })

  it("returns 401 when unauthenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ 
      data: { user: null }, 
      error: new Error("x") 
    })
    
    const req = new NextRequest("http://localhost/api/dictionaries/export")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })
})


