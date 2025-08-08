import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

async function checkAuthentication(page: any) {
  // Try to find the sign out button in desktop view first
  try {
    await expect(page.getByRole('button', { name: 'サインアウト' })).toBeVisible({ timeout: 3000 });
    return true;
  } catch {
    // If not found, check if we're on mobile and need to open the menu
    try {
      const menuButton = page.locator('.md\\:hidden button').first();
      const isMenuButtonVisible = await menuButton.isVisible();
      if (isMenuButtonVisible) {
        await menuButton.click();
        await page.waitForTimeout(500); // Wait for menu to open
        await expect(page.getByRole('button', { name: 'サインアウト' })).toBeVisible({ timeout: 3000 });
        // Close the menu after checking
        await menuButton.click();
        return true;
      }
    } catch {
      // Still not found
    }
    return false;
  }
}

setup('authenticate', async ({ page }) => {
  // Navigate to the signin page
  await page.goto('/');
  
  // Check if we're already authenticated
  if (await checkAuthentication(page)) {
    console.log('Already authenticated, saving current state');
    await page.context().storageState({ path: authFile });
    return;
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
  
  // Check authentication with mobile support
  if (!(await checkAuthentication(page))) {
    throw new Error('Authentication failed - sign out button not found');
  }
  
  // Save the authentication state
  await page.context().storageState({ path: authFile });
});
