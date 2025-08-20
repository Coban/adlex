import { vi } from 'vitest'

import { RepositoryContainer } from '@/lib/repositories/interfaces'
import { OrganizationsRepository } from '@/lib/repositories/interfaces/organizations'
import { UserInvitationsRepository } from '@/lib/repositories/interfaces/user-invitations'
import { ViolationsRepository } from '@/lib/repositories/interfaces/violations'

import { MockChecksRepository } from './checks'
import { MockDictionariesRepository } from './dictionaries'
import { MockUsersRepository } from './users'

/**
 * Simple mock implementations for repositories not fully implemented yet
 */
const mockOrganizationsRepository = {
  findById: vi.fn().mockResolvedValue(null),
  findMany: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockResolvedValue({}),
  update: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(false),
  count: vi.fn().mockResolvedValue(0),
  findByPlan: vi.fn().mockResolvedValue([]),
  updateUsageCount: vi.fn().mockResolvedValue(null),
  incrementUsage: vi.fn().mockResolvedValue(null),
  hasAvailableChecks: vi.fn().mockResolvedValue(true),
  getUsageStats: vi.fn().mockResolvedValue(null),
}


const mockViolationsRepository = {
  findById: vi.fn().mockResolvedValue(null),
  findMany: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockResolvedValue({}),
  update: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(false),
  count: vi.fn().mockResolvedValue(0),
  findByCheckId: vi.fn().mockResolvedValue([]),
  findByDictionaryId: vi.fn().mockResolvedValue([]),
  countByCheckId: vi.fn().mockResolvedValue(0),
  countTotal: vi.fn().mockResolvedValue(0),
  bulkCreateForCheck: vi.fn().mockResolvedValue([]),
  deleteByCheckId: vi.fn().mockResolvedValue(true),
}

/**
 * Create mock repository container for testing
 */
export function createMockRepositories(): RepositoryContainer {
  return {
    users: new MockUsersRepository(),
    checks: new MockChecksRepository(),
    organizations: mockOrganizationsRepository as OrganizationsRepository,
    dictionaries: new MockDictionariesRepository(),
    violations: mockViolationsRepository as ViolationsRepository,
    userInvitations: {} as UserInvitationsRepository,
  }
}

// Export mock implementations
export * from './users'
export * from './checks'
export * from './dictionaries'

/**
 * Global mock repository instance for tests
 */
export const mockRepositories = createMockRepositories()