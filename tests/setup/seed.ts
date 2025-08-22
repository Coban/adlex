import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * テストデータベースシーディングシステム
 * 
 * 目的:
 * - 一貫性のあるテストデータ準備
 * - UIより100倍高速なデータ作成
 * - 並列テスト実行時のデータ競合回避
 * - 決定論的テスト結果の実現
 */

/**
 * メインシーディング関数
 * Supabase Service Roleを使用して高速データ作成
 */
export async function seedTestDatabase(): Promise<void> {
  console.log('  📊 Connecting to database...');
  
  // Service Roleクライアント作成（RLS制限なし）
  const supabase = await createClient();
  
  try {
    // 既存テストデータのクリーンアップ
    await cleanupTestData(supabase);
    
    // テストデータ作成
    await createTestOrganizations(supabase);
    await createTestUsers(supabase);
    await createTestDictionaries(supabase);
    await createTestChecks(supabase);
    
    console.log('  ✅ Database seeding completed successfully');
    
  } catch (error) {
    console.error('  ❌ Database seeding failed:', error);
    throw error;
  }
}

/**
 * 既存テストデータのクリーンアップ
 * 冪等性を確保し、テスト間の影響を排除
 */
async function cleanupTestData(supabase: SupabaseClient<Database>): Promise<void> {
  console.log('    🧹 Cleaning up existing test data...');
  
  try {
    // 参照整合性を考慮した削除順序
    const tables = [
      'violations',
      'checks', 
      'user_invitations',
      'users',
      'dictionaries',
      'organizations'
    ];
    
    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .ilike('email', '%@test.com'); // テストデータのみ削除
      
      if (error && !error.message.includes('relation') && !error.message.includes('does not exist')) {
        console.warn(`    ⚠️  Warning cleaning ${table}:`, error.message);
      }
    }
    
    console.log('    ✅ Cleanup completed');
    
  } catch (error) {
    console.warn('    ⚠️  Cleanup encountered issues:', error);
    // クリーンアップエラーはシーディングを停止しない
  }
}

/**
 * テスト用組織データ作成
 */
async function createTestOrganizations(supabase: SupabaseClient<Database>): Promise<void> {
  console.log('    🏢 Creating test organizations...');
  
  const organizations = [
    {
      id: 'test-org-admin',
      name: 'テスト組織（管理者用）',
      max_users: 100,
      max_checks: 10000,
      status: 'active',
      created_at: new Date().toISOString()
    },
    {
      id: 'test-org-user',
      name: 'テスト組織（一般用）', 
      max_users: 10,
      max_checks: 1000,
      status: 'active',
      created_at: new Date().toISOString()
    }
  ];
  
  const { error } = await supabase
    .from('organizations')
    .upsert(organizations, { onConflict: 'id' });
    
  if (error) {
    console.error('    ❌ Failed to create organizations:', error);
    throw error;
  }
  
  console.log(`    ✅ Created ${organizations.length} organizations`);
}

/**
 * テスト用ユーザーデータ作成
 * 管理者・一般ユーザーの両方を準備
 */
async function createTestUsers(supabase: SupabaseClient<Database>): Promise<void> {
  console.log('    👥 Creating test users...');
  
  const users = [
    {
      id: 'test-admin-1',
      email: 'admin@test.com',
      role: 'admin',
      organization_id: 'test-org-admin',
      status: 'active',
      first_name: '管理者',
      last_name: 'テスト',
      created_at: new Date().toISOString()
    },
    {
      id: 'test-user-1',
      email: 'user1@test.com',
      role: 'user',
      organization_id: 'test-org-user',
      status: 'active',
      first_name: 'ユーザー',
      last_name: 'テスト1',
      created_at: new Date().toISOString()
    },
    {
      id: 'test-user-2', 
      email: 'user2@test.com',
      role: 'user',
      organization_id: 'test-org-user',
      status: 'active',
      first_name: 'ユーザー',
      last_name: 'テスト2',
      created_at: new Date().toISOString()
    }
  ];
  
  const { error } = await supabase
    .from('users')
    .upsert(users, { onConflict: 'id' });
    
  if (error) {
    console.error('    ❌ Failed to create users:', error);
    throw error;
  }
  
  console.log(`    ✅ Created ${users.length} users`);
}

/**
 * テスト用辞書データ作成
 * 薬機法違反検出テスト用の辞書エントリー
 */
async function createTestDictionaries(supabase: SupabaseClient<Database>): Promise<void> {
  console.log('    📚 Creating test dictionaries...');
  
  const dictionaries = [
    // NGワード
    {
      id: 'dict-ng-1',
      phrase: 'がんが治る',
      type: 'NG',
      category: '医薬品効果',
      reason: '医薬品的効果効能の表現',
      severity: 'high',
      created_at: new Date().toISOString()
    },
    {
      id: 'dict-ng-2',
      phrase: '100%効果',
      type: 'NG',
      category: '誇大広告',
      reason: '効果を保証する表現',
      severity: 'high',
      created_at: new Date().toISOString()
    },
    {
      id: 'dict-ng-3',
      phrase: '医師推薦',
      type: 'NG',
      category: '権威付け',
      reason: '医師の推薦を装った表現',
      severity: 'medium',
      created_at: new Date().toISOString()
    },
    
    // ALLOWワード
    {
      id: 'dict-allow-1',
      phrase: '健康維持',
      type: 'ALLOW',
      category: '一般表現',
      reason: '適切な健康関連表現',
      severity: 'low',
      created_at: new Date().toISOString()
    },
    {
      id: 'dict-allow-2',
      phrase: '栄養補給',
      type: 'ALLOW',
      category: '一般表現',
      reason: '食品としての適切な表現',
      severity: 'low',
      created_at: new Date().toISOString()
    }
  ];
  
  const { error } = await supabase
    .from('dictionaries')
    .upsert(dictionaries, { onConflict: 'id' });
    
  if (error) {
    console.error('    ❌ Failed to create dictionaries:', error);
    throw error;
  }
  
  console.log(`    ✅ Created ${dictionaries.length} dictionary entries`);
}

/**
 * テスト用チェック履歴データ作成
 * 履歴表示・統計テスト用
 */
async function createTestChecks(supabase: SupabaseClient<Database>): Promise<void> {
  console.log('    📝 Creating test check records...');
  
  const checks = [
    {
      id: 'test-check-1',
      user_id: 'test-user-1',
      organization_id: 'test-org-user',
      original_text: 'がんが治る健康食品です',
      status: 'completed',
      violation_count: 1,
      created_at: new Date(Date.now() - 86400000).toISOString(), // 1日前
      processed_at: new Date(Date.now() - 86400000 + 5000).toISOString()
    },
    {
      id: 'test-check-2',
      user_id: 'test-user-1',
      organization_id: 'test-org-user',
      original_text: '健康維持に役立つ食品です',
      status: 'completed',
      violation_count: 0,
      created_at: new Date(Date.now() - 43200000).toISOString(), // 12時間前
      processed_at: new Date(Date.now() - 43200000 + 3000).toISOString()
    }
  ];
  
  const { error: checksError } = await supabase
    .from('checks')
    .upsert(checks, { onConflict: 'id' });
    
  if (checksError) {
    console.error('    ❌ Failed to create checks:', checksError);
    throw checksError;
  }
  
  // 違反データ作成
  const violations = [
    {
      id: 'test-violation-1',
      check_id: 'test-check-1',
      text: 'がんが治る',
      reason: '医薬品的効果効能の表現が含まれています',
      start_position: 0,
      end_position: 5,
      severity: 'high',
      category: '医薬品効果',
      suggestions: ['健康維持に役立つ', '体調管理をサポート'],
      created_at: new Date(Date.now() - 86400000).toISOString()
    }
  ];
  
  const { error: violationsError } = await supabase
    .from('violations')
    .upsert(violations, { onConflict: 'id' });
    
  if (violationsError) {
    console.error('    ❌ Failed to create violations:', violationsError);
    throw violationsError;
  }
  
  console.log(`    ✅ Created ${checks.length} checks and ${violations.length} violations`);
}

/**
 * シーディング結果の検証
 * データが正しく作成されたかを確認
 */
export async function validateSeedData(supabase: SupabaseClient<Database>): Promise<void> {
  console.log('  🔍 Validating seed data...');
  
  try {
    const validations = [
      { table: 'organizations', expected: 2 },
      { table: 'users', expected: 3 },
      { table: 'dictionaries', expected: 5 },
      { table: 'checks', expected: 2 },
      { table: 'violations', expected: 1 }
    ];
    
    for (const validation of validations) {
      const { count, error } = await supabase
        .from(validation.table)
        .select('*', { count: 'exact', head: true });
        
      if (error) {
        throw new Error(`Failed to validate ${validation.table}: ${error.message}`);
      }
      
      if (count !== validation.expected) {
        console.warn(`    ⚠️  ${validation.table}: expected ${validation.expected}, got ${count}`);
      } else {
        console.log(`    ✅ ${validation.table}: ${count} records`);
      }
    }
    
    console.log('  ✅ Seed data validation completed');
    
  } catch (error) {
    console.error('  ❌ Seed data validation failed:', error);
    throw error;
  }
}