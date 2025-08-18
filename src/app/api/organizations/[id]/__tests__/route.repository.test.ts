import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

import { GET, PATCH } from '../route'
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
function createMockRequest(params: { id: string }, body?: any) {
  const request = {
    json: vi.fn().mockResolvedValue(body || {}),
  } as unknown as NextRequest
  
  return { request, params }
}

describe('Organizations [id] API Route (Repository Pattern)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Reset mock repositories
    mockRepositories.users.reset()
    
    // Mock auth and repositories
    const supabaseModule = await import('@/lib/supabase/server')
    const nextServerModule = await import('next/server')
    const repositoriesModule = await import('@/lib/repositories')
    
    vi.mocked(supabaseModule.createClient).mockReturnValue(mockSupabaseClient as any)
    vi.mocked(nextServerModule.NextResponse.json).mockImplementation(mockNextResponse.json)
    vi.mocked(repositoriesModule.getRepositories).mockResolvedValue(mockRepositories)
  })

  describe('GET /api/organizations/[id]', () => {
    it('未認証ユーザーには401エラーを返す', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Unauthorized')
      })

      const { request, params } = createMockRequest({ id: '1' })
      await GET(request, { params })

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    })

    it('無効な組織IDには400エラーを返す', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: { id: 'user-id' } },
        error: null
      })

      const { request, params } = createMockRequest({ id: 'invalid' })
      await GET(request, { params })

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: 'Invalid organization ID' },
        { status: 400 }
      )
    })

    it('ユーザープロファイルが見つからない場合は404エラーを返す', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: { id: 'user-not-found' } },
        error: null
      })

      mockRepositories.users.findById.mockResolvedValue(null)

      const { request, params } = createMockRequest({ id: '1' })
      await GET(request, { params })

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: 'User profile not found' },
        { status: 404 }
      )
    })

    it('異なる組織のユーザーには403エラーを返す', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: { id: 'user-id' } },
        error: null
      })

      mockRepositories.users.findById.mockResolvedValue({
        id: 'user-id',
        email: 'user@test.com',
        role: 'user',
        organization_id: 2, // Different organization
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      })

      const { request, params } = createMockRequest({ id: '1' })
      await GET(request, { params })

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: 'Forbidden' },
        { status: 403 }
      )
    })

    it('組織が見つからない場合は404エラーを返す', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: { id: 'user-id' } },
        error: null
      })

      mockRepositories.users.findById.mockResolvedValue({
        id: 'user-id',
        email: 'user@test.com',
        role: 'user',
        organization_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      })

      mockRepositories.organizations.findById.mockResolvedValue(null)

      const { request, params } = createMockRequest({ id: '1' })
      await GET(request, { params })

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: 'Organization not found' },
        { status: 404 }
      )
    })

    it('有効なユーザーには組織情報を返す', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: { id: 'user-id' } },
        error: null
      })

      mockRepositories.users.findById.mockResolvedValue({
        id: 'user-id',
        email: 'user@test.com',
        role: 'admin',
        organization_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      })

      const mockOrganization = {
        id: 1,
        name: 'Test Organization',
        plan: 'trial' as const,
        max_checks: 100,
        used_checks: 10,
        icon_url: null,
        logo_url: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      mockRepositories.organizations.findById.mockResolvedValue(mockOrganization)

      const { request, params } = createMockRequest({ id: '1' })
      await GET(request, { params })

      expect(mockNextResponse.json).toHaveBeenCalledWith({
        organization: mockOrganization
      })
    })
  })

  describe('PATCH /api/organizations/[id]', () => {
    it('管理者以外には403エラーを返す', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: { id: 'user-id' } },
        error: null
      })

      mockRepositories.users.findById.mockResolvedValue({
        id: 'user-id',
        email: 'user@test.com',
        role: 'user', // Not admin
        organization_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      })

      const { request, params } = createMockRequest({ id: '1' }, {
        name: 'Updated Organization Name'
      })
      await PATCH(request, { params })

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: 'Forbidden' },
        { status: 403 }
      )
    })

    it('無効な名前には400エラーを返す', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-id' } },
        error: null
      })

      mockRepositories.users.findById.mockResolvedValue({
        id: 'admin-id',
        email: 'admin@test.com',
        role: 'admin',
        organization_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      })

      const { request, params } = createMockRequest({ id: '1' }, {
        name: '' // Empty name
      })
      await PATCH(request, { params })

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: 'Name must be a non-empty string (1-100 characters)' },
        { status: 400 }
      )
    })

    it('管理者は組織情報を更新できる', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-id' } },
        error: null
      })

      mockRepositories.users.findById.mockResolvedValue({
        id: 'admin-id',
        email: 'admin@test.com',
        role: 'admin',
        organization_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      })

      const updatedOrganization = {
        id: 1,
        name: 'Updated Organization Name',
        plan: 'trial' as const,
        max_checks: 100,
        used_checks: 10,
        icon_url: 'https://example.com/icon.png',
        logo_url: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-20T10:00:00Z',
      }

      mockRepositories.organizations.update.mockResolvedValue(updatedOrganization)

      const { request, params } = createMockRequest({ id: '1' }, {
        name: 'Updated Organization Name',
        icon_url: 'https://example.com/icon.png'
      })
      await PATCH(request, { params })

      expect(mockRepositories.organizations.update).toHaveBeenCalledWith(1, expect.objectContaining({
        name: 'Updated Organization Name',
        icon_url: 'https://example.com/icon.png',
        updated_at: expect.any(String)
      }))

      expect(mockNextResponse.json).toHaveBeenCalledWith({
        organization: updatedOrganization
      })
    })

    it('組織の更新に失敗した場合は500エラーを返す', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-id' } },
        error: null
      })

      mockRepositories.users.findById.mockResolvedValue({
        id: 'admin-id',
        email: 'admin@test.com',
        role: 'admin',
        organization_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      })

      mockRepositories.organizations.update.mockResolvedValue(null)

      const { request, params } = createMockRequest({ id: '1' }, {
        name: 'Updated Organization Name'
      })
      await PATCH(request, { params })

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: 'Failed to update organization' },
        { status: 500 }
      )
    })
  })
})