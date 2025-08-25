import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

import { ErrorFactory } from '@/lib/errors'
import type { Database } from '@/types/database.types'

import { createClient as createServerClient } from './serverClient'

/**
 * 真のアドミンクライアント作成（Service Role Key使用）
 * Service RoleキーでSupabaseに接続し、RLSを無視したCRUD操作が可能
 */
export function createAdminClient(): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw ErrorFactory.createValidationError('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

/**
 * 管理者専用操作用のSupabaseクライアントラッパー
 * 認証済みユーザーの管理者権限を確認してからクライアントを返す
 */
export async function getAdminClient(): Promise<SupabaseClient<Database>> {
  const supabase = await createServerClient()
  
  // 現在のユーザーが管理者かどうか確認
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw ErrorFactory.createAuthenticationError('認証が必要です')
  }

  // 管理者権限を確認
  const { data: userData, error: profileError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || userData?.role !== 'admin') {
    throw ErrorFactory.createAuthorizationError('管理者権限が必要です')
  }

  return supabase
}

/**
 * システム管理用のクライアント（Service Role Key使用）
 * バックグラウンド処理、システムタスク、バッチ処理で使用
 */
export function getSystemClient(): SupabaseClient<Database> {
  return createAdminClient()
}

/**
 * バッチ処理用のアドミンクライアント
 * 大量のデータ操作、バッチジョブなどで使用
 */
export function getBatchProcessingClient(): SupabaseClient<Database> {
  return createAdminClient()
}