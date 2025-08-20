import { NextRequest } from "next/server"
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock repositories
const mockRepositories = {
  users: {
    findById: vi.fn()
  },
  dictionaries: {
    findByOrganizationId: vi.fn(),
    findById: vi.fn()
  },
  checks: {
    findMany: vi.fn()
  },
  violations: {
    findByCheckId: vi.fn()
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

import { GET } from "@/app/api/dictionaries/stats/route"

describe("/api/dictionaries/stats", () => {
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

  it('returns stats for admin', async () => {
    // Setup mock data
    mockRepositories.dictionaries.findByOrganizationId.mockResolvedValue([
      { id: 1, category: 'NG', phrase: 'A' },
      { id: 2, category: 'ALLOW', phrase: 'B' }
    ])
    
    mockRepositories.checks.findMany.mockResolvedValue([
      { id: 10 }
    ])
    
    mockRepositories.violations.findByCheckId.mockResolvedValue([
      { dictionary_id: 1, check_id: 10 }
    ])
    
    mockRepositories.dictionaries.findById.mockResolvedValue(
      { id: 1, phrase: 'A' }
    )

    const req = new NextRequest('http://localhost/api/dictionaries/stats')
    const res = await GET(req)
    const json = await res.json()
    
    expect(res.status).toBe(200)
    expect(json.data.totals.total).toBe(2)
    expect(json.data.totals.ng).toBe(1)
    expect(json.data.topUsed[0].dictionary_id).toBe(1)
  })

  it('401 when unauthenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ 
      data: { user: null }, 
      error: new Error('x') 
    })
    
    const req = new NextRequest('http://localhost/api/dictionaries/stats')
    const res = await GET(req)
    
    expect(res.status).toBe(401)
  })
})