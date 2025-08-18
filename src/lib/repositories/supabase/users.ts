import { SupabaseClient } from '@supabase/supabase-js'

import { Database } from '@/types/database.types'
import { FindManyOptions } from '../interfaces/base'
import { User, UserInsert, UserUpdate, UserRole, UserWithOrganization, UsersRepository } from '../interfaces/users'

import { SupabaseBaseRepository } from './base'

/**
 * Supabase implementation of UsersRepository
 */
export class SupabaseUsersRepository
  extends SupabaseBaseRepository<User, UserInsert, UserUpdate>
  implements UsersRepository
{
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'users')
  }

  async findByIdWithOrganization(id: string): Promise<UserWithOrganization | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select(`
          *,
          organizations (*)
        `)
        .eq('id', id)
        .maybeSingle()

      if (error) {
        throw this.createRepositoryError('Failed to find user with organization', error)
      }

      return data as UserWithOrganization | null
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw this.createRepositoryError('Unexpected error finding user with organization', error as Error)
    }
  }

  async findByOrganizationId(organizationId: number, options?: FindManyOptions<User>): Promise<User[]> {
    return this.findMany({ 
      ...options, 
      where: { ...options?.where, organization_id: organizationId } 
    })
  }

  async findByRole(role: UserRole, options?: FindManyOptions<User>): Promise<User[]> {
    return this.findMany({ 
      ...options, 
      where: { ...options?.where, role } 
    })
  }

  async findAdmins(options?: FindManyOptions<User>): Promise<User[]> {
    return this.findByRole('admin', options)
  }

  async updateRole(id: string, role: UserRole): Promise<User | null> {
    return this.update(id, { role })
  }

  async isAdmin(id: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('role')
        .eq('id', id)
        .maybeSingle()

      if (error) {
        throw this.createRepositoryError('Failed to check admin status', error)
      }

      return data?.role === 'admin'
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw this.createRepositoryError('Unexpected error checking admin status', error as Error)
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle()

      if (error) {
        if (error.code === 'PGRST116') return null // No rows found
        throw this.createRepositoryError('Failed to find user by email', error)
      }

      return data as User
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw this.createRepositoryError('Unexpected error finding user by email', error as Error)
    }
  }
}