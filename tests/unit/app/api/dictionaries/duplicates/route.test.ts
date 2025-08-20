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

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

import { GET } from "@/app/api/dictionaries/duplicates/route"

describe("/api/dictionaries/duplicates", () => {
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

  it('returns duplicates groups', async () => {
    // Setup mock data with duplicates
    mockRepositories.dictionaries.findByOrganizationId.mockResolvedValue([
      { id: 1, phrase: 'A', category: 'NG', notes: null },
      { id: 2, phrase: 'A', category: 'ALLOW', notes: null },
      { id: 3, phrase: 'B', category: 'NG', notes: null },
    ])
    
    const req = new NextRequest('http://localhost/api/dictionaries/duplicates')
    const res = await GET(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.duplicates.length).toBe(1)
    expect(json.duplicates[0].phrase).toBe('A')
  })

  it('returns 401 when unauthenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ 
      data: { user: null }, 
      error: new Error('x') 
    })
    
    const req = new NextRequest('http://localhost/api/dictionaries/duplicates')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })
})


