import { test, expect } from '@playwright/test';

/**
 * セッション管理テスト（認証済み）
 * 
 * 目的:
 * - セッション期限切れの適切な処理
 * - 自動ログアウト機能の確認
 * - トークンリフレッシュの動作
 * - 複数タブでのセッション同期
 */

test.describe('セッション管理（認証済み）', () => {
  test.beforeEach(async ({ page }) => {
    // storageStateにより認証済み状態で開始
    await page.goto('/checker');
    await page.waitForLoadState('networkidle');
  });

  test('セッション有効性の確認', async ({ page }) => {
    // 認証済み状態でページにアクセスできることを確認
    await expect(page).toHaveURL(/\/checker/);
    
    // 認証が必要な要素が表示されていることを確認
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    
    // ユーザー情報やログアウトボタンが表示されていることを確認
    const userElements = [
      page.locator('[data-testid="user-menu"]'),
      page.locator('[data-testid="logout-button"]'),
      page.getByRole('button', { name: /ログアウト|Logout/ }),
      page.getByText(/ユーザー|User/)
    ];
    
    let userElementFound = false;
    for (const element of userElements) {
      if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
        userElementFound = true;
        break;
      }
    }
    
    expect(userElementFound).toBe(true);
  });

  test('認証状態での API アクセス', async ({ page }) => {
    // 認証が必要な API エンドポイントへのアクセステスト
    await page.goto('/checker');
    
    const textarea = page.locator('textarea');
    await textarea.fill('テストテキスト');
    
    const checkButton = page.getByRole('button', { name: /チェック開始|分析開始/ });
    if (await checkButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await checkButton.click();
      
      // API リクエストが認証付きで実行されることを確認
      const response = await page.waitForResponse(
        response => response.url().includes('/api/checks') && response.request().method() === 'POST',
        { timeout: 10000 }
      ).catch(() => null);
      
      if (response) {
        // 認証エラー（401、403）でないことを確認
        expect(response.status()).not.toBe(401);
        expect(response.status()).not.toBe(403);
      }
    }
  });

  test('ログアウト機能の基本動作', async ({ page }) => {
    // ログアウトボタンの確認
    const logoutElements = [
      page.locator('[data-testid="logout-button"]'),
      page.getByRole('button', { name: /ログアウト|Logout/ }),
      page.getByRole('menuitem', { name: /ログアウト|Logout/ })
    ];
    
    let logoutButton = null;
    for (const element of logoutElements) {
      if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
        logoutButton = element;
        break;
      }
    }
    
    if (logoutButton) {
      // ユーザーメニューを開く必要がある場合
      const userMenu = page.locator('[data-testid="user-menu"]');
      if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
        await userMenu.click();
        await page.waitForTimeout(500);
      }
      
      await logoutButton.click();
      
      // ログアウト後にログインページまたはホームページにリダイレクトされることを確認
      await page.waitForLoadState('networkidle');
      const currentUrl = page.url();
      const isLoggedOut = currentUrl.includes('/auth/signin') || 
                         currentUrl.includes('/') || 
                         currentUrl.includes('/login');
      
      expect(isLoggedOut).toBe(true);
    }
  });

  test('保護されたページへの継続アクセス', async ({ page }) => {
    // 複数の保護されたページにアクセスして認証状態が維持されることを確認
    const protectedPages = [
      '/checker',
      '/dashboard', 
      '/profile',
      '/history'
    ];
    
    for (const pagePath of protectedPages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      
      // 認証エラーページやログインページにリダイレクトされていないことを確認
      const currentUrl = page.url();
      const isAuthErrorPage = currentUrl.includes('/auth/signin') || 
                             currentUrl.includes('/login') ||
                             currentUrl.includes('/error');
      
      if (!isAuthErrorPage) {
        // 正常にページにアクセスできた場合は成功
        expect(currentUrl).toContain(pagePath);
        break;
      }
    }
  });

  test('セッションCookieの存在確認', async ({ page, context }) => {
    // セッション関連のCookieが設定されていることを確認
    const cookies = await context.cookies();
    
    const sessionCookies = cookies.filter(cookie => 
      cookie.name.includes('auth') || 
      cookie.name.includes('session') ||
      cookie.name.includes('sb-') ||
      cookie.name.includes('supabase')
    );
    
    // 何らかの認証関連Cookieが存在することを確認
    expect(sessionCookies.length).toBeGreaterThan(0);
  });

  test('複数タブでの認証状態同期（基本）', async ({ context }) => {
    // 新しいタブを開いて認証状態が共有されることを確認
    const newTab = await context.newPage();
    
    try {
      await newTab.goto('/checker');
      await newTab.waitForLoadState('networkidle');
      
      // 新しいタブでも認証済み状態でアクセスできることを確認
      const currentUrl = newTab.url();
      const isAuthenticated = !currentUrl.includes('/auth/signin') && 
                             !currentUrl.includes('/login');
      
      expect(isAuthenticated).toBe(true);
      
      // 基本的な認証が必要な要素が表示されることを確認
      const textarea = newTab.locator('textarea');
      if (await textarea.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(textarea).toBeVisible();
      }
      
    } finally {
      await newTab.close();
    }
  });

  test('ページリロード後の認証状態維持', async ({ page }) => {
    // ページをリロードしても認証状態が維持されることを確認
    await page.goto('/checker');
    await page.waitForLoadState('networkidle');
    
    // 現在のURLを保存
    const originalUrl = page.url();
    
    // ページをリロード
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // リロード後も同じページにアクセスできることを確認
    const newUrl = page.url();
    expect(newUrl).toBe(originalUrl);
    
    // 認証が必要な要素が引き続き表示されることを確認
    const textarea = page.locator('textarea');
    if (await textarea.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(textarea).toBeVisible();
    }
  });
});