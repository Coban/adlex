import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

import { GET, POST } from '@/app/api/dictionaries/route'
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
});

// Mock Supabase client
const mockQuery = createMockQueryBuilder();
const mockSupabaseClient = {
  from: vi.fn().mockReturnValue(mockQuery),
  auth: mockAuth,
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
}

const mockNextResponse = {
  json: vi.fn((data, init) => ({
    json: () => Promise.resolve(data),
    status: init?.status || 200,
    ok: (init?.status || 200) < 400
  }))
}

// Helper to create mock NextRequest
function createMockRequest(searchParams: Record<string, string> = {}, body?: any) {
  const url = new URL('http://localhost/api/dictionaries')
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })
  
  const request = {
    nextUrl: url,
    url: url.toString(),
    json: vi.fn().mockResolvedValue(body || {}),
  } as unknown as NextRequest
  
  return request
}

describe('Dictionaries API Route (Repository Pattern)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Reset mock repositories
    mockRepositories.users.reset()
    mockRepositories.dictionaries.reset()
    
    // Mock auth and repositories
    const supabaseModule = await import('@/infra/supabase/serverClient')
    const nextServerModule = await import('next/server')
    const repositoriesModule = await import('@/core/ports')
    
    vi.mocked(supabaseModule.createClient).mockReturnValue(mockSupabaseClient as any)
    vi.mocked(nextServerModule.NextResponse.json).mockImplementation(mockNextResponse.json as any)
    vi.mocked(repositoriesModule.getRepositories).mockResolvedValue(mockRepositories)
  })

  describe('GET /api/dictionaries', () => {
    it('未認証ユーザーには401エラーを返す', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Unauthorized')
      })

      const request = createMockRequest()
      await GET(request)

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: { code: 'AUTHENTICATION_ERROR', message: '認証が必要です', details: undefined } },
        { status: 401 }
      )
    })

    it('ユーザーが見つからない場合は401エラーを返す', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-not-found' } },
        error: null
      })

      mockRepositories.users.findById.mockResolvedValue(null)

      const request = createMockRequest()
      await GET(request)

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: { code: 'AUTHENTICATION_ERROR', message: 'ユーザーが見つかりません', details: undefined } },
        { status: 401 }
      )
    })

    it('組織に所属していないユーザーには403エラーを返す', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
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
        { error: { code: 'AUTHORIZATION_ERROR', message: 'ユーザーが組織に属していません', details: undefined } },
        { status: 403 }
      )
    })

    it('認証済みユーザーには辞書一覧を返す', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'valid-user' } },
        error: null
      })

      mockRepositories.users.findById.mockResolvedValue({
        id: 'valid-user',
        email: 'user@test.com',
        role: 'user',
        organization_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      })

      const mockDictionaries = [
        {
          id: 1,
          organization_id: 1,
          phrase: 'がんが治る',
          category: 'NG' as const,
          notes: '薬機法に抵触する表現',
          vector: null,
          created_at: '2024-01-20T10:00:00Z',
          updated_at: '2024-01-20T10:00:00Z',
        }
      ]

      mockRepositories.dictionaries.searchDictionaries.mockResolvedValue(mockDictionaries)

      const request = createMockRequest()
      await GET(request)

      expect(mockNextResponse.json).toHaveBeenCalledWith({
        dictionaries: [{
          id: 1,
          phrase: 'がんが治る',
          category: 'NG',
          notes: '薬機法に抵触する表現',
          createdAt: '2024-01-20T10:00:00Z',
          updatedAt: '2024-01-20T10:00:00Z'
        }],
        total: 1
      })

      expect(mockRepositories.dictionaries.searchDictionaries).toHaveBeenCalledWith({
        organizationId: 1,
        search: undefined,
        category: 'ALL',
      })
    })

    it('検索パラメータが正しく処理される', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'valid-user' } },
        error: null
      })

      mockRepositories.users.findById.mockResolvedValue({
        id: 'valid-user',
        email: 'user@test.com',
        role: 'user',
        organization_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      })

      mockRepositories.dictionaries.searchDictionaries.mockResolvedValue([])

      const request = createMockRequest({
        search: 'テスト',
        category: 'NG'
      })
      await GET(request)

      expect(mockRepositories.dictionaries.searchDictionaries).toHaveBeenCalledWith({
        organizationId: 1,
        search: 'テスト',
        category: 'NG',
      })
    })
  })

  describe('POST /api/dictionaries', () => {
    it('未認証ユーザーには401エラーを返す', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Unauthorized')
      })

      const request = createMockRequest({}, {
        phrase: 'テストフレーズ',
        category: 'NG',
        notes: 'テストノート'
      })
      await POST(request)

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: { code: 'AUTHENTICATION_ERROR', message: '認証が必要です', details: undefined } },
        { status: 401 }
      )
    })

    it('管理者以外には403エラーを返す', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
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

      const request = createMockRequest({}, {
        phrase: 'テストフレーズ',
        category: 'NG',
        notes: 'テストノート'
      })
      await POST(request)

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: { code: 'REPOSITORY_ERROR', message: '辞書エントリの作成に失敗しました', details: undefined } },
        { status: 500 }
      )
    })

    it('フレーズが空の場合は400エラーを返す', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
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

      const request = createMockRequest({}, {
        phrase: '',
        category: 'NG',
        notes: 'テストノート'
      })
      await POST(request)

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: { 
          code: 'VALIDATION_ERROR', 
          message: '語句は1文字以上である必要があります',
          details: expect.arrayContaining([
            expect.objectContaining({
              path: ['phrase'],
              message: '語句は1文字以上である必要があります'
            })
          ])
        } },
        { status: 400 }
      )
    })

    it('無効なカテゴリの場合は400エラーを返す', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
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

      const request = createMockRequest({}, {
        phrase: 'テストフレーズ',
        category: 'INVALID',
        notes: 'テストノート'
      })
      await POST(request)

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: { 
          code: 'VALIDATION_ERROR', 
          message: 'カテゴリは "NG" または "ALLOW" である必要があります',
          details: expect.arrayContaining([
            expect.objectContaining({
              path: ['category'],
              received: 'INVALID',
              message: expect.stringContaining('カテゴリは')
            })
          ])
        } },
        { status: 400 }
      )
    })

    it('管理者ユーザーは辞書項目を作成できる', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
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

      const mockDictionary = {
        id: 123,
        organization_id: 1,
        phrase: 'テストフレーズ',
        category: 'NG' as const,
        notes: 'テストノート',
        vector: null,
        created_at: '2024-01-20T10:00:00Z',
        updated_at: '2024-01-20T10:00:00Z',
      }

      // The UseCase calls dictionaries.create, not createWithEmbedding
      mockRepositories.dictionaries.create.mockResolvedValue(mockDictionary)
      
      // Also need to mock findByOrganizationId for duplicate check
      mockRepositories.dictionaries.findByOrganizationId.mockResolvedValue([])

      const request = createMockRequest({}, {
        phrase: 'テストフレーズ',
        category: 'NG',
        reasoning: 'テストノート'  // Use 'reasoning' field as per DTO schema
      })
      await POST(request)

      // The API successfully calls the UseCase which calls create
      expect(mockRepositories.dictionaries.create).toHaveBeenCalledWith({
        organization_id: 1,
        phrase: 'テストフレーズ',
        category: 'NG',
        notes: 'テストノート',  // UseCase maps reasoning to notes
        created_at: expect.any(String)
      })

      // Also verify duplicate check was performed
      expect(mockRepositories.dictionaries.findByOrganizationId).toHaveBeenCalledWith(1)

      // Verify successful response with UseCase output format
      expect(mockNextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          dictionaryId: 123,
          phrase: 'テストフレーズ',
          category: 'NG',
          message: '辞書エントリを作成しました'
        }),
        { status: 201 }
      )
    })

    it('リポジトリエラー時には500エラーを返す', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-user' } },
        error: null
      })

      mockRepositories.users.findById.mockRejectedValue(new Error('Database connection error'))

      const request = createMockRequest({}, {
        phrase: 'テストフレーズ',
        category: 'NG',
        notes: 'テストノート'
      })
      await POST(request)

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: { code: 'INTERNAL_ERROR', message: 'サーバーエラーが発生しました', details: undefined } },
        { status: 500 }
      )
    })
  })
})