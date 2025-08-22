import { expect, test } from "@playwright/test";

import { injectTestEnvironment } from './utils/environment-detector';

test.describe('テキストチェッカー（基本版）', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestEnvironment(page);
    await page.goto("/checker");
    await page.waitForLoadState('networkidle');
  });

  test('should display text checker interface', async ({ page }) => {
    await expect(page.locator("textarea")).toBeVisible();
    await expect(page.getByRole('button', { name: 'チェック開始' })).toBeVisible();
  });

  test('should show character count', async ({ page }) => {
    const textarea = page.locator("textarea");
    await textarea.fill("テストテキスト");
    
    // Character counter should be visible
    const characterCount = page.locator("text=7");
    await expect(characterCount).toBeVisible();
  });

  test('should enable check button when text is entered', async ({ page }) => {
    const textarea = page.locator("textarea");
    const checkButton = page.getByRole('button', { name: 'チェック開始' });

    // Button should be disabled initially
    await expect(checkButton).toBeDisabled();

    // Enter text
    await textarea.fill("がんが治る奇跡のサプリメント");

    // Button should be enabled
    await expect(checkButton).toBeEnabled();
  });

  test('should start text processing when check button is clicked', async ({ page }) => {
    const textarea = page.locator("textarea");
    const checkButton = page.getByRole('button', { name: 'チェック開始' });
    
    await textarea.fill("がんが治る奇跡のサプリメント！血圧が下がる効果があります。");
    await checkButton.click();

    // Button should be disabled during processing
    await expect(checkButton).toBeDisabled({ timeout: 5000 });
    
    // Some processing indication should appear
    const processingIndicators = [
      page.locator("text=チェック中"),
      page.locator("text=処理中"),
      page.locator(".animate-spin"),
      page.locator("[data-testid='loading']")
    ];
    
    let processingFound = false;
    for (const indicator of processingIndicators) {
      if (await indicator.isVisible({ timeout: 2000 }).catch(() => false)) {
        processingFound = true;
        break;
      }
    }
    
    expect(processingFound).toBe(true);
  });
})