import { Database } from '@/types/database.types'

import { BaseRepository, FindManyOptions } from './base'

// Helper types using Supabase generated types
export type Violation = Database['public']['Tables']['violations']['Row']
export type ViolationInsert = Database['public']['Tables']['violations']['Insert']
export type ViolationUpdate = Database['public']['Tables']['violations']['Update']

/**
 * Violations repository interface with violation-specific methods
 */
export interface ViolationsRepository extends BaseRepository<Violation, ViolationInsert, ViolationUpdate> {
  /**
   * Find violations by check ID
   */
  findByCheckId(checkId: number, options?: FindManyOptions<Violation>): Promise<Violation[]>

  /**
   * Find violations by dictionary ID
   */
  findByDictionaryId(dictionaryId: number, options?: FindManyOptions<Violation>): Promise<Violation[]>

  /**
   * Count violations by check ID
   */
  countByCheckId(checkId: number): Promise<number>

  /**
   * Count total violations
   */
  countTotal(): Promise<number>

  /**
   * Bulk create violations for a check
   */
  bulkCreateForCheck(checkId: number, violations: Omit<ViolationInsert, 'check_id'>[]): Promise<Violation[]>

  /**
   * Delete violations by check ID
   */
  deleteByCheckId(checkId: number): Promise<boolean>
}