import { SupabaseClient } from '@supabase/supabase-js'

import { Database } from '@/types/database.types'
import { FindManyOptions } from '../interfaces/base'
import {
  Organization,
  OrganizationInsert,
  OrganizationUpdate,
  OrganizationPlan,
  OrganizationsRepository,
} from '../interfaces/organizations'

import { SupabaseBaseRepository } from './base'

/**
 * Supabase implementation of OrganizationsRepository
 */
export class SupabaseOrganizationsRepository
  extends SupabaseBaseRepository<Organization, OrganizationInsert, OrganizationUpdate>
  implements OrganizationsRepository
{
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'organizations')
  }

  async findByPlan(plan: OrganizationPlan, options?: FindManyOptions<Organization>): Promise<Organization[]> {
    return this.findMany({ 
      ...options, 
      where: { ...options?.where, plan } 
    })
  }

  async updateUsageCount(id: number, usedChecks: number): Promise<Organization | null> {
    return this.update(id, { used_checks: usedChecks })
  }

  async incrementUsage(id: number, increment = 1): Promise<Organization | null> {
    try {
      // Get current usage first
      const organization = await this.findById(id)
      if (!organization) return null

      const currentUsage = organization.used_checks || 0
      const newUsage = currentUsage + increment

      return this.update(id, { used_checks: newUsage })
    } catch (error) {
      throw this.createRepositoryError('Failed to increment usage', error as Error)
    }
  }

  async hasAvailableChecks(id: number): Promise<boolean> {
    try {
      const organization = await this.findById(id)
      if (!organization) return false

      const usedChecks = organization.used_checks || 0
      const maxChecks = organization.max_checks || 0

      return usedChecks < maxChecks
    } catch (error) {
      throw this.createRepositoryError('Failed to check available checks', error as Error)
    }
  }

  async getUsageStats(id: number): Promise<{
    usedChecks: number
    maxChecks: number
    remainingChecks: number
    usagePercentage: number
  } | null> {
    try {
      const organization = await this.findById(id)
      if (!organization) return null

      const usedChecks = organization.used_checks || 0
      const maxChecks = organization.max_checks || 0
      const remainingChecks = Math.max(0, maxChecks - usedChecks)
      const usagePercentage = maxChecks > 0 ? (usedChecks / maxChecks) * 100 : 0

      return {
        usedChecks,
        maxChecks,
        remainingChecks,
        usagePercentage,
      }
    } catch (error) {
      throw this.createRepositoryError('Failed to get usage stats', error as Error)
    }
  }
}