import { test as setup, expect, Page } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

async function checkAuthentication(page: Page) {
  // まずデスクトップ表示でサインアウトボタンを探す
  try {
    await expect(page.getByRole('button', { name: 'サインアウト' })).toBeVisible({ timeout: 3000 });
    return true;
  } catch {
    // 見つからない場合はモバイル表示を想定してメニューを開く
    try {
      const menuButton = page.locator('.md\\:hidden button').first();
      const isMenuButtonVisible = await menuButton.isVisible();
      if (isMenuButtonVisible) {
        await menuButton.click();
        await page.waitForTimeout(500); // メニューが開くのを待機
        await expect(page.getByRole('button', { name: 'サインアウト' })).toBeVisible({ timeout: 3000 });
        // 確認後にメニューを閉じる
        await menuButton.click();
        return true;
      }
    } catch {
      // それでも見つからない場合
    }
    return false;
  }
}

setup('認証状態を保存', async ({ page }) => {
  // トップページに遷移
  await page.goto('/');
  
  // 既に認証済みか確認
  if (await checkAuthentication(page)) {
    console.log('Already authenticated, saving current state');
    await page.context().storageState({ path: authFile });
    return;
  }
  
  // サインインリンクをクリック
  await page.getByRole('main').getByRole('link', { name: 'サインイン' }).click();
  
  // サインインフォームの表示を待機
  await expect(page.getByRole('heading', { name: 'サインイン' })).toBeVisible();
  
  // テスト用の認証情報を入力
  await page.fill('input[type="email"]', "admin@test.com");
  await page.fill('input[type="password"]', "password123");
  
  // 送信
  await page.locator('form button[type="submit"]').click();
  
  // 認証成功を待機
  await expect(page).toHaveURL('/');
  
  // モバイル対応を含めて認証状態を確認
  if (!(await checkAuthentication(page))) {
    throw new Error('Authentication failed - sign out button not found');
  }
  
  // 認証状態を保存
  await page.context().storageState({ path: authFile });
});
