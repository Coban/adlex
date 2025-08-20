import { SupabaseClient } from '@supabase/supabase-js'

import { createRepositories } from '@/infra/repositories'
import { createClient } from '@/infra/supabase/serverClient'
import { Database } from '@/types/database.types'

// Base repository interfaces
export * from './base'

// Specific repository interfaces
export * from './users'
export * from './checks'
export * from './organizations'
export * from './dictionaries'
export * from './violations'
export * from './user-invitations'
export * from './realtimeRepository'
export * from './authRepository'
export * from './storage'

// Repository container interface
export interface RepositoryContainer {
  users: import('./users').UsersRepository
  checks: import('./checks').ChecksRepository
  organizations: import('./organizations').OrganizationsRepository
  dictionaries: import('./dictionaries').DictionariesRepository
  violations: import('./violations').ViolationsRepository
  userInvitations: import('./user-invitations').UserInvitationsRepository
  realtime: import('./realtimeRepository').RealtimeRepository
  auth: import('./authRepository').AuthRepository
  storage: import('./storage').StorageRepository
}

/**
 * Get repository container with Supabase client
 */
export async function getRepositories(supabaseClient?: SupabaseClient<Database>): Promise<RepositoryContainer> {
  const supabase = supabaseClient ?? await createClient()
  return createRepositories(supabase)
}

/**
 * Repository service provider for dependency injection
 */
class RepositoryServiceProvider {
  private static instance: RepositoryServiceProvider
  private repositories: RepositoryContainer | null = null

  private constructor() {}

  static getInstance(): RepositoryServiceProvider {
    if (!RepositoryServiceProvider.instance) {
      RepositoryServiceProvider.instance = new RepositoryServiceProvider()
    }
    return RepositoryServiceProvider.instance
  }

  async getRepositories(supabaseClient?: SupabaseClient<Database>): Promise<RepositoryContainer> {
    this.repositories ??= await getRepositories(supabaseClient)
    return this.repositories
  }

  setRepositories(repositories: RepositoryContainer) {
    this.repositories = repositories
  }

  reset() {
    this.repositories = null
  }
}

/**
 * Get global repository service provider instance
 */
export function getRepositoryProvider(): RepositoryServiceProvider {
  return RepositoryServiceProvider.getInstance()
}