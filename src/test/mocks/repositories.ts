import { vi } from 'vitest'
import type { 
  UsersRepository,
  OrganizationsRepository,
  ChecksRepository,
  DictionariesRepository,
  ViolationsRepository,
  UserInvitationsRepository
} from '@/lib/repositories/interfaces'

/**
 * モック化されたリポジトリインスタンスを作成する
 * テスト用のデフォルト実装を提供
 */
export function createMockRepositories() {
  // Users Repository Mock
  const usersRepository: UsersRepository = {
    findById: vi.fn().mockResolvedValue(null),
    findByEmail: vi.fn().mockResolvedValue(null),
    findByOrganizationId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(true),
    count: vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
    updateRole: vi.fn().mockResolvedValue(null),
    isAdmin: vi.fn().mockResolvedValue(false),
    findOne: vi.fn().mockResolvedValue(null),
  }

  // Organizations Repository Mock
  const organizationsRepository: OrganizationsRepository = {
    findById: vi.fn().mockResolvedValue(null),
    findByUserId: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(true),
    count: vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
    incrementUsedChecks: vi.fn().mockResolvedValue(null),
    resetUsedChecks: vi.fn().mockResolvedValue(null),
    findOne: vi.fn().mockResolvedValue(null),
  }

  // Checks Repository Mock
  const checksRepository: ChecksRepository = {
    findById: vi.fn().mockResolvedValue(null),
    findByOrganizationId: vi.fn().mockResolvedValue([]),
    findByUserId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(true),
    count: vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
    findByIdWithDetailedViolations: vi.fn().mockResolvedValue(null),
    logicalDelete: vi.fn().mockResolvedValue(null),
    searchChecks: vi.fn().mockResolvedValue({ checks: [], total: 0 }),
    getStats: vi.fn().mockResolvedValue({
      totalChecks: 0,
      checksThisMonth: 0,
      errorRate: 0,
      recentChecks: []
    }),
    countActiveUsers: vi.fn().mockResolvedValue(0),
    countByDateRange: vi.fn().mockResolvedValue(0),
    getPerformanceMetrics: vi.fn().mockResolvedValue({
      avgProcessingTime: 0,
      maxProcessingTime: 0,
      minProcessingTime: 0,
      totalChecks24h: 0,
      successRate: 0,
      errorRate: 0,
      statusBreakdown: {},
      hourlyActivity: []
    }),
    findOne: vi.fn().mockResolvedValue(null),
  }

  // Dictionaries Repository Mock
  const dictionariesRepository: DictionariesRepository = {
    findById: vi.fn().mockResolvedValue(null),
    findByOrganizationId: vi.fn().mockResolvedValue([]),
    findByCategory: vi.fn().mockResolvedValue([]),
    findByOrganizationAndCategory: vi.fn().mockResolvedValue([]),
    searchByPhrase: vi.fn().mockResolvedValue([]),
    searchDictionaries: vi.fn().mockResolvedValue([]),
    findSimilarPhrases: vi.fn().mockResolvedValue([]),
    countByOrganizationId: vi.fn().mockResolvedValue(0),
    countByCategory: vi.fn().mockResolvedValue(0),
    bulkCreate: vi.fn().mockResolvedValue([]),
    updateVector: vi.fn().mockResolvedValue(null),
    createWithEmbedding: vi.fn().mockResolvedValue({ 
      dictionary: null as any,
      warning: undefined 
    }),
    updateWithEmbedding: vi.fn().mockResolvedValue({ 
      dictionary: null as any,
      warning: undefined 
    }),
    findByIdAndOrganization: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(true),
    count: vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
  }

  // Violations Repository Mock
  const violationsRepository: ViolationsRepository = {
    findById: vi.fn().mockResolvedValue(null),
    findByCheckId: vi.fn().mockResolvedValue([]),
    findByDictionaryId: vi.fn().mockResolvedValue([]),
    bulkCreate: vi.fn().mockResolvedValue([]),
    countByCheckId: vi.fn().mockResolvedValue(0),
    countTotal: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(true),
    count: vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
  }

  // User Invitations Repository Mock
  const userInvitationsRepository: UserInvitationsRepository = {
    findById: vi.fn().mockResolvedValue(null),
    findByOrganizationId: vi.fn().mockResolvedValue([]),
    findByEmailAndOrganization: vi.fn().mockResolvedValue(null),
    findActiveInvitationByEmail: vi.fn().mockResolvedValue(null),
    findByToken: vi.fn().mockResolvedValue(null),
    acceptInvitation: vi.fn().mockResolvedValue(null),
    isInvitationValid: vi.fn().mockReturnValue(false),
    countPendingByOrganization: vi.fn().mockResolvedValue(0),
    deleteExpiredInvitations: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(true),
    count: vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
  }

  return {
    users: usersRepository,
    organizations: organizationsRepository,
    checks: checksRepository,
    dictionaries: dictionariesRepository,
    violations: violationsRepository,
    userInvitations: userInvitationsRepository,
  }
}

/**
 * リポジトリプロバイダーをモック化する
 * これにより、getRepositories() 呼び出しがモックされたリポジトリを返す
 */
export function mockRepositories(customMocks?: Partial<ReturnType<typeof createMockRepositories>>) {
  const defaultMocks = createMockRepositories()
  const repositories = {
    ...defaultMocks,
    ...customMocks
  }
  
  return repositories
}

/**
 * 特定のリポジトリメソッドにカスタム実装を設定するヘルパー
 */
export function setupRepositoryMock<T extends keyof ReturnType<typeof createMockRepositories>>(
  repositories: ReturnType<typeof createMockRepositories>,
  repositoryName: T,
  methodName: keyof ReturnType<typeof createMockRepositories>[T],
  implementation: any
) {
  const repository = repositories[repositoryName] as any
  if (repository[methodName]) {
    repository[methodName].mockImplementation(implementation)
  }
}

/**
 * 一般的なテストシナリオ用のプリセット
 */
export const repositoryPresets = {
  // 認証済みユーザーのプリセット
  authenticatedUser: (userId = 'user-123', organizationId = 1) => ({
    users: {
      findById: vi.fn().mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        organization_id: organizationId,
        role: 'user' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    },
    organizations: {
      findById: vi.fn().mockResolvedValue({
        id: organizationId,
        name: 'Test Organization',
        max_checks: 1000,
        used_checks: 10,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }
  }),

  // 管理者ユーザーのプリセット
  adminUser: (userId = 'admin-123', organizationId = 1) => ({
    users: {
      findById: vi.fn().mockResolvedValue({
        id: userId,
        email: 'admin@example.com',
        organization_id: organizationId,
        role: 'admin' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      isAdmin: vi.fn().mockResolvedValue(true)
    }
  }),

  // チェック作成成功のプリセット
  successfulCheckCreation: (checkId = 1) => ({
    checks: {
      create: vi.fn().mockResolvedValue({
        id: checkId,
        status: 'pending',
        original_text: 'Test text',
        created_at: new Date().toISOString(),
      })
    }
  }),

  // 使用制限超過のプリセット
  usageLimitExceeded: (organizationId = 1) => ({
    organizations: {
      findById: vi.fn().mockResolvedValue({
        id: organizationId,
        name: 'Test Organization',
        max_checks: 100,
        used_checks: 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }
  })
}