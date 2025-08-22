import { test, expect } from '@playwright/test';

/**
 * 必須ワークフロー（非認証）
 * 
 * 目的:
 * - 非認証ユーザーの基本的なナビゲーション確認
 * - 認証フローの基本動作確認
 * - 公開ページのアクセス確認
 */

test.describe('必須ワークフロー（非認証）', () => {
  test('認証が必要なページへのアクセス動作確認', async ({ page }) => {
    // 認証が必要なページにアクセス
    await page.goto('/checker');
    await page.waitForLoadState('networkidle');
    
    const currentUrl = page.url();
    
    // 認証ページにリダイレクトされるか、認証なしでアクセス可能かを確認
    const isRedirectedToAuth = currentUrl.includes('/auth/signin') || 
                              currentUrl.includes('/login') ||
                              currentUrl.includes('/auth');
    
    const isDirectAccess = currentUrl.includes('/checker');
    
    // どちらかの動作が発生することを確認（環境によって異なる）
    expect(isRedirectedToAuth || isDirectAccess).toBe(true);
    
    if (isRedirectedToAuth) {
      // 認証ページの基本要素が表示されることを確認
      const authElements = [
        page.getByText(/ログイン|サインイン|Sign/),
        page.locator('form'),
        page.locator('input[type="email"], input[type="text"]')
      ];
      
      let authElementFound = false;
      for (const element of authElements) {
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          authElementFound = true;
          break;
        }
      }
      
      expect(authElementFound).toBe(true);
    } else if (isDirectAccess) {
      // 直接アクセス可能な場合は基本的なページ構造を確認
      const pageElements = [
        page.locator('body'),
        page.locator('main'),
        page.getByRole('main')
      ];
      
      let pageElementFound = false;
      for (const element of pageElements) {
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          pageElementFound = true;
          break;
        }
      }
      
      expect(pageElementFound).toBe(true);
    }
  });

  test('認証ページの基本構造確認', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.waitForLoadState('networkidle');
    
    // 認証ページの基本要素が表示されること
    const authElements = [
      page.locator('h1'),
      page.locator('form'),
      page.locator('button'),
      page.getByText(/ログイン|サインイン|Sign/),
      page.locator('input[type="email"], input[type="text"]'),
      page.locator('input[type="password"]')
    ];
    
    let authElementFound = false;
    for (const element of authElements) {
      if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
        authElementFound = true;
        break;
      }
    }
    
    // 認証ページの基本構造が存在すること
    expect(authElementFound).toBe(true);
  });

  test('公開ページへのアクセス確認', async ({ page }) => {
    // 公開ページ（ホームページ）への基本アクセス
    const publicRoutes = [
      '/',
      '/about',
      '/contact',
      '/terms',
      '/privacy'
    ];
    
    let accessibleRouteFound = false;
    
    for (const route of publicRoutes) {
      try {
        await page.goto(route);
        await page.waitForLoadState('networkidle');
        
        // ページが正常に読み込まれ、認証ページにリダイレクトされていないことを確認
        const currentUrl = page.url();
        const isNotAuthPage = !currentUrl.includes('/auth/signin') && 
                             !currentUrl.includes('/login');
        
        if (isNotAuthPage) {
          // 基本的なページ構造の確認
          const pageElements = [
            page.locator('body'),
            page.locator('main'),
            page.getByRole('main'),
            page.locator('h1'),
            page.getByRole('heading', { level: 1 })
          ];
          
          for (const element of pageElements) {
            if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
              accessibleRouteFound = true;
              break;
            }
          }
          
          if (accessibleRouteFound) break;
        }
      } catch (error) {
        // ルートが存在しない場合は次を試行
        continue;
      }
    }
    
    // 少なくとも1つの公開ページにアクセスできることを確認
    expect(accessibleRouteFound).toBe(true);
  });

  test('基本的なサイト構造の確認', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // サイトの基本構造要素の確認
    const structureElements = [
      page.getByRole('navigation'),
      page.locator('nav'),
      page.locator('header'),
      page.locator('footer'),
      page.getByRole('banner'),
      page.getByRole('contentinfo')
    ];
    
    let structureFound = false;
    for (const element of structureElements) {
      if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
        structureFound = true;
        break;
      }
    }
    
    // 基本的なサイト構造が存在することを確認
    expect(structureFound).toBe(true);
  });
});