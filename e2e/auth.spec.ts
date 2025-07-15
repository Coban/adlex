import { expect, test } from "@playwright/test";

test.describe("Authentication", () => {
  // Use unauthenticated context for these tests
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
  });

  test("should display sign in page for unauthenticated users", async ({ page }) => {
    // Should redirect to sign in page or show sign in option
    await expect(page.getByRole('main').getByRole('link', { name: 'サインイン' })).toBeVisible();
  });

  test("should allow user to sign in with test credentials", async ({ page }) => {
    // Navigate to sign in page
    await page.getByRole('main').getByRole('link', { name: 'サインイン' }).click();

    // Wait for sign in form to load
    await expect(page.getByRole('heading', { name: 'サインイン' })).toBeVisible();

    // Fill in test credentials
    await page.fill('input[type="email"]', "admin@test.com");
    await page.fill('input[type="password"]', "password123");

    // Submit form - use more specific selector for the form submit button
    await page.locator('form button[type="submit"]').click();

    // Should be redirected to home page and authenticated
    await expect(page).toHaveURL("/");
    
    // Check for authenticated state indicators - look for sign out button instead
    await expect(page.getByRole('button', { name: 'サインアウト' })).toBeVisible({ timeout: 10000 });
  });

  test("should show error for invalid credentials", async ({ page }) => {
    // Navigate to sign in page
    await page.getByRole('main').getByRole('link', { name: 'サインイン' }).click();

    // Fill in invalid credentials
    await page.fill('input[type="email"]', "invalid@test.com");
    await page.fill('input[type="password"]', "wrongpassword");

    // Submit form
    await page.locator('form button[type="submit"]').click();

    // Should show error message (look for any red error text, not specific "エラー")
    await expect(page.locator('.text-red-600')).toBeVisible();
  });

  test("should allow user to sign out", async ({ page }) => {
    // First sign in
    await page.getByRole('main').getByRole('link', { name: 'サインイン' }).click();
    await page.fill('input[type="email"]', "admin@test.com");
    await page.fill('input[type="password"]', "password123");
    await page.locator('form button[type="submit"]').click();

    // Wait for authentication
    await expect(page.getByRole('button', { name: 'サインアウト' })).toBeVisible({ timeout: 10000 });

    // Look for sign out option in navigation
    await page.getByRole('button', { name: 'サインアウト' }).click();

    // Should return to sign in page
    await expect(page.getByRole('main').getByRole('link', { name: 'サインイン' })).toBeVisible();
  });

  test("should allow organization signup", async ({ page }) => {
    // 直接組織アカウント作成ページにアクセス
    await page.goto('/auth/organization-signup');

    // Wait for form to load
    await expect(page.getByRole('heading', { name: '組織アカウント作成' })).toBeVisible();

    // Generate unique email for this test run
    const timestamp = Date.now();
    const testEmail = `test-org-${timestamp}@example.com`;

    // Fill organization signup form using id selectors
    await page.fill('#organizationName', "テスト組織E2E");
    await page.fill('#email', testEmail);
    await page.fill('#password', "password123");
    await page.fill('#confirmPassword', "password123");

    // Submit form
    await page.getByRole('button', { name: '組織アカウント作成' }).click();

    // Should show success message
    await expect(page.locator('text=組織とアカウントが作成されました')).toBeVisible({ timeout: 10000 });
  });
});
