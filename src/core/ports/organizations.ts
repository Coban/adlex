import { Database } from '@/types/database.types'

import { BaseRepository, FindManyOptions } from './base'

// Helper types using Supabase generated types
export type Organization = Database['public']['Tables']['organizations']['Row']
export type OrganizationInsert = Database['public']['Tables']['organizations']['Insert']
export type OrganizationUpdate = Database['public']['Tables']['organizations']['Update']
export type OrganizationPlan = Database['public']['Enums']['organization_plan']

/**
 * Organizations repository interface with organization-specific methods
 */
export interface OrganizationsRepository extends BaseRepository<Organization, OrganizationInsert, OrganizationUpdate> {
  /**
   * Find organizations by plan type
   */
  findByPlan(plan: OrganizationPlan, options?: FindManyOptions<Organization>): Promise<Organization[]>

  /**
   * Update organization usage counts
   */
  updateUsageCount(id: number, usedChecks: number): Promise<Organization | null>

  /**
   * Increment usage count
   */
  incrementUsage(id: number, increment?: number): Promise<Organization | null>

  /**
   * Check if organization has available checks
   */
  hasAvailableChecks(id: number): Promise<boolean>

  /**
   * Get organization usage statistics
   */
  getUsageStats(id: number): Promise<{
    usedChecks: number
    maxChecks: number
    remainingChecks: number
    usagePercentage: number
  } | null>
}