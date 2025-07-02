import { expect, test } from "@playwright/test";

test.describe("Text Checker", () => {
  test.beforeEach(async ({ page }) => {
    // Sign in before each test
    await page.goto("/auth/signin");
    await page.fill('input[type="email"]', "admin@test.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');

    // Navigate to checker page
    await page.goto("/checker");
  });

  test("should display text checker interface", async ({ page }) => {
    await expect(page.locator("text=薬機法チェック & リライト")).toBeVisible();
    await expect(page.locator("textarea")).toBeVisible();
    await expect(page.locator("text=チェック開始")).toBeVisible();
  });

  test("should show character count", async ({ page }) => {
    const textarea = page.locator("textarea");
    await textarea.fill("テストテキスト");

    await expect(page.locator("text=7 / 10,000文字")).toBeVisible();
  });

  test("should enable check button when text is entered", async ({ page }) => {
    const textarea = page.locator("textarea");
    const checkButton = page.locator("text=チェック開始");

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

    await page.click("text=チェック開始");

    // Should show processing state
    await expect(page.locator("text=チェック中")).toBeVisible();

    // Wait for results (may take some time with real AI)
    await expect(page.locator("text=チェック結果")).toBeVisible({
      timeout: 30000,
    });

    // Should show modified text
    await expect(page.locator("text=修正されたテキスト")).toBeVisible();
  });

  test("should show violation details", async ({ page }) => {
    const textarea = page.locator("textarea");
    await textarea.fill("がんが治るサプリメント");

    await page.click("text=チェック開始");

    // Wait for results
    await expect(page.locator("text=チェック結果")).toBeVisible({
      timeout: 30000,
    });

    // Click on violations tab
    await page.click("text=違反詳細");

    // Should show violation information
    await expect(page.locator("text=違反")).toBeVisible();
  });

  test("should allow copying modified text", async ({ page }) => {
    const textarea = page.locator("textarea");
    await textarea.fill("血圧が下がるサプリメント");

    await page.click("text=チェック開始");

    // Wait for results
    await expect(page.locator("text=チェック結果")).toBeVisible({
      timeout: 30000,
    });

    // Should have copy button
    await expect(page.locator("text=コピー")).toBeVisible();
  });

  test("should maintain check history", async ({ page }) => {
    // Perform first check
    const textarea = page.locator("textarea");
    await textarea.fill("がんが治るサプリメント");
    await page.click("text=チェック開始");
    await expect(page.locator("text=チェック結果")).toBeVisible({
      timeout: 30000,
    });

    // Perform second check
    await textarea.fill("血圧が下がる健康食品");
    await page.click("text=チェック開始");
    await expect(page.locator("text=チェック結果")).toBeVisible({
      timeout: 30000,
    });

    // Should show history
    await expect(page.locator("text=チェック履歴")).toBeVisible();

    // Should have multiple history items
    const historyItems = page.locator(".space-y-2 > div");
    await expect(historyItems).toHaveCount(2);
  });

  test("should enforce character limit", async ({ page }) => {
    // Try to enter more than 10,000 characters
    const longText = "あ".repeat(10001);
    const textarea = page.locator("textarea");

    await textarea.fill(longText);

    // Should be truncated to 10,000 characters
    const value = await textarea.inputValue();
    expect(value.length).toBe(10000);

    await expect(page.locator("text=10,000 / 10,000文字")).toBeVisible();
  });
});
