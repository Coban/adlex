import { expect, test } from "@playwright/test";

test.describe("Text Checker", () => {
  test.beforeEach(async ({ page }) => {
    // Sign in before each test
    await page.goto("/auth/signin");
    
    // Wait for sign in form to load
    await expect(page.getByRole('heading', { name: 'サインイン' })).toBeVisible();
    
    await page.fill('input[type="email"]', "admin@test.com");
    await page.fill('input[type="password"]', "password123");
    await page.locator('form button[type="submit"]').click();

    // Wait for authentication
    await expect(page).toHaveURL("/");
    await expect(page.getByRole('button', { name: 'サインアウト' })).toBeVisible({ timeout: 10000 });

    // Navigate to checker page
    await page.goto("/checker");
    
    // Wait for page to fully load
    await page.waitForTimeout(5000);
    
    // Check for either the main heading or sign-in request message
    const pageContent = await page.content();
    
    if (pageContent.includes('ログインが必要です')) {
      // If we see login required message, re-authenticate
      console.log('Re-authentication required on checker page');
      await page.goto("/auth/signin");
      await page.fill('input[type="email"]', "admin@test.com");
      await page.fill('input[type="password"]', "password123");
      await page.locator('form button[type="submit"]').click();
      await expect(page).toHaveURL("/");
      await page.goto("/checker");
      await page.waitForTimeout(3000);
    }
    
    // Wait for checker page main heading
    await expect(page.getByRole('heading', { name: '薬機法チェック & リライト' })).toBeVisible({ timeout: 15000 });
  });

  test("should display text checker interface", async ({ page }) => {
    await expect(page.getByRole('heading', { name: '薬機法チェック & リライト' })).toBeVisible();
    await expect(page.locator("textarea")).toBeVisible();
    await expect(page.getByRole('button', { name: 'チェック開始' })).toBeVisible();
  });

  test("should show character count", async ({ page }) => {
    const textarea = page.locator("textarea");
    await textarea.fill("テストテキスト");

    await expect(page.locator("text=7 / 10,000文字")).toBeVisible();
  });

  test("should enable check button when text is entered", async ({ page }) => {
    const textarea = page.locator("textarea");
    const checkButton = page.getByRole('button', { name: 'チェック開始' });

    // Button should be disabled initially
    await expect(checkButton).toBeDisabled();

    // Enter text
    await textarea.fill("がんが治る奇跡のサプリメント");

    // Button should be enabled
    await expect(checkButton).toBeEnabled();
  });

  test("should perform text check and show results", async ({ page }) => {
    const textarea = page.locator("textarea");
    await textarea.fill(
      "がんが治る奇跡のサプリメント！血圧が下がる効果があります。",
    );

    await page.getByRole('button', { name: 'チェック開始' }).click();

    // Wait for results to appear
    await expect(page.locator("text=チェック結果")).toBeVisible({
      timeout: 30000,
    });

    // Check that results are displayed
    await expect(page.locator(".border.rounded.p-4")).toBeVisible();
  });

  test("should show violation details", async ({ page }) => {
    const textarea = page.locator("textarea");
    await textarea.fill("がんが治るサプリメント");

    await page.getByRole('button', { name: 'チェック開始' }).click();

    // Wait for results
    await expect(page.locator("text=チェック結果")).toBeVisible({
      timeout: 30000,
    });

    // Switch to violations tab
    await page.getByRole('tab', { name: '違反詳細' }).click();

    // Check for violation details
    await expect(page.locator("text=違反箇所")).toBeVisible();
  });

  test("should allow copying modified text", async ({ page }) => {
    const textarea = page.locator("textarea");
    await textarea.fill("血圧が下がるサプリメント");

    await page.getByRole('button', { name: 'チェック開始' }).click();

    // Wait for results
    await expect(page.locator("text=チェック結果")).toBeVisible({
      timeout: 30000,
    });

    // Check that copy button is available
    await expect(page.getByRole('button', { name: 'コピー' })).toBeVisible();
  });

  test("should maintain check history", async ({ page }) => {
    // Perform first check
    const textarea = page.locator("textarea");
    await textarea.fill("がんが治るサプリメント");
    await page.getByRole('button', { name: 'チェック開始' }).click();
    await expect(page.locator("text=チェック結果")).toBeVisible({
      timeout: 30000,
    });

    // Perform second check
    await textarea.fill("血圧改善サプリメント");
    await page.getByRole('button', { name: 'チェック開始' }).click();
    await expect(page.locator("text=チェック結果")).toBeVisible({
      timeout: 30000,
    });

    // Check that history is shown
    await expect(page.locator("text=チェック履歴")).toBeVisible();
    
    // Should have multiple history items
    const historyItems = page.locator('[class*="cursor-pointer"]');
    await expect(historyItems).toHaveCount(2);
  });

  test("should enforce character limit", async ({ page }) => {
    // Create text longer than 10,000 characters
    const longText = "あ".repeat(10001);
    const textarea = page.locator("textarea");

    await textarea.fill(longText);

    // Should be truncated to 10,000 characters
    const value = await textarea.inputValue();
    expect(value).toHaveLength(10000);

    // Character count should show limit
    await expect(page.locator("text=10,000 / 10,000文字")).toBeVisible();
  });
});
