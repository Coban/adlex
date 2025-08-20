import { SupabaseClient } from '@supabase/supabase-js'

import { BaseRepository, FindManyOptions, RepositoryError, FilterOperator } from '@/core/ports/base'
import { Database } from '@/types/database.types'


/**
 * Abstract base repository implementation for Supabase
 */
export abstract class SupabaseBaseRepository<
  T extends Record<string, unknown>,
  CreateT = Partial<T>,
  UpdateT = Partial<T>
> implements BaseRepository<T, CreateT, UpdateT> {
  constructor(
    protected supabase: SupabaseClient<Database>,
    protected tableName: keyof Database['public']['Tables']
  ) {}

  async findById(id: number | string): Promise<T | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) {
        throw this.createRepositoryError('Failed to find record by ID', error)
      }

      return data as T | null
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw this.createRepositoryError('Unexpected error finding record', error as Error)
    }
  }

  async findMany(options?: FindManyOptions<T>): Promise<T[]> {
    try {
      let query = this.supabase.from(this.tableName).select('*')

      // Apply filtering
      if (options?.where) {
        query = this.applyFilters(query, options.where)
      }

      // Apply ordering
      if (options?.orderBy) {
        options.orderBy.forEach(({ field, direction }) => {
          query = query.order(field as string, { ascending: direction === 'asc' })
        })
      }

      // Apply pagination
      if (options?.limit) {
        query = query.limit(options.limit)
      }
      if (options?.offset) {
        query = query.range(options.offset, (options.offset + (options.limit ?? 1000)) - 1)
      }

      const { data, error } = await query

      if (error) {
        throw this.createRepositoryError('Failed to find records', error)
      }

      return (data || []) as unknown as T[]
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw this.createRepositoryError('Unexpected error finding records', error as Error)
    }
  }

  /**
   * フィルター条件をSupabaseクエリに適用
   */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  private applyFilters(query: any, filters: Record<string, unknown>): any {
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined) return

      // 複雑なフィルター条件（演算子付き）
      if (typeof value === 'object' && value !== null && 'operator' in value) {
        const { operator, value: filterValue } = value as { operator: FilterOperator; value: any }
        
        switch (operator) {
          case 'eq':
            query = query.eq(key, filterValue)
            break
          case 'neq':
            query = query.neq(key, filterValue)
            break
          case 'gt':
            query = query.gt(key, filterValue)
            break
          case 'gte':
            query = query.gte(key, filterValue)
            break
          case 'lt':
            query = query.lt(key, filterValue)
            break
          case 'lte':
            query = query.lte(key, filterValue)
            break
          case 'like':
            query = query.like(key, filterValue)
            break
          case 'ilike':
            query = query.ilike(key, filterValue)
            break
          case 'in':
            query = query.in(key, filterValue)
            break
          case 'is':
            query = query.is(key, filterValue)
            break
          default:
            // 未知の演算子の場合は等価比較にフォールバック
            query = query.eq(key, filterValue)
        }
      } else {
        // 単純な等価比較（後方互換性）
        query = query.eq(key, value)
      }
    })

    return query
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  async create(data: CreateT): Promise<T> {
    try {
      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .insert(data as never)
        .select()
        .single()

      if (error) {
        throw this.createRepositoryError('Failed to create record', error)
      }

      return result as unknown as T
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw this.createRepositoryError('Unexpected error creating record', error as Error)
    }
  }

  async update(id: number | string, data: UpdateT): Promise<T | null> {
    try {
      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .update(data as never)
        .eq('id', id)
        .select()
        .maybeSingle()

      if (error) {
        throw this.createRepositoryError('Failed to update record', error)
      }

      return result as unknown as T | null
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw this.createRepositoryError('Unexpected error updating record', error as Error)
    }
  }

  async delete(id: number | string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('id', id)

      if (error) {
        throw this.createRepositoryError('Failed to delete record', error)
      }

      return true
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw this.createRepositoryError('Unexpected error deleting record', error as Error)
    }
  }

  async count(filter?: Partial<T>): Promise<number> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })

      // Apply filtering
      if (filter) {
        Object.entries(filter).forEach(([key, value]) => {
          if (value !== undefined) {
            query = query.eq(key, value)
          }
        })
      }

      const { count, error } = await query

      if (error) {
        throw this.createRepositoryError('Failed to count records', error)
      }

      return count ?? 0
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw this.createRepositoryError('Unexpected error counting records', error as Error)
    }
  }

  /**
   * Helper method to create repository errors with context
   */
  protected createRepositoryError(message: string, originalError: unknown): RepositoryError {
    return new RepositoryError(
      `${message}: ${(originalError as Error)?.message ?? originalError}`,
      (originalError as { code?: string })?.code,
      (originalError as { details?: string })?.details,
      (originalError as { hint?: string })?.hint
    )
  }

  /**
   * Helper method to execute raw SQL queries when needed
   */
  protected async executeRPC(_functionName: string, _params?: Record<string, unknown>) {
    try {
      // For now, this is a placeholder - actual RPC calls would need to be type-safe
      // const { data, error } = await this.supabase.rpc(functionName, params)
      throw new Error('RPC calls not implemented in base repository')
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw this.createRepositoryError(`Unexpected error in RPC`, error as Error)
    }
  }
}