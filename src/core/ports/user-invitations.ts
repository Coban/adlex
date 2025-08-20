import { Database } from '@/types/database.types'

import { BaseRepository, FindManyOptions } from './base'

// Helper types using Supabase generated types
export type UserInvitation = Database['public']['Tables']['user_invitations']['Row']
export type UserInvitationInsert = Database['public']['Tables']['user_invitations']['Insert']
export type UserInvitationUpdate = Database['public']['Tables']['user_invitations']['Update']

/**
 * User invitations repository interface with invitation-specific methods
 */
export interface UserInvitationsRepository extends BaseRepository<UserInvitation, UserInvitationInsert, UserInvitationUpdate> {
  /**
   * Find invitations by organization ID
   */
  findByOrganizationId(organizationId: number, options?: FindManyOptions<UserInvitation>): Promise<UserInvitation[]>

  /**
   * Find invitation by email and organization
   */
  findByEmailAndOrganization(email: string, organizationId: number): Promise<UserInvitation | null>

  /**
   * Find active invitation by email and organization (not expired, not accepted)
   */
  findActiveInvitationByEmail(email: string, organizationId: number): Promise<UserInvitation | null>

  /**
   * Find invitation by token
   */
  findByToken(token: string): Promise<UserInvitation | null>

  /**
   * Accept invitation
   */
  acceptInvitation(id: number, acceptedAt?: string): Promise<UserInvitation | null>

  /**
   * Check if invitation is valid (not expired, not accepted)
   */
  isInvitationValid(invitation: UserInvitation): boolean

  /**
   * Count pending invitations for organization
   */
  countPendingByOrganization(organizationId: number): Promise<number>

  /**
   * Delete expired invitations
   */
  deleteExpiredInvitations(): Promise<number>
}