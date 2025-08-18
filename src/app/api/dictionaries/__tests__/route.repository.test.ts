import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

import { GET, POST } from '../route'
import { mockRepositories } from '@/test/mocks/repositories'

// Mock the repository provider
vi.mock('@/lib/repositories', () => ({
  getRepositories: vi.fn(),
}))

// Mock Supabase auth
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn()
    }
  }))
}))

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal()
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
    const supabaseModule = await import('@/lib/supabase/server')
    const nextServerModule = await import('next/server')
    const repositoriesModule = await import('@/lib/repositories')
    
    vi.mocked(supabaseModule.createClient).mockReturnValue(mockSupabaseClient as any)
    vi.mocked(nextServerModule.NextResponse.json).mockImplementation(mockNextResponse.json)
    vi.mocked(repositoriesModule.getRepositories).mockResolvedValue(mockRepositories)
  })

  describe('GET /api/dictionaries', () => {
    it('未認証ユーザーには401エラーを返す', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Unauthorized')
      })

      const request = createMockRequest()
      await GET(request)

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: '認証が必要です' },
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
        { error: 'ユーザープロファイルが見つかりません' },
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
        { error: 'ユーザープロファイルが見つかりません' },
        { status: 404 }
      )
    })

    it('認証済みユーザーには辞書一覧を返す', async () => {
      mockAuth.getUser.mockResolvedValue({
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
        dictionaries: mockDictionaries
      })

      expect(mockRepositories.dictionaries.searchDictionaries).toHaveBeenCalledWith({
        organizationId: 1,
        search: undefined,
        category: 'ALL',
      })
    })

    it('検索パラメータが正しく処理される', async () => {
      mockAuth.getUser.mockResolvedValue({
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
      mockAuth.getUser.mockResolvedValue({
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
        { error: '認証が必要です' },
        { status: 401 }
      )
    })

    it('管理者以外には403エラーを返す', async () => {
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

      const request = createMockRequest({}, {
        phrase: 'テストフレーズ',
        category: 'NG',
        notes: 'テストノート'
      })
      await POST(request)

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: '管理者権限が必要です' },
        { status: 403 }
      )
    })

    it('フレーズが空の場合は400エラーを返す', async () => {
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

      const request = createMockRequest({}, {
        phrase: '',
        category: 'NG',
        notes: 'テストノート'
      })
      await POST(request)

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: 'フレーズは必須です' },
        { status: 400 }
      )
    })

    it('無効なカテゴリの場合は400エラーを返す', async () => {
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

      const request = createMockRequest({}, {
        phrase: 'テストフレーズ',
        category: 'INVALID',
        notes: 'テストノート'
      })
      await POST(request)

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: '無効なカテゴリです' },
        { status: 400 }
      )
    })

    it('管理者ユーザーは辞書項目を作成できる', async () => {
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

      const mockResponse = {
        dictionary: {
          id: 123,
          organization_id: 1,
          phrase: 'テストフレーズ',
          category: 'NG' as const,
          notes: 'テストノート',
          vector: '[]',
          created_at: '2024-01-20T10:00:00Z',
          updated_at: '2024-01-20T10:00:00Z',
        },
        warning: undefined,
      }

      mockRepositories.dictionaries.createWithEmbedding.mockResolvedValue(mockResponse)

      const request = createMockRequest({}, {
        phrase: 'テストフレーズ',
        category: 'NG',
        notes: 'テストノート'
      })
      await POST(request)

      expect(mockNextResponse.json).toHaveBeenCalledWith(mockResponse, { status: 201 })

      expect(mockRepositories.dictionaries.createWithEmbedding).toHaveBeenCalledWith({
        organization_id: 1,
        phrase: 'テストフレーズ',
        category: 'NG',
        notes: 'テストノート',
      })
    })

    it('リポジトリエラー時には500エラーを返す', async () => {
      mockAuth.getUser.mockResolvedValue({
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
        { error: 'サーバーエラーが発生しました' },
        { status: 500 }
      )
    })
  })
})