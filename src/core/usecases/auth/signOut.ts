import { createServerClient } from '@supabase/ssr'

import type { Database } from '@/types/database.types'

/**
 * サインアウトのユースケース入力
 */
export interface SignOutInput {
  // サインアウトは特に入力パラメータを必要としない
  _placeholder?: never
}

/**
 * サインアウトのユースケース出力
 */
export interface SignOutOutput {
  success: boolean
}

/**
 * サインアウトのユースケース結果
 */
export type SignOutResult = 
  | { success: true; data: SignOutOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * サインアウトユースケース
 */
export class SignOutUseCase {
  private supabaseUrl: string
  private supabaseAnonKey: string

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    this.supabaseUrl = supabaseUrl
    this.supabaseAnonKey = supabaseAnonKey
  }

  async execute(
    input: SignOutInput,
    requestCookies: Array<{ name: string; value: string }>,
    setCookieCallback: (name: string, value: string, options?: Record<string, unknown>) => void
  ): Promise<SignOutResult> {
    try {
      // Supabaseクライアントの作成
      const supabase = createServerClient<Database>(this.supabaseUrl, this.supabaseAnonKey, {
        cookies: {
          getAll() {
            return requestCookies
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              setCookieCallback(name, value, options)
            })
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })

      // サインアウト実行
      const { error } = await supabase.auth.signOut()
      if (error) {
        return {
          success: false,
          error: { code: 'SIGNOUT_ERROR', message: error.message }
        }
      }

      return {
        success: true,
        data: { success: true }
      }

    } catch (error) {
      console.error('Sign out usecase error:', error)
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '内部エラーが発生しました' }
      }
    }
  }
}