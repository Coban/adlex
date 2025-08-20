import { createBrowserClient } from '@supabase/ssr'
import { SupabaseClient as BaseSupabaseClient } from '@supabase/supabase-js'

import { Database } from '@/types/database.types'

/**
 * クライアントサイド用のSupabaseクライアント作成
 * Client Components、useEffectフックなどで使用
 */
export function createClient(): BaseSupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  return createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      global: {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      },
      // CORSの問題を回避するための設定
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    }
  )
}

/**
 * クライアントサイド用のSupabaseクライアントラッパー
 * Client Components、Client-side操作で使用
 */
export function getClientClient(): BaseSupabaseClient<Database> {
  return createClient()
}

/**
 * リアルタイム購読用のクライアント
 * WebSocketベースのリアルタイム機能で使用
 */
export function getRealtimeClient(): BaseSupabaseClient<Database> {
  return createClient()
}

export type SupabaseClient = ReturnType<typeof createClient>