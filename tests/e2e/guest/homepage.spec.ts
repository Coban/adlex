import { test, expect } from '@playwright/test';

/**
 * 公開ページのテスト（認証不要）
 * 
 * 目的:
 * - ランディングページの基本表示確認
 * - 公開情報の表示検証
 * - SEO要素の確認
 * - レスポンシブデザインの基本動作
 */

test.describe('ホームページ（非認証）', () => {
  test('ランディングページの基本表示', async ({ page }) => {
    await page.goto('/');

    // 基本要素の表示確認
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('AdLex')).toBeVisible();

    // ナビゲーション要素
    await expect(page.getByRole('navigation')).toBeVisible();
    
    // CTA（Call to Action）ボタンの確認
    const loginButton = page.getByRole('link', { name: /ログイン|サインイン/ });
    const signupButton = page.getByRole('link', { name: /新規登録|サインアップ/ });
    
    // ログインまたはサインアップボタンのいずれかが表示されている
    const hasAuthButton = await loginButton.isVisible().catch(() => false) ||
                         await signupButton.isVisible().catch(() => false);
    expect(hasAuthButton).toBe(true);
  });

  test('サービス説明セクションの表示', async ({ page }) => {
    await page.goto('/');

    // 薬機法チェック機能の説明
    const serviceDescriptions = [
      '薬機法',
      'チェック',
      'AI',
      '違反',
      'テキスト'
    ];

    // サービス説明のキーワードが含まれているか確認
    let foundDescriptions = 0;
    for (const keyword of serviceDescriptions) {
      if (await page.getByText(keyword, { exact: false }).isVisible().catch(() => false)) {
        foundDescriptions++;
      }
    }

    expect(foundDescriptions).toBeGreaterThan(2); // 最低3つのキーワードが表示されている
  });

  test('フッター情報の表示', async ({ page }) => {
    await page.goto('/');

    // フッターの存在確認
    const footer = page.locator('footer, [role="contentinfo"]');
    if (await footer.isVisible().catch(() => false)) {
      await expect(footer).toBeVisible();

      // 一般的なフッター要素の確認
      const footerElements = [
        'プライバシーポリシー',
        '利用規約',
        'お問い合わせ',
        'コピーライト',
        '©'
      ];

      let foundElements = 0;
      for (const element of footerElements) {
        if (await page.getByText(element, { exact: false }).isVisible().catch(() => false)) {
          foundElements++;
        }
      }

      expect(foundElements).toBeGreaterThan(0);
    }
  });

  test('モバイル表示の基本確認', async ({ page }) => {
    // モバイルビューポートに設定
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // モバイル用ナビゲーション
    const mobileNav = page.locator('[data-testid="mobile-nav"], .mobile-menu, button[aria-label*="menu" i]');
    const desktopNav = page.getByRole('navigation');

    // モバイル用メニューまたは通常のナビゲーションが表示されている
    const hasNavigation = await mobileNav.isVisible().catch(() => false) ||
                         await desktopNav.isVisible().catch(() => false);
    expect(hasNavigation).toBe(true);

    // メインコンテンツの表示確認
    await expect(page.getByRole('main', { includeHidden: false })).toBeVisible();
  });

  test('SEO基本要素の確認', async ({ page }) => {
    await page.goto('/');

    // タイトルタグ
    await expect(page).toHaveTitle(/AdLex|薬機法/);

    // メタディスクリプション
    const metaDescription = page.locator('meta[name="description"]');
    if (await metaDescription.count() > 0) {
      const content = await metaDescription.getAttribute('content');
      expect(content).toBeTruthy();
      expect(content!.length).toBeGreaterThan(50); // 最低50文字以上
    }

    // 基本的なheading構造
    const h1Count = await page.getByRole('heading', { level: 1 }).count();
    expect(h1Count).toBeGreaterThanOrEqual(1); // H1が最低1つ存在
  });

  test('パフォーマンスの基本確認', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // 5秒以内でのロード完了を期待
    expect(loadTime).toBeLessThan(5000);

    // 基本的なCore Web Vitalsの確認
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      };
    });

    // DOMContentLoadedが2秒以内
    expect(metrics.domContentLoaded).toBeLessThan(2000);
  });
});