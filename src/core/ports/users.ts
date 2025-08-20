import { Database } from '@/types/database.types'

import { BaseRepository, FindManyOptions } from './base'

// Helper types using Supabase generated types
export type User = Database['public']['Tables']['users']['Row']
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type UserUpdate = Database['public']['Tables']['users']['Update']
export type UserRole = Database['public']['Enums']['user_role']

/**
 * Extended user data with organization information
 */
export type UserWithOrganization = User & {
  organizations: Database['public']['Tables']['organizations']['Row'] | null
}

/**
 * User repository interface with user-specific methods
 */
export interface UsersRepository extends BaseRepository<User, UserInsert, UserUpdate> {
  /**
   * Find user with organization data
   */
  findByIdWithOrganization(id: string): Promise<UserWithOrganization | null>

  /**
   * Find users by organization ID
   */
  findByOrganizationId(organizationId: number, options?: FindManyOptions<User>): Promise<User[]>

  /**
   * Find users by role
   */
  findByRole(role: UserRole, options?: FindManyOptions<User>): Promise<User[]>

  /**
   * Find admin users
   */
  findAdmins(options?: FindManyOptions<User>): Promise<User[]>

  /**
   * Update user role
   */
  updateRole(id: string, role: UserRole): Promise<User | null>

  /**
   * Check if user exists and has admin role
   */
  isAdmin(id: string): Promise<boolean>

  /**
   * Find user by email
   */
  findByEmail(email: string): Promise<User | null>
}