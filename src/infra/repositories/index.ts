import { SupabaseClient } from '@supabase/supabase-js'

import { RepositoryContainer } from '@/core/ports'
import { SupabaseAuthRepository } from '@/lib/repositories/supabase/authRepository'
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
export function createRepositories(
  supabase: SupabaseClient<Database>,
  authRepositoryOptions?: {
    supabaseUrl: string
    supabaseAnonKey: string
    requestCookies: Array<{ name: string; value: string }>
    setCookieCallback: (name: string, value: string, options?: Record<string, unknown>) => void
  }
): RepositoryContainer {
  // 認証リポジトリは提供されたオプションまたは仮の実装を使用
  const authRepository = authRepositoryOptions
    ? new SupabaseAuthRepository(
        authRepositoryOptions.supabaseUrl,
        authRepositoryOptions.supabaseAnonKey,
        authRepositoryOptions.requestCookies,
        authRepositoryOptions.setCookieCallback
      )
    : new SupabaseAuthRepository('', '', [], () => {})

  return {
    users: new SupabaseUsersRepository(supabase),
    checks: new SupabaseChecksRepository(supabase),
    organizations: new SupabaseOrganizationsRepository(supabase),
    dictionaries: new SupabaseDictionariesRepository(supabase),
    violations: new SupabaseViolationsRepository(supabase),
    userInvitations: new SupabaseUserInvitationsRepository(supabase),
    realtime: new SupabaseRealtimeRepository(supabase),
    auth: authRepository,
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
export { SupabaseAuthRepository } from '@/lib/repositories/supabase/authRepository'