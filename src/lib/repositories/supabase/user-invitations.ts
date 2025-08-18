import { SupabaseClient } from '@supabase/supabase-js'

import { Database } from '@/types/database.types'
import { FindManyOptions } from '../interfaces/base'
import {
  UserInvitation,
  UserInvitationInsert,
  UserInvitationUpdate,
  UserInvitationsRepository,
} from '../interfaces/user-invitations'

import { SupabaseBaseRepository } from './base'

/**
 * Supabase implementation of UserInvitationsRepository
 */
export class SupabaseUserInvitationsRepository
  extends SupabaseBaseRepository<UserInvitation, UserInvitationInsert, UserInvitationUpdate>
  implements UserInvitationsRepository
{
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'user_invitations')
  }

  async findByOrganizationId(organizationId: number, options?: FindManyOptions<UserInvitation>): Promise<UserInvitation[]> {
    return this.findMany({ 
      ...options, 
      where: { ...options?.where, organization_id: organizationId } 
    })
  }

  async findByEmailAndOrganization(email: string, organizationId: number): Promise<UserInvitation | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_invitations')
        .select('*')
        .eq('email', email)
        .eq('organization_id', organizationId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // No rows found
        throw this.createRepositoryError('Failed to find invitation by email and organization', error)
      }

      return data as UserInvitation
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw this.createRepositoryError('Unexpected error finding invitation', error as Error)
    }
  }

  async findActiveInvitationByEmail(email: string, organizationId: number): Promise<UserInvitation | null> {
    try {
      const now = new Date().toISOString()
      
      const { data, error } = await this.supabase
        .from('user_invitations')
        .select('*')
        .eq('email', email)
        .eq('organization_id', organizationId)
        .is('accepted_at', null)
        .gt('expires_at', now)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // No rows found
        throw this.createRepositoryError('Failed to find active invitation', error)
      }

      return data as UserInvitation
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw this.createRepositoryError('Unexpected error finding active invitation', error as Error)
    }
  }

  async findByToken(token: string): Promise<UserInvitation | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_invitations')
        .select('*')
        .eq('token', token)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // No rows found
        throw this.createRepositoryError('Failed to find invitation by token', error)
      }

      return data as UserInvitation
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw this.createRepositoryError('Unexpected error finding invitation by token', error as Error)
    }
  }

  async acceptInvitation(id: number, acceptedAt: string = new Date().toISOString()): Promise<UserInvitation | null> {
    return this.update(id, { accepted_at: acceptedAt })
  }

  isInvitationValid(invitation: UserInvitation): boolean {
    if (invitation.accepted_at) return false // Already accepted
    
    const now = new Date()
    const expiresAt = new Date(invitation.expires_at)
    
    return expiresAt > now // Not expired
  }

  async countPendingByOrganization(organizationId: number): Promise<number> {
    try {
      const now = new Date().toISOString()
      
      const { count, error } = await this.supabase
        .from('user_invitations')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .is('accepted_at', null)
        .gt('expires_at', now)

      if (error) {
        throw this.createRepositoryError('Failed to count pending invitations', error)
      }

      return count || 0
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw this.createRepositoryError('Unexpected error counting pending invitations', error as Error)
    }
  }

  async deleteExpiredInvitations(): Promise<number> {
    try {
      const now = new Date().toISOString()
      
      const { count, error } = await this.supabase
        .from('user_invitations')
        .delete({ count: 'exact' })
        .lt('expires_at', now)

      if (error) {
        throw this.createRepositoryError('Failed to delete expired invitations', error)
      }

      return count || 0
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw this.createRepositoryError('Unexpected error deleting expired invitations', error as Error)
    }
  }
}