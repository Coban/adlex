import { SupabaseClient } from '@supabase/supabase-js'

import { RepositoryContainer } from '@/core/ports'
import { Database } from '@/types/database.types'


import { SupabaseChecksRepository } from './checks'
import { SupabaseDictionariesRepository } from './dictionaries'
import { SupabaseOrganizationsRepository } from './organizations'
import { SupabaseRealtimeRepository } from './realtime'
import { SupabaseUserInvitationsRepository } from './user-invitations'
import { SupabaseUsersRepository } from './users'
import { SupabaseViolationsRepository } from './violations'

/**
 * Create repository container with all repositories
 */
export function createRepositories(supabase: SupabaseClient<Database>): RepositoryContainer {
  return {
    users: new SupabaseUsersRepository(supabase),
    checks: new SupabaseChecksRepository(supabase),
    organizations: new SupabaseOrganizationsRepository(supabase),
    dictionaries: new SupabaseDictionariesRepository(supabase),
    violations: new SupabaseViolationsRepository(supabase),
    userInvitations: new SupabaseUserInvitationsRepository(supabase),
    realtime: new SupabaseRealtimeRepository(supabase),
  }
}

// Export concrete implementations
export * from './users'
export * from './checks'
export * from './organizations'
export * from './dictionaries'
export * from './violations'
export * from './user-invitations'
export * from './realtime'
export * from './base'