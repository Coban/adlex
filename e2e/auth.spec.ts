import { expect, test } from "@playwright/test";

test.describe("Authentication", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
  });

  test("should display sign in page for unauthenticated users", async ({ page }) => {
    // Should redirect to sign in page or show sign in option
    await expect(page.locator("text=サインイン")).toBeVisible();
  });

  test("should allow user to sign in with test credentials", async ({ page }) => {
    // Navigate to sign in page
    await page.click("text=サインイン");

    // Fill in test credentials
    await page.fill('input[type="email"]', "admin@test.com");
    await page.fill('input[type="password"]', "password123");

    // Submit form
    await page.click('button[type="submit"]');

    // Should be redirected to dashboard or main page
    await expect(page.locator("text=薬機法チェック")).toBeVisible();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.click("text=サインイン");

    await page.fill('input[type="email"]', "invalid@test.com");
    await page.fill('input[type="password"]', "wrongpassword");

    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator("text=エラー")).toBeVisible();
  });

  test("should allow user to sign out", async ({ page }) => {
    // First sign in
    await page.click("text=サインイン");
    await page.fill('input[type="email"]', "admin@test.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');

    // Wait for successful sign in
    await expect(page.locator("text=薬機法チェック")).toBeVisible();

    // Look for sign out option in navigation
    await page.click('[data-testid="user-menu"]');
    await page.click("text=サインアウト");

    // Should return to sign in page
    await expect(page.locator("text=サインイン")).toBeVisible();
  });

  test("should allow organization signup", async ({ page }) => {
    await page.click("text=組織アカウント作成");

    // Fill organization signup form
    await page.fill('input[name="organizationName"]', "テスト組織E2E");
    await page.fill('input[type="email"]', "e2e-test@example.com");
    await page.fill('input[name="password"]', "password123");
    await page.fill('input[name="confirmPassword"]', "password123");

    await page.click('button[type="submit"]');

    // Should show success message
    await expect(page.locator("text=組織とアカウントが作成されました"))
      .toBeVisible();
  });
});
