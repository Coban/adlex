import { describe, it, expect, vi, beforeEach } from 'vitest'

import { UpdateOrganizationUseCase } from '@/core/usecases/organizations/updateOrganization'
import { AuthenticationError, AuthorizationError, ValidationError } from '@/core/domain/errors'
import type { RepositoryContainer } from '@/core/ports'

// モックデータ
const mockAdminUser = {
  id: 'admin123',
  email: 'admin@example.com',
  organization_id: 456,
  role: 'admin' as const,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
}

const mockRegularUser = {
  id: 'user123',
  email: 'user@example.com',
  organization_id: 456,
  role: 'user' as const,
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

const mockUpdatedOrganization = {
  ...mockOrganization,
  name: '更新された組織',
  plan: 'trial' as const,
  max_checks: 500,
  updated_at: '2024-01-03T00:00:00Z',
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

describe('UpdateOrganizationUseCase', () => {
  let useCase: UpdateOrganizationUseCase

  beforeEach(() => {
    vi.clearAllMocks()
    useCase = new UpdateOrganizationUseCase(mockRepositories)

    // デフォルトのモック戻り値を設定
    vi.mocked(mockRepositories.users.findById).mockResolvedValue(mockAdminUser)
    vi.mocked(mockRepositories.organizations.findById).mockResolvedValue(mockOrganization)
    vi.mocked(mockRepositories.organizations.update).mockResolvedValue(mockUpdatedOrganization)
  })

  describe('execute', () => {
    const validInput = {
      currentUserId: 'admin123',
      organizationId: '456',
      updates: {
        name: '更新された組織',
        plan: 'trial' as const
      }
    }

    it('正常な組織更新ができること', async () => {
      const result = await useCase.execute(validInput)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          id: '456',
          name: '更新された組織',
          plan: 'trial',
          max_users: 500,
          max_checks_per_month: 500,
          message: '組織情報を更新しました'
        })
      }

      expect(vi.mocked(mockRepositories.organizations.update)).toHaveBeenCalledWith(
        456,
        {
          name: '更新された組織',
          plan: 'trial'
        }
      )
    })

    it('全てのフィールドを更新できること', async () => {
      const fullUpdateInput = {
        currentUserId: 'admin123',
        organizationId: '456',
        updates: {
          name: '新しい組織名',
          plan: 'basic' as const,
          max_users: 50,
          max_checks_per_month: 2000
        }
      }

      const result = await useCase.execute(fullUpdateInput)

      expect(result.success).toBe(true)
      expect(vi.mocked(mockRepositories.organizations.update)).toHaveBeenCalledWith(
        456,
        {
          name: '新しい組織名',
          plan: 'basic',
          max_users: 50,
          max_checks_per_month: 2000
        }
      )
    })

    it('無効なユーザーIDでバリデーションエラーになること', async () => {
      const invalidInput = {
        ...validInput,
        currentUserId: ''
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
        ...validInput,
        organizationId: ''
      }

      const result = await useCase.execute(invalidInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('組織IDが無効です')
      }
    })

    it('空の更新データでバリデーションエラーになること', async () => {
      const invalidInput = {
        ...validInput,
        updates: {}
      }

      const result = await useCase.execute(invalidInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('更新するフィールドを指定してください')
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
        ...mockAdminUser,
        organization_id: null,
        updated_at: '2024-01-01T00:00:00Z'
      }
      vi.mocked(mockRepositories.users.findById).mockResolvedValue(userWithoutOrg)

      const result = await useCase.execute(validInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('AUTHENTICATION_ERROR')
        expect(result.error.message).toBe('ユーザーが組織に所属していません')
      }
    })

    it('管理者権限のないユーザーで認可エラーになること', async () => {
      vi.mocked(mockRepositories.users.findById).mockResolvedValue(mockRegularUser)

      const result = await useCase.execute(validInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('AUTHORIZATION_ERROR')
        expect(result.error.message).toBe('管理者権限が必要です')
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
        ...mockAdminUser,
        organization_id: 999,
        updated_at: '2024-01-01T00:00:00Z'
      }
      vi.mocked(mockRepositories.users.findById).mockResolvedValue(userFromDifferentOrg)

      const result = await useCase.execute(validInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('AUTHORIZATION_ERROR')
        expect(result.error.message).toBe('この組織を更新する権限がありません')
      }
    })

    it('組織の更新に失敗した場合REPOSITORY_ERRORになること', async () => {
      vi.mocked(mockRepositories.organizations.update).mockResolvedValue(null)

      const result = await useCase.execute(validInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('REPOSITORY_ERROR')
        expect(result.error.message).toBe('組織の更新に失敗しました')
      }
    })

    it('ValidationErrorが投げられた場合適切にハンドルすること', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      vi.mocked(mockRepositories.organizations.update).mockRejectedValue(
        new ValidationError('バリデーションエラーテスト')
      )

      const result = await useCase.execute(validInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('バリデーションエラーテスト')
      }
      
      consoleSpy.mockRestore()
    })

    it('予期しないエラーの場合INTERNAL_ERRORになること', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      vi.mocked(mockRepositories.organizations.update).mockRejectedValue(
        new Error('予期しないエラー')
      )

      const result = await useCase.execute(validInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('INTERNAL_ERROR')
        expect(result.error.message).toBe('内部エラーが発生しました')
      }
      
      consoleSpy.mockRestore()
    })
  })

  describe('validateInput', () => {
    it('有効な入力でnullを返すこと', () => {
      const validInput = {
        currentUserId: 'admin123',
        organizationId: '456',
        updates: {
          name: 'テスト組織'
        }
      }

      const result = (useCase as any).validateInput(validInput)
      expect(result).toBeNull()
    })

    it('組織名のバリデーション - 空文字列でエラー', () => {
      const invalidInput = {
        currentUserId: 'admin123',
        organizationId: '456',
        updates: {
          name: ''
        }
      }

      const result = (useCase as any).validateInput(invalidInput)
      expect(result).toBe('組織名は1文字以上である必要があります')
    })

    it('組織名のバリデーション - 空白のみでエラー', () => {
      const invalidInput = {
        currentUserId: 'admin123',
        organizationId: '456',
        updates: {
          name: '   '
        }
      }

      const result = (useCase as any).validateInput(invalidInput)
      expect(result).toBe('組織名は1文字以上である必要があります')
    })

    it('組織名のバリデーション - 100文字超過でエラー', () => {
      const longName = 'あ'.repeat(101)
      const invalidInput = {
        currentUserId: 'admin123',
        organizationId: '456',
        updates: {
          name: longName
        }
      }

      const result = (useCase as any).validateInput(invalidInput)
      expect(result).toBe('組織名は100文字以下である必要があります')
    })

    it('プランのバリデーション - 無効な値でエラー', () => {
      const invalidInput = {
        currentUserId: 'admin123',
        organizationId: '456',
        updates: {
          plan: 'premium' as any
        }
      }

      const result = (useCase as any).validateInput(invalidInput)
      expect(result).toBe('プランは "trial" または "basic" である必要があります')
    })

    it('最大ユーザー数のバリデーション - 負の数でエラー', () => {
      const invalidInput = {
        currentUserId: 'admin123',
        organizationId: '456',
        updates: {
          max_users: -1
        }
      }

      const result = (useCase as any).validateInput(invalidInput)
      expect(result).toBe('最大ユーザー数は正の整数である必要があります')
    })

    it('最大ユーザー数のバリデーション - 小数でエラー', () => {
      const invalidInput = {
        currentUserId: 'admin123',
        organizationId: '456',
        updates: {
          max_users: 10.5
        }
      }

      const result = (useCase as any).validateInput(invalidInput)
      expect(result).toBe('最大ユーザー数は正の整数である必要があります')
    })

    it('月間最大チェック数のバリデーション - 負の数でエラー', () => {
      const invalidInput = {
        currentUserId: 'admin123',
        organizationId: '456',
        updates: {
          max_checks_per_month: -100
        }
      }

      const result = (useCase as any).validateInput(invalidInput)
      expect(result).toBe('月間最大チェック数は正の整数である必要があります')
    })

    it('月間最大チェック数のバリデーション - 小数でエラー', () => {
      const invalidInput = {
        currentUserId: 'admin123',
        organizationId: '456',
        updates: {
          max_checks_per_month: 1000.1
        }
      }

      const result = (useCase as any).validateInput(invalidInput)
      expect(result).toBe('月間最大チェック数は正の整数である必要があります')
    })

    it('更新データが空オブジェクトでエラー', () => {
      const invalidInput = {
        currentUserId: 'admin123',
        organizationId: '456',
        updates: {}
      }

      const result = (useCase as any).validateInput(invalidInput)
      expect(result).toBe('更新するフィールドを指定してください')
    })

    it('更新データがnullでエラー', () => {
      const invalidInput = {
        currentUserId: 'admin123',
        organizationId: '456',
        updates: null
      }

      const result = (useCase as any).validateInput(invalidInput)
      expect(result).toBe('更新データが無効です')
    })
  })
})