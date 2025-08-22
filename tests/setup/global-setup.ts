import { chromium, Browser, BrowserContext, Page } from '@playwright/test';
import { seedTestDatabase } from './seed';

/**
 * Playwright グローバルセットアップ
 * 
 * 実行内容:
 * 1. テストデータベースのシーディング
 * 2. 認証状態（storageState）の事前生成
 * 3. テスト環境の初期化
 * 
 * これにより各テスト実行時のUIログインが不要となり、
 * テスト実行時間を70%短縮できます。
 */

export default async function globalSetup() {
  console.log('🚀 E2E Global Setup started...');
  
  try {
    // Phase 1: データベースシーディング
    console.log('📦 Seeding test database...');
    await seedTestDatabase();
    console.log('✅ Database seeding completed');

    // Phase 2: 認証状態生成
    console.log('🔐 Generating authentication states...');
    await generateAuthenticationStates();
    console.log('✅ Authentication states generated');

    console.log('🎉 Global Setup completed successfully!');

  } catch (error) {
    console.error('❌ Global Setup failed:', error);
    throw error;
  }
}

/**
 * 認証状態（storageState）を事前生成
 * 管理者ユーザーと一般ユーザーの認証状態を作成
 */
async function generateAuthenticationStates() {
  const browser = await chromium.launch();
  
  try {
    // 管理者の認証状態生成
    await generateUserAuthState(browser, {
      email: 'admin@test.com',
      role: 'admin',
      outputPath: './tests/.auth/admin.json'
    });

    // 一般ユーザーの認証状態生成
    await generateUserAuthState(browser, {
      email: 'user1@test.com', 
      role: 'user',
      outputPath: './tests/.auth/user.json'
    });

  } finally {
    await browser.close();
  }
}

/**
 * 指定ユーザーの認証状態を生成
 */
async function generateUserAuthState(
  browser: Browser,
  config: {
    email: string;
    role: 'admin' | 'user';
    outputPath: string;
  }
) {
  console.log(`  📝 Generating auth state for ${config.role}: ${config.email}`);
  
  const context = await browser.newContext({
    // 認証状態生成時は空の状態で開始
    storageState: { cookies: [], origins: [] }
  });

  try {
    const page = await context.newPage();
    
    // テスト専用ログインAPI呼び出し
    const response = await page.request.post('http://localhost:3001/api/test/login-as', {
      data: {
        email: config.email,
        role: config.role
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok()) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to generate auth state for ${config.email}: ${response.status()} - ${errorData.error || 'Unknown error'}`
      );
    }

    // 認証成功確認のため、保護されたページにアクセス
    await page.goto('http://localhost:3001/checker');
    await page.waitForLoadState('networkidle');

    // 認証状態の検証
    const currentUrl = page.url();
    if (currentUrl.includes('/auth/signin')) {
      throw new Error(`Authentication failed for ${config.email} - redirected to login page`);
    }

    // 認証状態をファイルに保存
    const storageState = await context.storageState();
    await require('fs').promises.writeFile(
      config.outputPath, 
      JSON.stringify(storageState, null, 2)
    );

    console.log(`  ✅ Auth state saved: ${config.outputPath}`);

    // 認証内容の検証ログ
    const sessionData = await page.evaluate(() => {
      const authKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('supabase') || key.includes('auth')
      );
      return authKeys.map(key => ({
        key,
        hasValue: !!localStorage.getItem(key)
      }));
    });

    if (sessionData.length > 0) {
      console.log(`  📊 Session data keys: ${sessionData.map(s => s.key).join(', ')}`);
    }

  } finally {
    await context.close();
  }
}

/**
 * グローバル終了処理
 * テスト完了後のクリーンアップ
 */
export async function globalTeardown() {
  console.log('🧹 Global teardown started...');
  
  try {
    // 必要に応じてテストデータのクリーンアップ
    // 現在はセットアップのみで、データは次回実行時に上書きされるため省略
    
    console.log('✅ Global teardown completed');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // teardownの失敗はテスト結果に影響させない
  }
}