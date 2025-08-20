import { vi } from 'vitest'

import { RepositoryContainer } from '@/core/ports'
import { OrganizationsRepository } from '@/core/ports/organizations'
import { RealtimeRepository } from '@/core/ports/realtimeRepository'
import { UserInvitationsRepository } from '@/core/ports/user-invitations'
import { ViolationsRepository } from '@/core/ports/violations'

import { MockChecksRepository } from './checks'
import { MockDictionariesRepository } from './dictionaries'
import { MockUsersRepository } from './users'
import { MockAuthRepository } from './auth'

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

const mockRealtimeRepository = {
  subscribeToCheckUpdates: vi.fn().mockResolvedValue({ success: true }),
  unsubscribe: vi.fn(),
  getFinalCheckData: vi.fn().mockResolvedValue(null),
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
    realtime: mockRealtimeRepository as RealtimeRepository,
    auth: new MockAuthRepository(),
  }
}

// Export mock implementations
export * from './users'
export * from './checks'
export * from './dictionaries'
export * from './auth'

/**
 * Global mock repository instance for tests
 */
export const mockRepositories = createMockRepositories()