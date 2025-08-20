import { describe, it, expect, vi, beforeEach } from 'vitest'

import { GetOrganizationUseCase } from '@/core/usecases/organizations/getOrganization'
import { AuthenticationError, AuthorizationError } from '@/core/domain/errors'
import type { RepositoryContainer } from '@/core/ports'

// モックデータ
const mockUser = {
  id: 'user123',
  email: 'test@example.com',
  organization_id: 456,
  role: 'admin' as const,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
}

const mockOrganization = {
  id: 456,
  name: 'テスト組織',
  plan: 'basic' as const,
  max_checks: 1000,
  icon_url: null,
  logo_url: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
  trial_ends_at: null,
  used_checks: null
}

// モックRepositoryContainer
const mockRepositories = {
  users: {
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    findByEmail: vi.fn(),
    findByOrganizationId: vi.fn(),
    findByIdWithOrganization: vi.fn(),
    findByRole: vi.fn(),
    findAdmins: vi.fn(),
    updateRole: vi.fn(),
    isAdmin: vi.fn()
  },
  organizations: {
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByPlan: vi.fn(),
    updateUsageCount: vi.fn(),
    incrementUsage: vi.fn(),
    hasAvailableChecks: vi.fn(),
    getUsageStats: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn()
  },
  checks: {
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    findByIdWithDetailedViolations: vi.fn(),
    findByUserId: vi.fn(),
    findByOrganizationId: vi.fn(),
    findByStatus: vi.fn(),
    searchChecks: vi.fn(),
    findRecentWithUsers: vi.fn(),
    getStats: vi.fn(),
    getPerformanceMetrics: vi.fn(),
    countByDateRange: vi.fn(),
    countByStatus: vi.fn(),
    countActiveUsers: vi.fn(),
    logicalDelete: vi.fn()
  },
  dictionaries: {
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByOrganizationId: vi.fn(),
    bulkCreate: vi.fn(),
    updateWithEmbedding: vi.fn(),
    search: vi.fn()
  },
  violations: {
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByCheckId: vi.fn()
  },
  userInvitations: {
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  realtime: {
    subscribeToCheckUpdates: vi.fn(),
    unsubscribe: vi.fn(),
    getFinalCheckData: vi.fn()
  }
} as unknown as RepositoryContainer

describe('GetOrganizationUseCase', () => {
  let useCase: GetOrganizationUseCase

  beforeEach(() => {
    vi.clearAllMocks()
    useCase = new GetOrganizationUseCase(mockRepositories)

    // デフォルトのモック戻り値を設定
    vi.mocked(mockRepositories.users.findById).mockResolvedValue(mockUser)
    vi.mocked(mockRepositories.organizations.findById).mockResolvedValue(mockOrganization)
  })

  describe('execute', () => {
    const validInput = {
      currentUserId: 'user123',
      organizationId: '456'
    }

    it('正常な組織取得ができること', async () => {
      const result = await useCase.execute(validInput)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          id: '456',
          name: 'テスト組織',
          plan: 'basic',
          max_users: 1000,
          max_checks_per_month: 1000,
          icon_url: null,
          logo_url: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z'
        })
      }
    })

    it('無効なユーザーIDでバリデーションエラーになること', async () => {
      const invalidInput = {
        currentUserId: '',
        organizationId: '456'
      }

      const result = await useCase.execute(invalidInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('ユーザーIDが無効です')
      }
    })

    it('無効な組織IDでバリデーションエラーになること', async () => {
      const invalidInput = {
        currentUserId: 'user123',
        organizationId: ''
      }

      const result = await useCase.execute(invalidInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('組織IDが無効です')
      }
    })

    it('存在しないユーザーで認証エラーになること', async () => {
      vi.mocked(mockRepositories.users.findById).mockResolvedValue(null)

      const result = await useCase.execute(validInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('AUTHENTICATION_ERROR')
        expect(result.error.message).toBe('ユーザーが見つかりません')
      }
    })

    it('組織に所属していないユーザーで認証エラーになること', async () => {
      const userWithoutOrg = {
        ...mockUser,
        organization_id: null
      }
      vi.mocked(mockRepositories.users.findById).mockResolvedValue(userWithoutOrg)

      const result = await useCase.execute(validInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('AUTHENTICATION_ERROR')
        expect(result.error.message).toBe('ユーザーが組織に所属していません')
      }
    })

    it('存在しない組織でNOT_FOUND_ERRORになること', async () => {
      vi.mocked(mockRepositories.organizations.findById).mockResolvedValue(null)

      const result = await useCase.execute(validInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND_ERROR')
        expect(result.error.message).toBe('組織が見つかりません')
      }
    })

    it('異なる組織のユーザーで認可エラーになること', async () => {
      const userFromDifferentOrg = {
        ...mockUser,
        organization_id: 999
      }
      vi.mocked(mockRepositories.users.findById).mockResolvedValue(userFromDifferentOrg)

      const result = await useCase.execute(validInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('AUTHORIZATION_ERROR')
        expect(result.error.message).toBe('この組織を参照する権限がありません')
      }
    })

    it('プランがnullの場合trialをデフォルトとすること', async () => {
      const orgWithoutPlan = {
        ...mockOrganization,
        plan: null,
        trial_ends_at: null,
        used_checks: null
      }
      vi.mocked(mockRepositories.organizations.findById).mockResolvedValue(orgWithoutPlan)

      const result = await useCase.execute(validInput)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.plan).toBe('trial')
      }
    })

    it('max_checksがnullの場合デフォルト値を使用すること', async () => {
      const orgWithoutMaxChecks = {
        ...mockOrganization,
        max_checks: null,
        trial_ends_at: null,
        used_checks: null
      }
      vi.mocked(mockRepositories.organizations.findById).mockResolvedValue(orgWithoutMaxChecks)

      const result = await useCase.execute(validInput)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.max_users).toBe(10)
        expect(result.data.max_checks_per_month).toBe(1000)
      }
    })

    it('created_atがnullの場合現在時刻を使用すること', async () => {
      const orgWithoutCreatedAt = {
        ...mockOrganization,
        created_at: null,
        trial_ends_at: null,
        used_checks: null
      }
      vi.mocked(mockRepositories.organizations.findById).mockResolvedValue(orgWithoutCreatedAt)

      const result = await useCase.execute(validInput)

      expect(result.success).toBe(true)
      if (result.success) {
        // 現在時刻に近い値であることを確認
        const createdAt = new Date(result.data.created_at)
        const now = new Date()
        const diff = Math.abs(now.getTime() - createdAt.getTime())
        expect(diff).toBeLessThan(5000) // 5秒以内
      }
    })

    it('AuthenticationErrorが投げられた場合適切にハンドルすること', async () => {
      vi.mocked(mockRepositories.users.findById).mockRejectedValue(
        new AuthenticationError('認証エラーテスト')
      )

      const result = await useCase.execute(validInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('AUTHENTICATION_ERROR')
        expect(result.error.message).toBe('認証エラーテスト')
      }
    })

    it('AuthorizationErrorが投げられた場合適切にハンドルすること', async () => {
      vi.mocked(mockRepositories.organizations.findById).mockRejectedValue(
        new AuthorizationError('認可エラーテスト')
      )

      const result = await useCase.execute(validInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('AUTHORIZATION_ERROR')
        expect(result.error.message).toBe('認可エラーテスト')
      }
    })

    it('予期しないエラーの場合INTERNAL_ERRORになること', async () => {
      vi.mocked(mockRepositories.organizations.findById).mockRejectedValue(
        new Error('予期しないエラー')
      )

      const result = await useCase.execute(validInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('INTERNAL_ERROR')
        expect(result.error.message).toBe('内部エラーが発生しました')
      }
    })
  })

  describe('validateInput', () => {
    it('有効な入力でnullを返すこと', () => {
      const validInput = {
        currentUserId: 'user123',
        organizationId: '456'
      }

      const result = (useCase as any).validateInput(validInput)
      expect(result).toBeNull()
    })

    it('currentUserIdが空文字列でエラーメッセージを返すこと', () => {
      const invalidInput = {
        currentUserId: '',
        organizationId: '456'
      }

      const result = (useCase as any).validateInput(invalidInput)
      expect(result).toBe('ユーザーIDが無効です')
    })

    it('currentUserIdが数値型でエラーメッセージを返すこと', () => {
      const invalidInput = {
        currentUserId: 123,
        organizationId: '456'
      }

      const result = (useCase as any).validateInput(invalidInput)
      expect(result).toBe('ユーザーIDが無効です')
    })

    it('organizationIdが空文字列でエラーメッセージを返すこと', () => {
      const invalidInput = {
        currentUserId: 'user123',
        organizationId: ''
      }

      const result = (useCase as any).validateInput(invalidInput)
      expect(result).toBe('組織IDが無効です')
    })

    it('organizationIdが数値型でエラーメッセージを返すこと', () => {
      const invalidInput = {
        currentUserId: 'user123',
        organizationId: 456
      }

      const result = (useCase as any).validateInput(invalidInput)
      expect(result).toBe('組織IDが無効です')
    })
  })
})