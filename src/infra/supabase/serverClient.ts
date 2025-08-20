// Next.js のリクエストスコープ外での cookies() 呼び出しを避けるため、
// テストでモックしやすい `@/lib/supabase/server` をそのまま再エクスポートします。
import { createClient } from '@/lib/supabase/server'

export { createClient }

// シングルトンとして同じインスタンスを返す
export async function getServerClient() {
  return createClient()
}

// 管理者用クライアント（通常のサーバークライアントと同じ）
export async function getAdminServerClient() {
  return createClient()
}