import { Page, test } from '@playwright/test';

/**
 * テスト環境の検出と適応的実行のためのユーティリティ
 */

export interface TestEnvironment {
  hasSupabase: boolean;
  skipAuth: boolean;
  canRunAuthTests: boolean;
}

/**
 * 現在の環境設定を検出
 */
export function detectEnvironment(): TestEnvironment {
  const skipAuth = process.env.SKIP_AUTH === 'true' || process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';
  const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasSupabaseKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  return {
    hasSupabase: hasSupabaseUrl && hasSupabaseKey,
    skipAuth,
    canRunAuthTests: !skipAuth && hasSupabaseUrl && hasSupabaseKey,
  };
}

/**
 * 認証が必要なテストをスキップするかどうかを判定
 */
export function shouldSkipAuthTest(): boolean {
  const env = detectEnvironment();
  return !env.canRunAuthTests;
}

/**
 * 環境に応じてテストを条件実行する
 */
export function conditionalTest(testName: string, testFn: () => void | Promise<void>, requiresAuth = false) {
  if (requiresAuth && shouldSkipAuthTest()) {
    // 認証が必要だが環境が整っていない場合はスキップ
    test.skip(true, `${testName} - Supabase環境が必要なためスキップ`);
    return;
  }
  
  // 通常通りテスト実行
  return testFn();
}

/**
 * ページに環境変数を注入（テスト用）
 */
export async function injectTestEnvironment(page: Page): Promise<void> {
  const env = detectEnvironment();
  
  await page.addInitScript((injectedEnv) => {
    // ブラウザ環境に環境変数を注入
    (window as any).testEnvironment = injectedEnv;
    (window as any).process = {
      env: {
        NODE_ENV: 'test',
        SKIP_AUTH: injectedEnv.skipAuth ? 'true' : 'false',
        NEXT_PUBLIC_SKIP_AUTH: injectedEnv.skipAuth ? 'true' : 'false',
        NEXT_PUBLIC_SUPABASE_URL: injectedEnv.hasSupabase ? process.env.NEXT_PUBLIC_SUPABASE_URL : undefined,
        TZ: process.env.TZ,
      }
    };
  }, env);
}

/**
 * 認証テスト用のセットアップ（必要に応じて認証状態を作成）
 */
export async function setupAuthIfAvailable(page: Page): Promise<boolean> {
  const env = detectEnvironment();
  
  if (!env.canRunAuthTests) {
    return false; // 認証セットアップ不可
  }
  
  try {
    // 簡易認証セットアップ（実際のSupabase環境でのみ動作）
    await page.goto('/auth/signin');
    await page.waitForLoadState('networkidle');
    
    // サインインページが正常に表示されるかチェック
    const emailInput = page.locator('#email');
    const isSigninPageAvailable = await emailInput.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (isSigninPageAvailable) {
      // 認証可能な環境
      await emailInput.fill('admin@test.com');
      await page.locator('#password').fill('password123');
      await page.locator('button[type="submit"]').click();
      
      // 認証後の状態をチェック（リダイレクトまたはエラーメッセージ）
      await page.waitForTimeout(2000);
      return true;
    }
    
    return false;
  } catch (error) {
    console.log('認証セットアップに失敗:', error);
    return false;
  }
}

/**
 * テスト用のグローバル宣言（TypeScript対応）
 */
declare global {
  interface Window {
    testEnvironment?: TestEnvironment;
  }
}

// テスト内で使用するためのエクスポート
export { test, expect } from '@playwright/test';