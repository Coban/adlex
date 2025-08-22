import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * テスト専用Supabaseクライアント
 * 
 * 目的:
 * - Global setup時のSupabaseアクセス
 * - Service Role権限による制限なしアクセス
 * - Next.jsリクエストスコープに依存しない独立動作
 */

export function createTestClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required for test setup');
  }

  if (!serviceRoleKey) {
    console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not found - using anon key');
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
      throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required when SERVICE_ROLE_KEY is not available');
    }
    return createSupabaseClient<Database>(supabaseUrl, anonKey);
  }

  // Service Role権限で作成（RLS制限なし）
  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}