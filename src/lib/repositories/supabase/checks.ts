import { SupabaseClient } from '@supabase/supabase-js'

import { Database } from '@/types/database.types'
import { FindManyOptions } from '../interfaces/base'
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
  CheckWithDetailedViolations,
  ChecksRepository,
} from '../interfaces/checks'

import { SupabaseBaseRepository } from './base'

/**
 * Supabase implementation of ChecksRepository
 */
export class SupabaseChecksRepository
  extends SupabaseBaseRepository<Check, CheckInsert, CheckUpdate>
  implements ChecksRepository
{
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'checks')
  }

  async findByUserId(userId: string, options?: FindManyOptions<Check>): Promise<Check[]> {
    return this.findMany({ 
      ...options, 
      where: { ...options?.where, user_id: userId } 
    })
  }

  async findByOrganizationId(organizationId: number, options?: FindManyOptions<Check>): Promise<Check[]> {
    return this.findMany({ 
      ...options, 
      where: { ...options?.where, organization_id: organizationId } 
    })
  }

  async findByStatus(status: CheckStatus, options?: FindManyOptions<Check>): Promise<Check[]> {
    return this.findMany({ 
      ...options, 
      where: { ...options?.where, status } 
    })
  }

  async searchChecks(searchOptions: CheckSearchOptions): Promise<CheckSearchResult> {
    try {
      const { 
        userId, 
        organizationId, 
        search, 
        status, 
        inputType, 
        dateFilter,
        page = 1, 
        limit = 20 
      } = searchOptions
      
      const offset = (page - 1) * limit

      // Build main query
      let query = this.supabase
        .from('checks')
        .select(`
          *,
          users!inner(email),
          violations:violations(id)
        `)
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      // Apply user filter if specified
      if (userId) {
        query = query.eq('user_id', userId)
      }

      // Apply text search filter
      if (search) {
        query = query.ilike('original_text', `%${search}%`)
      }

      // Apply status filter
      if (status) {
        query = query.eq('status', status)
      }

      // Apply input type filter
      if (inputType) {
        query = query.eq('input_type', inputType)
      }

      // Apply date filter
      if (dateFilter) {
        const now = new Date()
        let startDate: Date

        switch (dateFilter) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            break
          case 'week':
            const dayOfWeek = now.getDay()
            startDate = new Date(now.getTime() - (dayOfWeek * 24 * 60 * 60 * 1000))
            startDate.setHours(0, 0, 0, 0)
            break
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            break
          default:
            startDate = new Date(0)
        }

        query = query.gte('created_at', startDate.toISOString())
      }

      // Build count query with same filters
      let countQuery = this.supabase
        .from('checks')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .is('deleted_at', null)

      if (userId) {
        countQuery = countQuery.eq('user_id', userId)
      }

      if (search) {
        countQuery = countQuery.ilike('original_text', `%${search}%`)
      }

      if (status) {
        countQuery = countQuery.eq('status', status)
      }

      if (inputType) {
        countQuery = countQuery.eq('input_type', inputType)
      }

      if (dateFilter) {
        const now = new Date()
        let startDate: Date

        switch (dateFilter) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            break
          case 'week':
            const dayOfWeek = now.getDay()
            startDate = new Date(now.getTime() - (dayOfWeek * 24 * 60 * 60 * 1000))
            startDate.setHours(0, 0, 0, 0)
            break
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            break
          default:
            startDate = new Date(0)
        }

        countQuery = countQuery.gte('created_at', startDate.toISOString())
      }

      // Execute queries in parallel
      const [
        { data: checks, error: checksError },
        { count, error: countError }
      ] = await Promise.all([
        query.range(offset, offset + limit - 1),
        countQuery
      ])

      if (checksError) {
        throw this.createRepositoryError('Failed to search checks', checksError)
      }

      if (countError) {
        throw this.createRepositoryError('Failed to count checks', countError)
      }

      const totalPages = Math.ceil((count ?? 0) / limit)

      return {
        checks: (checks || []) as CheckWithViolations[],
        pagination: {
          page,
          limit,
          total: count ?? 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        }
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw this.createRepositoryError('Unexpected error searching checks', error as Error)
    }
  }

  async findRecentWithUsers(limit = 5): Promise<CheckWithUser[]> {
    try {
      const { data, error } = await this.supabase
        .from('checks')
        .select(`
          *,
          users (
            display_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw this.createRepositoryError('Failed to find recent checks with users', error)
      }

      return (data || []) as CheckWithUser[]
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw this.createRepositoryError('Unexpected error finding recent checks', error as Error)
    }
  }

  async getStats(): Promise<CheckStats> {
    try {
      // Get total counts in parallel
      const [
        totalChecks,
        checksThisMonth,
        recentChecks,
        recentChecksForError,
        dailyChecks
      ] = await Promise.all([
        this.count(),
        this.countByDateRange(
          new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
          new Date().toISOString()
        ),
        this.findRecentWithUsers(5),
        this.findMany({
          where: {},
          orderBy: [{ field: 'created_at', direction: 'desc' }],
          limit: 1000
        }),
        this.findMany({
          where: {},
          orderBy: [{ field: 'created_at', direction: 'asc' }],
          limit: 1000
        })
      ])

      // Calculate processing times and stats
      const processingTimes = recentChecksForError
        .filter(check => check.status === 'completed' && check.completed_at && check.created_at)
        .map(check => {
          const start = new Date(check.created_at!).getTime()
          const end = new Date(check.completed_at!).getTime()
          return (end - start) / 1000
        })

      // Status counts
      const statusCounts = recentChecksForError.reduce((acc: Record<string, number>, check) => {
        const status = check.status ?? 'unknown'
        acc[status] = (acc[status] ?? 0) + 1
        return acc
      }, {})

      // Calculate error rate
      const errorRate = recentChecksForError.length > 0
        ? (recentChecksForError.filter(c => c.status === 'failed').length / recentChecksForError.length) * 100
        : 0

      // Hourly activity (last 24 hours)
      const hourlyActivity = this.calculateHourlyActivity(dailyChecks)

      return {
        totalChecks,
        checksThisMonth,
        recentChecks,
        processingTimes,
        statusCounts,
        hourlyActivity,
        errorRate,
      }
    } catch (error) {
      throw this.createRepositoryError('Failed to get check stats', error as Error)
    }
  }

  async getPerformanceMetrics(): Promise<CheckPerformanceMetrics> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      
      const { data: checks } = await this.supabase
        .from('checks')
        .select('id, created_at, completed_at, status')
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false })

      // Calculate processing times
      const processingTimes = checks?.map(check => {
        if (check.status === 'completed' && check.completed_at && check.created_at) {
          const start = new Date(check.created_at).getTime()
          const end = new Date(check.completed_at).getTime()
          return (end - start) / 1000
        }
        return null
      }).filter(Boolean) ?? []

      const avgProcessingTime = processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a! + b!, 0)! / processingTimes.length
        : 0

      const maxProcessingTime = processingTimes.length > 0
        ? Math.max(...processingTimes as number[])
        : 0

      const minProcessingTime = processingTimes.length > 0
        ? Math.min(...processingTimes as number[])
        : 0

      // Status breakdown
      const statusBreakdown = checks?.reduce((acc: Record<string, number>, check) => {
        const status = check.status ?? 'unknown'
        acc[status] = (acc[status] ?? 0) + 1
        return acc
      }, {}) ?? {}

      const totalChecks = checks?.length ?? 0
      const successRate = statusBreakdown.completed ? (statusBreakdown.completed / totalChecks) * 100 : 0
      const errorRate = statusBreakdown.error ? (statusBreakdown.error / totalChecks) * 100 : 0

      // Hourly activity - cast the minimal data to Check type for the helper method
      const hourlyActivity = this.calculateHourlyActivity((checks || []) as unknown as Check[])

      return {
        avgProcessingTime,
        maxProcessingTime,
        minProcessingTime,
        totalChecks24h: totalChecks,
        successRate,
        errorRate,
        statusBreakdown,
        hourlyActivity,
      }
    } catch (error) {
      throw this.createRepositoryError('Failed to get performance metrics', error as Error)
    }
  }

  async countByDateRange(startDate: string, endDate: string): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('checks')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate)
        .lte('created_at', endDate)

      if (error) {
        throw this.createRepositoryError('Failed to count checks by date range', error)
      }

      return count || 0
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw this.createRepositoryError('Unexpected error counting checks by date range', error as Error)
    }
  }

  async countByStatus(): Promise<Record<string, number>> {
    try {
      const checks = await this.findMany({ limit: 10000 })
      
      return checks.reduce((acc: Record<string, number>, check) => {
        const status = check.status ?? 'unknown'
        acc[status] = (acc[status] ?? 0) + 1
        return acc
      }, {})
    } catch (error) {
      throw this.createRepositoryError('Failed to count checks by status', error as Error)
    }
  }

  async countActiveUsers(days = 30): Promise<number> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      
      const { data, error } = await this.supabase
        .from('checks')
        .select('user_id')
        .gte('created_at', startDate)

      if (error) {
        throw this.createRepositoryError('Failed to count active users', error)
      }

      const uniqueUsers = new Set(data?.map(check => check.user_id) || [])
      return uniqueUsers.size
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw this.createRepositoryError('Unexpected error counting active users', error as Error)
    }
  }

  async findByIdWithDetailedViolations(id: number, organizationId: number): Promise<CheckWithDetailedViolations | null> {
    try {
      const { data, error } = await this.supabase
        .from('checks')
        .select(`
          *,
          users!inner(email),
          violations!inner(
            id,
            start_pos,
            end_pos,
            reason,
            dictionary_id,
            dictionaries(phrase, category)
          )
        `)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // No rows found
        throw this.createRepositoryError('Failed to find check with detailed violations', error)
      }

      return data as CheckWithDetailedViolations
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw this.createRepositoryError('Unexpected error finding check with detailed violations', error as Error)
    }
  }

  async logicalDelete(id: number): Promise<Check | null> {
    return this.update(id, {
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  }

  /**
   * Helper method to calculate hourly activity
   */
  private calculateHourlyActivity(checks: Check[]): { hour: string; count: number }[] {
    const hourlyChecks = checks.reduce((acc: Record<string, number>, check) => {
      if (check.created_at) {
        const hour = new Date(check.created_at).getHours()
        const key = `${hour}:00`
        acc[key] = (acc[key] ?? 0) + 1
      }
      return acc
    }, {})

    // Create array for 24 hours
    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`)
    
    return hours.map(hour => ({
      hour,
      count: hourlyChecks[hour] ?? 0
    }))
  }
}