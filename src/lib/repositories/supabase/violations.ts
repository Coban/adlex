import { SupabaseClient } from '@supabase/supabase-js'

import { Database } from '@/types/database.types'
import { FindManyOptions } from '../interfaces/base'
import { Violation, ViolationInsert, ViolationUpdate, ViolationsRepository } from '../interfaces/violations'

import { SupabaseBaseRepository } from './base'

/**
 * Supabase implementation of ViolationsRepository
 */
export class SupabaseViolationsRepository
  extends SupabaseBaseRepository<Violation, ViolationInsert, ViolationUpdate>
  implements ViolationsRepository
{
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'violations')
  }

  async findByCheckId(checkId: number, options?: FindManyOptions<Violation>): Promise<Violation[]> {
    return this.findMany({ 
      ...options, 
      where: { ...options?.where, check_id: checkId } 
    })
  }

  async findByDictionaryId(dictionaryId: number, options?: FindManyOptions<Violation>): Promise<Violation[]> {
    return this.findMany({ 
      ...options, 
      where: { ...options?.where, dictionary_id: dictionaryId } 
    })
  }

  async countByCheckId(checkId: number): Promise<number> {
    return this.count({ check_id: checkId })
  }

  async countTotal(): Promise<number> {
    return this.count()
  }

  async bulkCreateForCheck(checkId: number, violations: Omit<ViolationInsert, 'check_id'>[]): Promise<Violation[]> {
    try {
      const violationsWithCheckId = violations.map(violation => ({
        ...violation,
        check_id: checkId,
      }))

      const { data, error } = await this.supabase
        .from('violations')
        .insert(violationsWithCheckId as any[])
        .select()

      if (error) {
        throw this.createRepositoryError('Failed to bulk create violations for check', error)
      }

      return (data || []) as Violation[]
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw this.createRepositoryError('Unexpected error bulk creating violations', error as Error)
    }
  }

  async deleteByCheckId(checkId: number): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('violations')
        .delete()
        .eq('check_id', checkId)

      if (error) {
        throw this.createRepositoryError('Failed to delete violations by check ID', error)
      }

      return true
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw this.createRepositoryError('Unexpected error deleting violations by check ID', error as Error)
    }
  }
}