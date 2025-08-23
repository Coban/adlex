import { createServerClient } from '@supabase/ssr'

import { AuthRepository, AuthUser } from '@/core/ports/authRepository'
import type { Database } from '@/types/database.types'
import { ErrorFactory } from '@/lib/errors'

/**
 * Supabase認証リポジトリの実装
 */
export class SupabaseAuthRepository implements AuthRepository {
  private supabaseUrl: string
  private supabaseAnonKey: string
  private requestCookies: Array<{ name: string; value: string }>
  private setCookieCallback: (name: string, value: string, options?: Record<string, unknown>) => void

  constructor(
    supabaseUrl: string,
    supabaseAnonKey: string,
    requestCookies: Array<{ name: string; value: string }>,
    setCookieCallback: (name: string, value: string, options?: Record<string, unknown>) => void
  ) {
    this.supabaseUrl = supabaseUrl
    this.supabaseAnonKey = supabaseAnonKey
    this.requestCookies = requestCookies
    this.setCookieCallback = setCookieCallback
  }

  private createClient() {
    return createServerClient<Database>(this.supabaseUrl, this.supabaseAnonKey, {
      cookies: {
        getAll: () => this.requestCookies,
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            this.setCookieCallback(name, value, options)
          })
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }

  async signOut(): Promise<void> {
    const supabase = this.createClient()
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      throw ErrorFactory.createInternalError(`サインアウトに失敗しました: ${error.message}`, error)
    }
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const supabase = this.createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return null
    }

    return {
      id: user.id,
      email: user.email ?? '',
      emailVerified: user.email_confirmed_at !== null,
      lastSignInAt: user.last_sign_in_at ?? undefined
    }
  }

  async isSessionValid(): Promise<boolean> {
    const supabase = this.createClient()
    const { data: { session }, error } = await supabase.auth.getSession()
    
    return !error && session !== null
  }
}