import { describe, it, expect, vi, beforeEach } from 'vitest'

import { GET } from '@/app/api/users/route'
import { mockRepositories } from 'tests/mocks/repositories'

// Mock the repository provider
vi.mock('@/core/ports', () => ({
  getRepositories: vi.fn(),
}))

// Mock Supabase auth
vi.mock('@/infra/supabase/serverClient', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn()
    }
  }))
}))

vi.mock('next/server', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    NextResponse: {
      json: vi.fn((data, init) => ({
        json: () => Promise.resolve(data),
        status: init?.status || 200,
        ok: (init?.status || 200) < 400
      }))
    }
  }
})

const mockAuth = {
  getUser: vi.fn()
}

const mockSupabaseClient = {
  auth: mockAuth
}

const mockNextResponse = {
  json: vi.fn((data, init) => ({
    json: () => Promise.resolve(data),
    status: init?.status || 200,
    ok: (init?.status || 200) < 400
  }))
}

describe('Users API Route (Repository Pattern)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Reset mock repositories
    mockRepositories.users.reset()
    
    // Mock auth and repositories
    const supabaseModule = await import('@/infra/supabase/serverClient')
    const nextServerModule = await import('next/server')
    const repositoriesModule = await import('@/core/ports')
    
    vi.mocked(supabaseModule.createClient).mockReturnValue(mockSupabaseClient as any)
    vi.mocked(nextServerModule.NextResponse.json).mockImplementation(mockNextResponse.json as any)
    vi.mocked(repositoriesModule.getRepositories).mockResolvedValue(mockRepositories)
  })

  it('未認証ユーザーには401エラーを返す', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Unauthorized')
    })

    await GET({ url: "http://localhost/test", cookies: { get: () => null }, headers: new Headers() } as any)

    expect(mockNextResponse.json).toHaveBeenCalledWith(
      { error: { code: 'AUTHENTICATION_ERROR', message: '認証が必要です', details: undefined } },
      { status: 401 }
    )
  })

  it('ユーザーデータが見つからない場合は400エラーを返す', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-not-found' } },
      error: null
    })

    // Mock user not found
    mockRepositories.users.findById.mockResolvedValue(null)

    await GET({ url: "http://localhost/test", cookies: { get: () => null }, headers: new Headers() } as any)

    expect(mockNextResponse.json).toHaveBeenCalledWith(
      { error: { code: 'AUTHENTICATION_ERROR', message: 'ユーザーが見つかりません', details: undefined } },
      { status: 401 }
    )
    expect(mockRepositories.users.findById).toHaveBeenCalledWith('user-not-found')
  })

  it('管理者以外には403エラーを返す', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'regular-user' } },
      error: null
    })

    // Mock regular user
    mockRepositories.users.findById.mockResolvedValue({
      id: 'regular-user',
      email: 'user@test.com',
      role: 'user',
      organization_id: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    })

    await GET({ url: "http://localhost/test", cookies: { get: () => null }, headers: new Headers() } as any)

    expect(mockNextResponse.json).toHaveBeenCalledWith(
      { error: { code: 'AUTHORIZATION_ERROR', message: '管理者権限が必要です', details: undefined } },
      { status: 403 }
    )
  })

  it('組織に所属していないユーザーには400エラーを返す', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-no-org' } },
      error: null
    })

    // Mock user without organization
    mockRepositories.users.findById.mockResolvedValue({
      id: 'user-no-org',
      email: 'user@test.com',
      role: 'admin',
      organization_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    })

    await GET({ url: "http://localhost/test", cookies: { get: () => null }, headers: new Headers() } as any)

    expect(mockNextResponse.json).toHaveBeenCalledWith(
      { error: { code: 'AUTHORIZATION_ERROR', message: 'ユーザーが組織に属していません', details: undefined } },
      { status: 403 }
    )
  })

  it('管理者ユーザーには組織のユーザー一覧を返す', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-user' } },
      error: null
    })

    // Mock admin user
    mockRepositories.users.findById.mockResolvedValue({
      id: 'admin-user',
      email: 'admin@test.com',
      role: 'admin',
      organization_id: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    })

    // Mock organization users
    mockRepositories.users.findByOrganizationId.mockResolvedValue([
      {
        id: 'admin-user',
        email: 'admin@test.com',
        role: 'admin',
        organization_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'user-2',
        email: 'user2@test.com',
        role: 'user',
        organization_id: 1,
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      }
    ])

    await GET({ url: "http://localhost/test", cookies: { get: () => null }, headers: new Headers() } as any)

    expect(mockNextResponse.json).toHaveBeenCalledWith({
      users: expect.arrayContaining([
        expect.objectContaining({
          id: 'admin-user',
          email: 'admin@test.com',
          role: 'admin',
          displayName: null,
          organizationId: 1,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }),
        expect.objectContaining({
          id: 'user-2',
          email: 'user2@test.com',
          role: 'user',
          displayName: null,
          organizationId: 1,
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z'
        })
      ]),
      pagination: expect.objectContaining({
        page: 1,
        limit: expect.any(Number),
        total: expect.any(Number),
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      })
    })

    expect(mockRepositories.users.findByOrganizationId).toHaveBeenCalledWith(1)
  })

  it('ユーザー一覧が空の場合も適切に処理する', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-user' } },
      error: null
    })

    mockRepositories.users.findById.mockResolvedValue({
      id: 'admin-user',
      email: 'admin@test.com',
      role: 'admin',
      organization_id: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    })

    // Mock empty user list
    mockRepositories.users.findByOrganizationId.mockResolvedValue([])

    await GET({ url: "http://localhost/test", cookies: { get: () => null }, headers: new Headers() } as any)

    expect(mockNextResponse.json).toHaveBeenCalledWith({
      users: [],
      pagination: expect.objectContaining({
        page: 1,
        limit: 0,
        total: 0,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      })
    })
  })

  it('リポジトリエラー時には500エラーを返す', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-user' } },
      error: null
    })

    // Mock repository error
    mockRepositories.users.findById.mockRejectedValue(new Error('Database connection error'))

    await GET({ url: "http://localhost/test", cookies: { get: () => null }, headers: new Headers() } as any)

    expect(mockNextResponse.json).toHaveBeenCalledWith(
      { error: { code: 'INTERNAL_ERROR', message: '内部エラーが発生しました', details: undefined } },
      { status: 500 }
    )
  })
})