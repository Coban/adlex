import { SupabaseClient } from '@supabase/supabase-js'

import { Database } from '@/types/database.types'
import { createClient } from '@/lib/supabase/server'

import { RepositoryContainer } from './interfaces'
import { createRepositories } from './supabase'

// Export all interfaces and implementations
export * from './interfaces'
export * from './supabase'

/**
 * Get repository container with Supabase client
 */
export async function getRepositories(supabaseClient?: SupabaseClient<Database>): Promise<RepositoryContainer> {
  const supabase = supabaseClient || await createClient()
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
    if (!this.repositories) {
      this.repositories = await getRepositories(supabaseClient)
    }
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