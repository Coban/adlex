import { test as setup, expect } from '@playwright/test';

/**
 * 認証セットアップ
 * テスト実行前に認証状態を設定し、保存する
 */
setup.describe('認証セットアップ', () => {
  setup('管理者認証', async ({ page }) => {
    // 環境変数の設定
    await page.addInitScript(() => {
      (window as any).process = {
        env: {
          NODE_ENV: 'test',
          TZ: process.env.TZ
        }
      };
    });

    // サインインページへ移動
    await page.goto('/auth/signin');
    await page.waitForLoadState('networkidle');

    // メールアドレスとパスワードを入力
    const emailInput = page.locator('input[name="email"], input[type="email"]');
    const passwordInput = page.locator('input[name="password"], input[type="password"]');
    
    await emailInput.fill('admin@test.com');
    await passwordInput.fill('password123');

    // サインインボタンをクリック
    const submitButton = page.locator('button[type="submit"], button:has-text("サインイン"), button:has-text("ログイン")');
    await submitButton.click();

    // 認証成功の確認（ダッシュボードまたはチェッカーページへのリダイレクト）
    await page.waitForURL(url => 
      url.pathname === '/dashboard' || 
      url.pathname === '/checker' ||
      url.pathname === '/', 
      { timeout: 10000 }
    );

    // 認証状態を保存
    await page.context().storageState({ path: 'playwright/.auth/admin.json' });
  });

  setup('一般ユーザー認証', async ({ page }) => {
    // 環境変数の設定
    await page.addInitScript(() => {
      (window as any).process = {
        env: {
          NODE_ENV: 'test',
          TZ: process.env.TZ
        }
      };
    });

    // サインインページへ移動
    await page.goto('/auth/signin');
    await page.waitForLoadState('networkidle');

    // メールアドレスとパスワードを入力
    const emailInput = page.locator('input[name="email"], input[type="email"]');
    const passwordInput = page.locator('input[name="password"], input[type="password"]');
    
    await emailInput.fill('user1@test.com');
    await passwordInput.fill('password123');

    // サインインボタンをクリック
    const submitButton = page.locator('button[type="submit"], button:has-text("サインイン"), button:has-text("ログイン")');
    await submitButton.click();

    // 認証成功の確認
    await page.waitForURL(url => 
      url.pathname === '/dashboard' || 
      url.pathname === '/checker' ||
      url.pathname === '/', 
      { timeout: 10000 }
    );

    // 認証状態を保存
    await page.context().storageState({ path: 'playwright/.auth/user.json' });
  });
});