import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the signin page
  await page.goto('/');
  
  // Check if we're already authenticated
  try {
    await expect(page.getByRole('button', { name: 'サインアウト' })).toBeVisible({ timeout: 5000 });
    console.log('Already authenticated, saving current state');
    await page.context().storageState({ path: authFile });
    return;
  } catch {
    // Not authenticated, proceed with login
  }
  
  // Click on signin link
  await page.getByRole('main').getByRole('link', { name: 'サインイン' }).click();
  
  // Wait for sign in form to load
  await expect(page.getByRole('heading', { name: 'サインイン' })).toBeVisible();
  
  // Fill in test credentials
  await page.fill('input[type="email"]', "admin@test.com");
  await page.fill('input[type="password"]', "password123");
  
  // Submit form
  await page.locator('form button[type="submit"]').click();
  
  // Wait for successful authentication
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: 'サインアウト' })).toBeVisible({ timeout: 10000 });
  
  // Save the authentication state
  await page.context().storageState({ path: authFile });
});
