import { Database } from '@/types/database.types'

import { BaseRepository, FindManyOptions } from './base'

// Helper types using Supabase generated types
export type Check = Database['public']['Tables']['checks']['Row']
export type CheckInsert = Database['public']['Tables']['checks']['Insert']
export type CheckUpdate = Database['public']['Tables']['checks']['Update']
export type CheckStatus = Database['public']['Enums']['check_status']

/**
 * Check statistics for admin dashboard
 */
export interface CheckStats {
  totalChecks: number
  checksThisMonth: number
  recentChecks: CheckWithUser[]
  processingTimes: number[]
  statusCounts: Record<string, number>
  hourlyActivity: { hour: string; count: number }[]
  errorRate: number
}

/**
 * Check with user information
 */
export type CheckWithUser = Check & {
  users: {
    display_name?: string | null
    email?: string | null
  } | null
}

/**
 * Performance metrics for checks
 */
export interface CheckPerformanceMetrics {
  avgProcessingTime: number
  maxProcessingTime: number
  minProcessingTime: number
  totalChecks24h: number
  successRate: number
  errorRate: number
  statusBreakdown: Record<string, number>
  hourlyActivity: { hour: string; count: number }[]
}

/**
 * Check search filter options
 */
export interface CheckSearchOptions {
  userId?: string
  organizationId: number
  search?: string
  status?: CheckStatus
  inputType?: 'text' | 'image'
  dateFilter?: 'today' | 'week' | 'month'
  page?: number
  limit?: number
}

/**
 * Check search result with pagination
 */
export interface CheckSearchResult {
  checks: CheckWithViolations[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/**
 * Check with violations and user info
 */
export type CheckWithViolations = Check & {
  users?: {
    email?: string | null
  } | null
  violations?: { id: number }[]
}

/**
 * Check with detailed violation information
 */
export type CheckWithDetailedViolations = Check & {
  users?: {
    email?: string | null
  } | null
  violations?: Array<{
    id: number
    start_pos?: number | null
    end_pos?: number | null
    reason?: string | null
    dictionary_id?: number | null
    dictionaries?: {
      phrase?: string | null
      category?: string | null
    } | null
  }>
}

/**
 * Checks repository interface with check-specific methods
 */
export interface ChecksRepository extends BaseRepository<Check, CheckInsert, CheckUpdate> {
  /**
   * Find checks by user ID
   */
  findByUserId(userId: string, options?: FindManyOptions<Check>): Promise<Check[]>

  /**
   * Find checks by organization ID
   */
  findByOrganizationId(organizationId: number, options?: FindManyOptions<Check>): Promise<Check[]>

  /**
   * Find checks by status
   */
  findByStatus(status: CheckStatus, options?: FindManyOptions<Check>): Promise<Check[]>

  /**
   * Search checks with filters and pagination
   */
  searchChecks(searchOptions: CheckSearchOptions): Promise<CheckSearchResult>

  /**
   * Find recent checks with user information for admin dashboard
   */
  findRecentWithUsers(limit?: number): Promise<CheckWithUser[]>

  /**
   * Get check statistics for admin dashboard
   */
  getStats(): Promise<CheckStats>

  /**
   * Get performance metrics for the last 24 hours
   */
  getPerformanceMetrics(): Promise<CheckPerformanceMetrics>

  /**
   * Count checks for a specific date range
   */
  countByDateRange(startDate: string, endDate: string): Promise<number>

  /**
   * Count checks by status
   */
  countByStatus(): Promise<Record<string, number>>

  /**
   * Count active users in the last 30 days
   */
  countActiveUsers(days?: number): Promise<number>

  /**
   * Find check with detailed violation information by ID and organization
   */
  findByIdWithDetailedViolations(id: number, organizationId: number): Promise<CheckWithDetailedViolations | null>

  /**
   * Logically delete check by setting deleted_at timestamp
   */
  logicalDelete(id: number): Promise<Check | null>
}