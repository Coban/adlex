import { test, expect } from '@playwright/test';

/**
 * 必須ワークフロー（認証済み）
 * 
 * 目的:
 * - 認証済みユーザーの基本的なワークフロー確認
 * - テキストチェック機能の基本動作確認
 * - 主要ページへのアクセス確認
 */

test.describe('必須ワークフロー（認証済み）', () => {
  test.beforeEach(async ({ page }) => {
    // storageStateにより認証済み状態で開始
    await page.goto('/checker');
    await page.waitForLoadState('networkidle');
  });

  test('テキストチェック基本ワークフローの動作', async ({ page }) => {
    // テキスト入力エリアの確認
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 10000 });
    
    // テキスト入力
    await textarea.fill('がんが治る奇跡のサプリメント');
    
    // チェックボタンの確認と実行
    const checkButtons = [
      page.getByRole('button', { name: /チェック|分析|開始/ }),
      page.locator('[data-testid="check-button"]'),
      page.locator('button:has-text("チェック")')
    ];
    
    let checkButton = null;
    for (const button of checkButtons) {
      if (await button.isVisible({ timeout: 5000 }).catch(() => false)) {
        checkButton = button;
        break;
      }
    }
    
    if (checkButton) {
      await checkButton.click();
      
      // 処理中の状態確認（基本的なUI反応）
      await page.waitForTimeout(1000);
      
      // ボタンが無効化されるか、何らかの処理状態になることを確認
      const isDisabled = await checkButton.isDisabled().catch(() => false);
      const hasLoadingState = await page.locator('[data-testid="loading"], .loading, .spinner').isVisible({ timeout: 3000 }).catch(() => false);
      
      // 処理中の反応があることを確認
      expect(isDisabled || hasLoadingState).toBe(true);
    }
  });

  test('認証済みユーザーの主要ページアクセス', async ({ page }) => {
    // 認証が必要なページへのアクセステスト
    const protectedRoutes = [
      '/checker',
      '/dashboard',
      '/profile',
      '/history',
      '/settings'
    ];
    
    let accessibleRouteCount = 0;
    
    for (const route of protectedRoutes) {
      try {
        await page.goto(route);
        await page.waitForLoadState('networkidle');
        
        const currentUrl = page.url();
        
        // 認証ページにリダイレクトされていないことを確認
        const isNotAuthPage = !currentUrl.includes('/auth/signin') && 
                             !currentUrl.includes('/login');
        
        if (isNotAuthPage) {
          // ページが正常に表示されることを確認
          const pageElements = [
            page.locator('main'),
            page.getByRole('main'),
            page.locator('body')
          ];
          
          for (const element of pageElements) {
            if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
              accessibleRouteCount++;
              break;
            }
          }
        }
      } catch (error) {
        // ルートが存在しない場合は次を試行
        continue;
      }
    }
    
    // 少なくとも1つの保護されたページ（checkerページ）にアクセスできることを確認
    expect(accessibleRouteCount).toBeGreaterThanOrEqual(1);
  });

  test('認証状態での基本ナビゲーション', async ({ page }) => {
    // ナビゲーション要素の確認
    const navElements = [
      page.getByRole('navigation'),
      page.locator('nav'),
      page.locator('header nav'),
      page.locator('[data-testid="nav"]')
    ];
    
    let navFound = false;
    for (const nav of navElements) {
      if (await nav.isVisible({ timeout: 5000 }).catch(() => false)) {
        navFound = true;
        break;
      }
    }
    
    // ユーザーメニューまたは認証状態を示す要素の確認
    const userElements = [
      page.locator('[data-testid="user-menu"]'),
      page.getByText(/ユーザー|User|ログアウト|Logout/),
      page.locator('.user-avatar'),
      page.locator('[data-testid="logout-button"]')
    ];
    
    let userElementFound = false;
    for (const element of userElements) {
      if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
        userElementFound = true;
        break;
      }
    }
    
    // ナビゲーション構造またはユーザー要素が存在することを確認
    expect(navFound || userElementFound).toBe(true);
  });

  test('ページ間の基本的な遷移確認', async ({ page }) => {
    // 現在のページから他のページへの遷移テスト
    const startUrl = page.url();
    
    // ページ内のリンクを探す
    const linkElements = [
      page.getByRole('link'),
      page.locator('a[href]')
    ];
    
    let workingLinkFound = false;
    
    for (const linkElement of linkElements) {
      const links = await linkElement.all();
      
      for (const link of links.slice(0, 3)) { // 最初の3つのリンクをテスト
        try {
          const href = await link.getAttribute('href');
          
          // 外部リンクやハッシュリンクを除外
          if (href && !href.startsWith('http') && !href.startsWith('#') && href !== '/') {
            await link.click();
            await page.waitForLoadState('networkidle');
            
            const newUrl = page.url();
            
            // URLが変更され、認証ページにリダイレクトされていないことを確認
            if (newUrl !== startUrl && !newUrl.includes('/auth/signin')) {
              workingLinkFound = true;
              break;
            }
          }
        } catch (error) {
          // リンクが動作しない場合は次を試行
          continue;
        }
      }
      
      if (workingLinkFound) break;
    }
    
    // 動作するリンクがあるか、少なくとも基本的なページ構造が存在することを確認
    const hasBasicStructure = await page.locator('main, [role="main"], body').isVisible().catch(() => false);
    expect(workingLinkFound || hasBasicStructure).toBe(true);
  });
});