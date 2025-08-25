import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

import { GET } from '@/app/api/check-history/route'
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

// Helper to create mock NextRequest
function createMockRequest(searchParams: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/check-history')
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })
  
  return {
    nextUrl: url
  } as NextRequest
}

describe('Check History API Route (Repository Pattern)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Reset mock repositories
    mockRepositories.users.reset()
    mockRepositories.checks.reset()
    
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

    const request = createMockRequest()
    await GET(request)

    expect(mockNextResponse.json).toHaveBeenCalledWith(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  })

  it('ユーザーが見つからない場合は404エラーを返す', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-not-found' } },
      error: null
    })

    mockRepositories.users.findById.mockResolvedValue(null)

    const request = createMockRequest()
    await GET(request)

    expect(mockNextResponse.json).toHaveBeenCalledWith(
      { error: 'User not found or not in organization' },
      { status: 404 }
    )
  })

  it('組織に所属していないユーザーには404エラーを返す', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-no-org' } },
      error: null
    })

    mockRepositories.users.findById.mockResolvedValue({
      id: 'user-no-org',
      email: 'user@test.com',
      role: 'user',
      organization_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    })

    const request = createMockRequest()
    await GET(request)

    expect(mockNextResponse.json).toHaveBeenCalledWith(
      { error: 'User not found or not in organization' },
      { status: 404 }
    )
  })

  it('一般ユーザーには自分のチェック履歴を返す', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'regular-user' } },
      error: null
    })

    mockRepositories.users.findById.mockResolvedValue({
      id: 'regular-user',
      email: 'user@test.com',
      role: 'user',
      organization_id: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    })

    const mockSearchResult = {
      checks: [{
        id: 1,
        user_id: 'regular-user',
        organization_id: 1,
        original_text: 'テストチェック',
        modified_text: '修正されたテキスト',
        status: 'completed' as const,
        input_type: 'text' as const,
        created_at: '2024-01-20T10:00:00Z',
        completed_at: '2024-01-20T10:02:00Z',
        deleted_at: null,
        error_message: null,
        extracted_text: null,
        image_url: null,
        ocr_metadata: null,
        ocr_status: null,
        users: { email: 'user@test.com' },
        violations: [{ id: 1 }, { id: 2 }]
      }],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      }
    }

    mockRepositories.checks.searchChecks.mockResolvedValue(mockSearchResult)

    const request = createMockRequest()
    await GET(request)

    expect(mockNextResponse.json).toHaveBeenCalledWith({
      checks: [{
        id: 1,
        originalText: 'テストチェック',
        modifiedText: '修正されたテキスト',
        status: 'completed',
        inputType: 'text',
        imageUrl: null,
        extractedText: null,
        ocrStatus: null,
        createdAt: '2024-01-20T10:00:00Z',
        completedAt: '2024-01-20T10:02:00Z',
        userEmail: 'user@test.com',
        violationCount: 2
      }],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      },
      userRole: 'user'
    })

    expect(mockRepositories.checks.searchChecks).toHaveBeenCalledWith({
      organizationId: 1,
      userId: 'regular-user', // User can only see their own checks
      search: undefined,
      status: undefined,
      inputType: undefined,
      dateFilter: undefined,
      page: 1,
      limit: 20
    })
  })

  it('管理者ユーザーには全ての組織チェック履歴を返す', async () => {
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

    const mockSearchResult = {
      checks: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      }
    }

    mockRepositories.checks.searchChecks.mockResolvedValue(mockSearchResult)

    const request = createMockRequest()
    await GET(request)

    expect(mockRepositories.checks.searchChecks).toHaveBeenCalledWith({
      organizationId: 1,
      userId: undefined, // Admin can see all checks in organization
      search: undefined,
      status: undefined,
      inputType: undefined,
      dateFilter: undefined,
      page: 1,
      limit: 20
    })
  })

  it('検索パラメータが正しく処理される', async () => {
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

    const mockSearchResult = {
      checks: [],
      pagination: {
        page: 2,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: true
      }
    }

    mockRepositories.checks.searchChecks.mockResolvedValue(mockSearchResult)

    const request = createMockRequest({
      page: '2',
      limit: '10',
      search: 'テスト',
      status: 'completed',
      inputType: 'image',
      dateFilter: 'week',
      userId: 'specific-user'
    })

    await GET(request)

    expect(mockRepositories.checks.searchChecks).toHaveBeenCalledWith({
      organizationId: 1,
      userId: 'specific-user', // Admin can filter by specific user
      search: 'テスト',
      status: 'completed',
      inputType: 'image',
      dateFilter: 'week',
      page: 2,
      limit: 10
    })
  })

  it('リポジトリエラー時には500エラーを返す', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-user' } },
      error: null
    })

    mockRepositories.users.findById.mockRejectedValue(new Error('Database connection error'))

    const request = createMockRequest()
    await GET(request)

    expect(mockNextResponse.json).toHaveBeenCalledWith(
      { error: 'Internal server error' },
      { status: 500 }
    )
  })
})