import { test, expect } from '@playwright/test';

/**
 * 認証リダイレクトテスト（認証不要）
 * 
 * 目的:
 * - 認証が必要なページへの適切なリダイレクト確認
 * - 認証フローの基本動作確認
 * - ログインページの表示確認
 * - フォームバリデーションの基本テスト
 */

test.describe('認証リダイレクト（非認証）', () => {
  test('認証が必要なページへの自動リダイレクト - チェッカー', async ({ page }) => {
    await page.goto('/checker');
    
    // 認証なしでアクセス → ログインページへリダイレクト
    await expect(page).toHaveURL(/\/auth\/signin/);
    
    // ログインフォームの表示確認
    await expect(page.getByRole('heading', { name: /サインイン|ログイン/ })).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /サインイン|ログイン/ })).toBeVisible();
  });

  test('認証が必要なページへの自動リダイレクト - 管理画面', async ({ page }) => {
    await page.goto('/admin/users');
    
    // 認証なしでアクセス → ログインページへリダイレクト
    await expect(page).toHaveURL(/\/auth\/signin/);
    
    // ログインフォームの基本構造確認
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('ログインページの基本構造確認', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.waitForLoadState('networkidle');
    
    // ページタイトル確認
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    
    // フォーム要素の確認
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');
    const submitButton = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();

    // フォーム要素の基本属性確認
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('パスワードフィールドのマスキング確認', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.waitForLoadState('networkidle');
    
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toBeVisible();
    
    // パスワードフィールドのタイプ確認
    const inputType = await passwordInput.getAttribute('type');
    expect(inputType).toBe('password');
    
    // 入力内容の確認
    await passwordInput.fill('testpassword');
    const inputValue = await passwordInput.inputValue();
    expect(inputValue).toBe('testpassword');
  });

  test('フィールドバリデーションテスト', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.locator('#email');
    const submitButton = page.locator('button[type="submit"]');
    
    // 空のフォームで送信を試みる
    await submitButton.click();
    
    // HTML5バリデーションが動作することを確認
    const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(isValid).toBe(false);
    
    // 無効なメールアドレスでのテスト
    await emailInput.fill('invalid-email');
    await submitButton.click();
    
    const isEmailValid = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(isEmailValid).toBe(false);
  });

  test('無効な認証情報でのエラーハンドリング', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.waitForLoadState('networkidle');
    
    // 無効な認証情報でテスト
    await page.locator('#email').fill('invalid@test.com');
    await page.locator('#password').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();
    
    // エラーメッセージの表示確認
    const errorSelectors = [
      '[role="alert"]',
      '.error-message', 
      '.text-red-500',
      '.text-destructive',
      '[data-testid="error-message"]'
    ];
    
    let errorFound = false;
    for (const selector of errorSelectors) {
      if (await page.locator(selector).isVisible({ timeout: 5000 }).catch(() => false)) {
        errorFound = true;
        break;
      }
    }
    
    expect(errorFound).toBe(true);
  });

  test('ログインページからのナビゲーション', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.waitForLoadState('networkidle');
    
    // 新規登録リンクの確認（存在する場合）
    const signupLink = page.getByRole('link', { name: /新規登録|サインアップ|アカウント作成/ });
    if (await signupLink.isVisible().catch(() => false)) {
      await expect(signupLink).toBeVisible();
    }
    
    // パスワードリセットリンクの確認（存在する場合）
    const resetLink = page.getByRole('link', { name: /パスワードを忘れた|パスワードリセット/ });
    if (await resetLink.isVisible().catch(() => false)) {
      await expect(resetLink).toBeVisible();
    }
    
    // ホームページへのリンク確認
    const homeLink = page.getByRole('link', { name: /ホーム|トップ|AdLex/ });
    if (await homeLink.isVisible().catch(() => false)) {
      await expect(homeLink).toBeVisible();
      
      // ホームページへの遷移テスト
      await homeLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL('/');
    }
  });
});