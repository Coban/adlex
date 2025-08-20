// Supabaseクライアントラッパーの集約エクスポート

// Server-side clients
export { 
  createClient as createServerClient,
  getServerClient, 
  getAdminServerClient 
} from './serverClient'

// Client-side clients
export { 
  createClient as createClientClient,
  getClientClient, 
  getRealtimeClient,
  type SupabaseClient
} from './clientClient'

// Admin clients (service role)
export { 
  createAdminClient,
  getAdminClient, 
  getSystemClient,
  getBatchProcessingClient 
} from './adminClient'

// Backward compatibility re-exports for lib/supabase/* migration
export { createClient } from './serverClient'

// 便利関数: コンテキストに応じて適切なクライアントを取得
export async function getContextualClient() {
  // サーバーサイドの場合
  if (typeof window === 'undefined') {
    const { getServerClient } = await import('./serverClient')
    return getServerClient()
  }
  
  // クライアントサイドの場合
  const { getClientClient } = await import('./clientClient')
  return getClientClient()
}