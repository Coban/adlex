import { NextRequest } from "next/server"
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock repositories
const mockRepositories = {
  users: {
    findById: vi.fn()
  },
  dictionaries: {
    findByIdAndOrganization: vi.fn(),
    update: vi.fn()
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

import { PUT } from "@/app/api/dictionaries/bulk-update/route"

describe("/api/dictionaries/bulk-update", () => {
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

  it('bulk updates returns counts', async () => {
    // Mock successful dictionary operations
    mockRepositories.dictionaries.findByIdAndOrganization.mockResolvedValue({ id: 1, phrase: 'test' })
    mockRepositories.dictionaries.update.mockResolvedValue({ id: 1, phrase: 'test' })
    
    const body = { updates: [{ id: 1, patch: { category: 'NG' } }, { id: 2, patch: { notes: 'x' } }] }
    const req = new NextRequest('http://localhost/api/dictionaries/bulk-update', { method: 'PUT', body: JSON.stringify(body) })
    const res = await PUT(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(2)
  })

  it('returns 401 when unauthenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ 
      data: { user: null }, 
      error: new Error('x') 
    })
    
    const body = { updates: [{ id: 1, patch: { category: 'NG' } }] }
    const req = new NextRequest('http://localhost/api/dictionaries/bulk-update', { method: 'PUT', body: JSON.stringify(body) })
    const res = await PUT(req)
    expect(res.status).toBe(401)
  })
})


