import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock repositories
const mockRepositories = {
  users: {
    findById: vi.fn()
  },
  userInvitations: {
    findByOrganizationId: vi.fn()
  }
};

vi.mock('@/core/ports', () => ({
  getRepositories: vi.fn(() => mockRepositories)
}))

// Mock Supabase client
const mockSupabaseClient = {
  auth: { getUser: vi.fn() },
};

vi.mock('@/infra/supabase/serverClient', () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}))

import { GET } from '@/app/api/users/invitations/route'

describe('Invitations List API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未認証は401', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('no') })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('ユーザー情報取得失敗は401', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockRepositories.users.findById.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('管理者以外は403', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockRepositories.users.findById.mockResolvedValue({ role: 'user', organization_id: 'o1' })
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('組織未所属は401', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockRepositories.users.findById.mockResolvedValue({ role: 'admin', organization_id: null })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('取得失敗は500', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockRepositories.users.findById.mockResolvedValue({ role: 'admin', organization_id: 'o1' })
    mockRepositories.userInvitations.findByOrganizationId.mockRejectedValue(new Error('db error'))
    const res = await GET()
    expect(res.status).toBe(500)
    
    consoleErrorSpy.mockRestore()
  })
})


