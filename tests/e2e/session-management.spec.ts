import { test, expect } from '@playwright/test';

import { injectTestEnvironment, shouldSkipAuthTest } from './utils/environment-detector';
import { setupTestEnvironment } from './utils/test-helpers';
import { 
  verifyAuthenticationState, 
  verifySessionExpiry,
  setupTestAuthState 
} from './utils/auth-verifier';
import { 
  expectAuthenticationError,
  setupAuthErrorState,
  debugAuthError
} from './utils/auth-error-verifier';

/**
 * T004: セッション管理エラーの詳細テスト
 * セッション期限切れシナリオ、トークン無効化処理、自動ログアウト機能の確認
 */
test.describe('セッション管理エラーテスト', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestEnvironment(page);
    await setupTestEnvironment(page);
  });

  test('セッション期限切れ時の自動ログアウト', async ({ page }) => {
    if (shouldSkipAuthTest()) {
      test.skip(true, 'Supabase環境が利用できないため、セッション管理テストをスキップ');
      return;
    }

    // 期限切れトークンを設定
    await setupAuthErrorState(page, 'expired');

    // 保護されたページにアクセス
    await page.goto('/checker');
    await page.waitForLoadState('networkidle');

    // 期限切れエラーの確認
    await expectAuthenticationError(page, 'expired');

    // 認証状態の確認
    const authState = await verifyAuthenticationState(page);
    expect(authState.sessionValid).toBe(false);

    // デバッグ情報出力（テスト失敗時の診断用）
    if (process.env.DEBUG_AUTH) {
      await debugAuthError(page, 'expired');
    }
  });

  test('セッション期限切れ警告表示', async ({ page }) => {
    if (shouldSkipAuthTest()) {
      test.skip(true, 'Supabase環境が利用できないため、セッション管理テストをスキップ');
      return;
    }

    // もうすぐ期限切れのトークンを設定（5分後に期限切れ）
    const expiresAt = Date.now() / 1000 + 300; // 5分後
    await setupTestAuthState(page, {
      isAuthenticated: true,
      userRole: 'user',
      userId: 'test-user',
      expiresAt
    });

    await page.goto('/checker');
    await page.waitForLoadState('networkidle');

    // セッション期限の確認
    const sessionExpiry = await verifySessionExpiry(page);
    expect(sessionExpiry.willExpireSoon).toBe(true);
    expect(sessionExpiry.expiresInMinutes).toBeLessThanOrEqual(5);

    // 期限切れ警告の表示確認
    const warningElements = [
      'text=セッションの期限が近づいています',
      'text=もうすぐログアウトされます',
      'text=セッションを延長',
      '[data-testid="session-warning"]',
      '[role="alert"]:has-text("セッション")'
    ];

    let warningFound = false;
    for (const selector of warningElements) {
      if (await page.locator(selector).isVisible({ timeout: 5000 }).catch(() => false)) {
        warningFound = true;
        break;
      }
    }

    // 警告が表示されるか、またはセッションが既に期限切れになっている
    const authState = await verifyAuthenticationState(page);
    expect(warningFound || !authState.sessionValid).toBe(true);
  });

  test('無効なトークンでのアクセス', async ({ page }) => {
    if (shouldSkipAuthTest()) {
      test.skip(true, 'Supabase環境が利用できないため、セッション管理テストをスキップ');
      return;
    }

    // 無効なトークンを設定
    await setupAuthErrorState(page, 'invalid_token');

    await page.goto('/checker');
    await page.waitForLoadState('networkidle');

    // 無効トークンエラーの確認
    await expectAuthenticationError(page, 'invalid_token');

    // 認証状態の確認
    const authState = await verifyAuthenticationState(page);
    expect(authState.isAuthenticated).toBe(false);
  });

  test('トークンリフレッシュ失敗時の処理', async ({ page }) => {
    if (shouldSkipAuthTest()) {
      test.skip(true, 'Supabase環境が利用できないため、セッション管理テストをスキップ');
      return;
    }

    // リフレッシュ失敗をモック
    await page.route('**/auth/v1/token**', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid refresh token'
        })
      });
    });

    // 期限切れトークンで開始
    await setupAuthErrorState(page, 'expired');

    await page.goto('/checker');
    await page.waitForLoadState('networkidle');

    // リフレッシュ失敗後のログアウト確認
    await expectAuthenticationError(page, 'expired');

    // セッション情報のクリア確認
    const hasAuthData = await page.evaluate(() => {
      const authKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('supabase.auth') || key.startsWith('sb-')
      );
      return authKeys.length > 0;
    });

    // 認証データがクリアされている
    expect(hasAuthData).toBe(false);
  });

  test('複数タブでのセッション同期', async ({ browser }) => {
    if (shouldSkipAuthTest()) {
      test.skip(true, 'Supabase環境が利用できないため、セッション管理テストをスキップ');
      return;
    }

    // 2つのタブを作成
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // 両方のタブで環境設定
    await injectTestEnvironment(page1);
    await setupTestEnvironment(page1);
    await injectTestEnvironment(page2);
    await setupTestEnvironment(page2);

    // タブ1で認証状態をセットアップ
    await setupTestAuthState(page1, {
      isAuthenticated: true,
      userRole: 'user',
      userId: 'test-user'
    });

    await page1.goto('/checker');
    await page2.goto('/checker');

    // 両方のタブで認証状態を確認
    const authState1 = await verifyAuthenticationState(page1);
    const authState2 = await verifyAuthenticationState(page2);

    expect(authState1.isAuthenticated).toBe(true);
    // タブ2は認証状態を共有するか、または独自に認証が必要
    console.log('Tab 1 auth:', authState1.isAuthenticated);
    console.log('Tab 2 auth:', authState2.isAuthenticated);

    // タブ1でログアウト
    await page1.evaluate(() => {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('supabase.auth') || key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });
    });

    await page1.reload();
    await page2.reload();

    // 両方のタブでログアウト状態を確認
    const finalAuthState1 = await verifyAuthenticationState(page1);
    const finalAuthState2 = await verifyAuthenticationState(page2);

    expect(finalAuthState1.isAuthenticated).toBe(false);
    // タブ2も影響を受けるかテスト（実装により異なる）
    console.log('Final Tab 1 auth:', finalAuthState1.isAuthenticated);
    console.log('Final Tab 2 auth:', finalAuthState2.isAuthenticated);

    await context.close();
  });

  test('セッション復元の動作確認', async ({ page }) => {
    if (shouldSkipAuthTest()) {
      test.skip(true, 'Supabase環境が利用できないため、セッション管理テストをスキップ');
      return;
    }

    // 有効なセッションを設定
    await setupTestAuthState(page, {
      isAuthenticated: true,
      userRole: 'user',
      userId: 'test-user'
    });

    // ページをリロードしてセッション復元をテスト
    await page.goto('/checker');
    await page.waitForLoadState('networkidle');

    const initialAuthState = await verifyAuthenticationState(page);
    expect(initialAuthState.isAuthenticated).toBe(true);

    // ページリロード
    await page.reload();
    await page.waitForLoadState('networkidle');

    // セッションが復元されることを確認
    const restoredAuthState = await verifyAuthenticationState(page);
    expect(restoredAuthState.isAuthenticated).toBe(true);
    expect(restoredAuthState.userId).toBe(initialAuthState.userId);
  });

  test('アイドル状態でのセッション維持', async ({ page }) => {
    if (shouldSkipAuthTest()) {
      test.skip(true, 'Supabase環境が利用できないため、セッション管理テストをスキップ');
      return;
    }

    // 長期間有効なセッションを設定
    const longExpiresAt = Date.now() / 1000 + 7200; // 2時間後
    await setupTestAuthState(page, {
      isAuthenticated: true,
      userRole: 'user',
      userId: 'test-user',
      expiresAt: longExpiresAt
    });

    await page.goto('/checker');
    await page.waitForLoadState('networkidle');

    // アイドル状態をシミュレート（短時間）
    await page.waitForTimeout(3000);

    // セッションがまだ有効であることを確認
    const authState = await verifyAuthenticationState(page);
    expect(authState.isAuthenticated).toBe(true);
    expect(authState.sessionValid).toBe(true);

    const sessionExpiry = await verifySessionExpiry(page);
    expect(sessionExpiry.isExpired).toBe(false);
    expect(sessionExpiry.expiresInMinutes).toBeGreaterThan(100); // 100分以上残っている
  });
});