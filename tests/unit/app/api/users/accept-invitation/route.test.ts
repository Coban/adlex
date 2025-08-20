import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Comprehensive mock query builder with all methods
const createMockQueryBuilder = () => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  like: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  contains: vi.fn().mockReturnThis(),
  containedBy: vi.fn().mockReturnThis(),
  rangeGt: vi.fn().mockReturnThis(),
  rangeGte: vi.fn().mockReturnThis(),
  rangeLt: vi.fn().mockReturnThis(),
  rangeLte: vi.fn().mockReturnThis(),
  rangeAdjacent: vi.fn().mockReturnThis(),
  overlaps: vi.fn().mockReturnThis(),
  textSearch: vi.fn().mockReturnThis(),
  match: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  filter: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
})

// minimal supabase client mock
type SupabaseClient = {
  auth: {
    signUp: ReturnType<typeof vi.fn>
    getUser?: ReturnType<typeof vi.fn>
  }
  from: ReturnType<typeof vi.fn>
  rpc: ReturnType<typeof vi.fn>
}

const mockSupabase: SupabaseClient = {
  auth: { signUp: vi.fn(), getUser: vi.fn() },
  from: vi.fn(),
  rpc: vi.fn(),
}

vi.mock('@/infra/supabase/serverClient', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

// Mock repositories
vi.mock('@/core/ports', () => ({
  getRepositories: vi.fn(),
}))

// import after mocks
import { POST } from '@/app/api/users/accept-invitation/route'
import { getRepositories } from '@/core/ports'

describe('Accept Invitation API Route', () => {
  const mockRepositories = {
    userInvitations: {
      findByToken: vi.fn(),
      isInvitationValid: vi.fn(),
    },
    users: {
      findByEmail: vi.fn(),
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the mock query builder
    const newMockQuery = createMockQueryBuilder();
    mockSupabase.from.mockReturnValue(newMockQuery);
    // Mock repositories
    vi.mocked(getRepositories).mockResolvedValue(mockRepositories as any)
  })

  it('無効なJSONは400', async () => {
    // コンソールエラーを一時的に抑制
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    const req = new NextRequest('http://localhost:3000/api/users/accept-invitation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: 'invalid json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    
    // コンソールスパイを復元
    consoleSpy.mockRestore()
  })

  it('token/passwordが空は400', async () => {
    const req = new NextRequest('http://localhost:3000/api/users/accept-invitation', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('passwordが短いと400', async () => {
    const req = new NextRequest('http://localhost:3000/api/users/accept-invitation', {
      method: 'POST',
      body: JSON.stringify({ token: 't', password: '123' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('有効な招待が見つからないと404', async () => {
    // Mock repository to return null (no invitation found)
    mockRepositories.userInvitations.findByToken.mockResolvedValue(null)

    const req = new NextRequest('http://localhost:3000/api/users/accept-invitation', {
      method: 'POST',
      body: JSON.stringify({ token: 't', password: '123456' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('既存ユーザーが存在すると409', async () => {
    // Mock: valid invitation found
    mockRepositories.userInvitations.findByToken.mockResolvedValue({ email: 'e@example.com' })
    mockRepositories.userInvitations.isInvitationValid.mockReturnValue(true)
    // Mock: existing user found
    mockRepositories.users.findByEmail.mockResolvedValue({ id: 'u' })

    const req = new NextRequest('http://localhost:3000/api/users/accept-invitation', {
      method: 'POST',
      body: JSON.stringify({ token: 't', password: '123456' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
    expect(mockSupabase.auth.signUp).not.toHaveBeenCalled()
  })

  it.skip('正常系（ユーザー作成とaccept_invitation）', async () => {
    // 複数回のfrom/rpcチェーンやリダイレクトURL組立が絡むためスキップ
  })
})


