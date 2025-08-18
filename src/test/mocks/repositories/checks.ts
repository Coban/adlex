import { vi } from 'vitest'

import { FindManyOptions } from '@/lib/repositories/interfaces/base'
import {
  Check,
  CheckInsert,
  CheckUpdate,
  CheckStatus,
  CheckStats,
  CheckWithUser,
  CheckPerformanceMetrics,
  CheckSearchOptions,
  CheckSearchResult,
  CheckWithViolations,
  ChecksRepository,
} from '@/lib/repositories/interfaces/checks'

/**
 * Mock implementation of ChecksRepository for testing
 */
export class MockChecksRepository implements ChecksRepository {
  // Mock data storage
  private checks: Check[] = [
    {
      id: 1,
      user_id: '00000000-0000-0000-0000-000000000001',
      organization_id: 1,
      original_text: 'がんが治るサプリメント',
      modified_text: '健康をサポートするサプリメント',
      status: 'completed',
      input_type: 'text',
      created_at: '2024-01-20T10:00:00Z',
      completed_at: '2024-01-20T10:02:30Z',
      deleted_at: null,
      error_message: null,
      extracted_text: null,
      image_url: null,
      ocr_metadata: null,
      ocr_status: null,
    },
    {
      id: 2,
      user_id: '00000000-0000-0000-0000-000000000002',
      organization_id: 1,
      original_text: '血圧が下がる薬',
      modified_text: '血圧管理をサポートする健康食品',
      status: 'completed',
      input_type: 'text',
      created_at: '2024-01-20T09:00:00Z',
      completed_at: '2024-01-20T09:01:45Z',
      deleted_at: null,
      error_message: null,
      extracted_text: null,
      image_url: null,
      ocr_metadata: null,
      ocr_status: null,
    },
    {
      id: 3,
      user_id: '00000000-0000-0000-0000-000000000001',
      organization_id: 1,
      original_text: 'テストメッセージ',
      modified_text: null,
      status: 'failed',
      input_type: 'text',
      created_at: '2024-01-20T08:00:00Z',
      completed_at: null,
      deleted_at: null,
      error_message: 'Processing failed',
      extracted_text: null,
      image_url: null,
      ocr_metadata: null,
      ocr_status: null,
    },
  ]

  private checksWithUsers: CheckWithUser[] = [
    {
      id: 1,
      user_id: '00000000-0000-0000-0000-000000000001',
      organization_id: 1,
      original_text: 'がんが治るサプリメント',
      modified_text: '健康をサポートするサプリメント',
      status: 'completed',
      input_type: 'text',
      created_at: '2024-01-20T10:00:00Z',
      completed_at: '2024-01-20T10:02:30Z',
      deleted_at: null,
      error_message: null,
      extracted_text: null,
      image_url: null,
      ocr_metadata: null,
      ocr_status: null,
      users: {
        display_name: 'Admin User',
        email: 'admin@test.com',
      },
    },
  ]

  // Spy on methods for testing
  findById = vi.fn(async (id: number): Promise<Check | null> => {
    return this.checks.find(check => check.id === id) || null
  })

  findMany = vi.fn(async (options?: FindManyOptions<Check>): Promise<Check[]> => {
    let result = [...this.checks]

    if (options?.where) {
      result = result.filter(check => {
        return Object.entries(options.where!).every(([key, value]) => {
          return check[key as keyof Check] === value
        })
      })
    }

    if (options?.orderBy) {
      result.sort((a, b) => {
        for (const { field, direction } of options.orderBy!) {
          const aVal = a[field as keyof Check]
          const bVal = b[field as keyof Check]
          
          if (aVal === null || aVal === undefined) return 1
          if (bVal === null || bVal === undefined) return -1
          
          const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
          if (comparison !== 0) {
            return direction === 'asc' ? comparison : -comparison
          }
        }
        return 0
      })
    }

    if (options?.limit) {
      result = result.slice(0, options.limit)
    }

    return result
  })

  create = vi.fn(async (data: CheckInsert): Promise<Check> => {
    const newCheck: Check = {
      id: Date.now(),
      user_id: data.user_id,
      organization_id: data.organization_id,
      original_text: data.original_text,
      modified_text: data.modified_text || null,
      status: (data.status as any) || 'pending',
      input_type: data.input_type || 'text',
      created_at: new Date().toISOString(),
      completed_at: data.completed_at || null,
      deleted_at: null,
      error_message: null,
      extracted_text: null,
      image_url: null,
      ocr_metadata: null,
      ocr_status: null,
    }
    this.checks.push(newCheck)
    return newCheck
  })

  update = vi.fn(async (id: number, data: CheckUpdate): Promise<Check | null> => {
    const checkIndex = this.checks.findIndex(check => check.id === id)
    if (checkIndex === -1) return null

    this.checks[checkIndex] = {
      ...this.checks[checkIndex],
      ...data,
    }
    return this.checks[checkIndex]
  })

  delete = vi.fn(async (id: number): Promise<boolean> => {
    const initialLength = this.checks.length
    this.checks = this.checks.filter(check => check.id !== id)
    return this.checks.length < initialLength
  })

  count = vi.fn(async (filter?: Partial<Check>): Promise<number> => {
    if (!filter) return this.checks.length

    return this.checks.filter(check => {
      return Object.entries(filter).every(([key, value]) => {
        return check[key as keyof Check] === value
      })
    }).length
  })

  findByUserId = vi.fn(async (userId: string, options?: FindManyOptions<Check>): Promise<Check[]> => {
    return this.findMany({ ...options, where: { ...options?.where, user_id: userId } })
  })

  findByOrganizationId = vi.fn(async (organizationId: number, options?: FindManyOptions<Check>): Promise<Check[]> => {
    return this.findMany({ ...options, where: { ...options?.where, organization_id: organizationId } })
  })

  findByStatus = vi.fn(async (status: CheckStatus, options?: FindManyOptions<Check>): Promise<Check[]> => {
    return this.findMany({ ...options, where: { ...options?.where, status } })
  })

  searchChecks = vi.fn(async (searchOptions: CheckSearchOptions): Promise<CheckSearchResult> => {
    const {
      userId,
      organizationId,
      search,
      status,
      inputType,
      dateFilter,
      page = 1,
      limit = 20,
    } = searchOptions

    let filteredChecks = this.checks.filter(check => {
      // Organization filter
      if (check.organization_id !== organizationId) return false

      // User filter
      if (userId && check.user_id !== userId) return false

      // Search filter
      if (search && !check.original_text?.includes(search)) return false

      // Status filter
      if (status && check.status !== status) return false

      // Input type filter
      if (inputType && check.input_type !== inputType) return false

      // Date filter
      if (dateFilter && check.created_at) {
        const checkDate = new Date(check.created_at)
        const now = new Date()

        switch (dateFilter) {
          case 'today':
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            if (checkDate < today) return false
            break
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            if (checkDate < weekAgo) return false
            break
          case 'month':
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
            if (checkDate < monthStart) return false
            break
        }
      }

      return true
    })

    // Sort by created_at desc
    filteredChecks.sort((a, b) => {
      if (!a.created_at || !b.created_at) return 0
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    // Pagination
    const total = filteredChecks.length
    const totalPages = Math.ceil(total / limit)
    const offset = (page - 1) * limit
    const paginatedChecks = filteredChecks.slice(offset, offset + limit)

    // Convert to CheckWithViolations format
    const checksWithViolations: CheckWithViolations[] = paginatedChecks.map(check => ({
      ...check,
      users: { email: 'user@test.com' },
      violations: [{ id: 1 }, { id: 2 }], // Mock violations
    }))

    return {
      checks: checksWithViolations,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    }
  })

  findRecentWithUsers = vi.fn(async (limit = 5): Promise<CheckWithUser[]> => {
    return this.checksWithUsers.slice(0, limit)
  })

  getStats = vi.fn(async (): Promise<CheckStats> => {
    const totalChecks = this.checks.length
    const checksThisMonth = this.checks.filter(check => {
      const checkDate = new Date(check.created_at!)
      const now = new Date()
      return checkDate.getMonth() === now.getMonth() && checkDate.getFullYear() === now.getFullYear()
    }).length

    const processingTimes = this.checks
      .filter(check => check.status === 'completed' && check.completed_at && check.created_at)
      .map(check => {
        const start = new Date(check.created_at!).getTime()
        const end = new Date(check.completed_at!).getTime()
        return (end - start) / 1000
      })

    const statusCounts = this.checks.reduce((acc: Record<string, number>, check) => {
      const status = check.status ?? 'unknown'
      acc[status] = (acc[status] ?? 0) + 1
      return acc
    }, {})

    const errorRate = totalChecks > 0
      ? (this.checks.filter(c => c.status === 'failed').length / totalChecks) * 100
      : 0

    return {
      totalChecks,
      checksThisMonth,
      recentChecks: this.checksWithUsers.slice(0, 5),
      processingTimes,
      statusCounts,
      hourlyActivity: Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, count: 0 })),
      errorRate,
    }
  })

  getPerformanceMetrics = vi.fn(async (): Promise<CheckPerformanceMetrics> => {
    const processingTimes = this.checks
      .filter(check => check.status === 'completed' && check.completed_at && check.created_at)
      .map(check => {
        const start = new Date(check.created_at!).getTime()
        const end = new Date(check.completed_at!).getTime()
        return (end - start) / 1000
      })

    const avgProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      : 0

    const maxProcessingTime = processingTimes.length > 0 ? Math.max(...processingTimes) : 0
    const minProcessingTime = processingTimes.length > 0 ? Math.min(...processingTimes) : 0

    const statusBreakdown = this.checks.reduce((acc: Record<string, number>, check) => {
      const status = check.status ?? 'unknown'
      acc[status] = (acc[status] ?? 0) + 1
      return acc
    }, {})

    const totalChecks = this.checks.length
    const successRate = statusBreakdown.completed ? (statusBreakdown.completed / totalChecks) * 100 : 0
    const errorRate = statusBreakdown.error ? (statusBreakdown.error / totalChecks) * 100 : 0

    return {
      avgProcessingTime,
      maxProcessingTime,
      minProcessingTime,
      totalChecks24h: totalChecks,
      successRate,
      errorRate,
      statusBreakdown,
      hourlyActivity: Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, count: 0 })),
    }
  })

  countByDateRange = vi.fn(async (startDate: string, endDate: string): Promise<number> => {
    return this.checks.filter(check => {
      const checkDate = check.created_at!
      return checkDate >= startDate && checkDate <= endDate
    }).length
  })

  countByStatus = vi.fn(async (): Promise<Record<string, number>> => {
    return this.checks.reduce((acc: Record<string, number>, check) => {
      const status = check.status ?? 'unknown'
      acc[status] = (acc[status] ?? 0) + 1
      return acc
    }, {})
  })

  countActiveUsers = vi.fn(async (days = 30): Promise<number> => {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const uniqueUsers = new Set(
      this.checks
        .filter(check => check.created_at! >= startDate)
        .map(check => check.user_id)
    )
    return uniqueUsers.size
  })

  // Helper methods for test setup
  setMockChecks(checks: Check[]) {
    this.checks = [...checks]
  }

  setMockChecksWithUsers(checks: CheckWithUser[]) {
    this.checksWithUsers = [...checks]
  }

  reset() {
    vi.clearAllMocks()
    // Reset to default data
    this.checks = [
      {
        id: 1,
        user_id: '00000000-0000-0000-0000-000000000001',
        organization_id: 1,
        original_text: 'がんが治るサプリメント',
        modified_text: '健康をサポートするサプリメント',
        status: 'completed',
        input_type: 'text',
        created_at: '2024-01-20T10:00:00Z',
        completed_at: '2024-01-20T10:02:30Z',
        deleted_at: null,
        error_message: null,
        extracted_text: null,
        image_url: null,
        ocr_metadata: null,
        ocr_status: null,
      },
    ]
  }
}