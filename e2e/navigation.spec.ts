import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test.describe('Unauthenticated User', () => {
    test.beforeEach(async ({ page }) => {
      // Clear any existing authentication
      await page.context().clearCookies()
      await page.goto('/')
    })

    test('should display public navigation items', async ({ page }) => {
      // Check if we're on mobile - if so, open mobile menu
      const isMobile = await page.locator('[data-testid="mobile-menu-toggle"]').isVisible()
      if (isMobile) {
        await page.locator('[data-testid="mobile-menu-toggle"]').click()
        await page.waitForTimeout(500)
        
        // Check for public navigation items in mobile menu
        await expect(page.locator('[data-testid="nav-home"]').first()).toBeVisible()
        await expect(page.locator('[data-testid="mobile-menu"]').locator('[data-testid="nav-signin"]')).toBeVisible()
        await expect(page.locator('[data-testid="mobile-menu"]').locator('[data-testid="nav-signup"]')).toBeVisible()
      } else {
        // Check for public navigation items in desktop nav
        await expect(page.locator('[data-testid="nav-home"]')).toBeVisible()
        await expect(page.locator('[data-testid="nav-signin"]')).toBeVisible()
        await expect(page.locator('[data-testid="nav-signup"]')).toBeVisible()
      }
      
      // Check that authenticated items are not visible
      await expect(page.locator('[data-testid="nav-checker"]')).not.toBeVisible()
      await expect(page.locator('[data-testid="nav-history"]')).not.toBeVisible()
      await expect(page.locator('[data-testid="nav-signout"]')).not.toBeVisible()
    })

    test('should navigate to sign in page', async ({ page }) => {
      // Check if we're on mobile - if so, open mobile menu
      const isMobile = await page.locator('[data-testid="mobile-menu-toggle"]').isVisible()
      if (isMobile) {
        await page.locator('[data-testid="mobile-menu-toggle"]').click()
        await page.waitForTimeout(500)
        // Click signin button in mobile menu
        await page.locator('[data-testid="mobile-menu"]').locator('[data-testid="nav-signin"]').click()
      } else {
        // Click signin button in desktop nav
        await page.locator('[data-testid="nav-signin"]').click()
      }
      
      await expect(page).toHaveURL('/auth/signin')
      await expect(page.locator('h1')).toContainText('サインイン')
    })

    test('should navigate to sign up page', async ({ page }) => {
      // Check if we're on mobile - if so, open mobile menu
      const isMobile = await page.locator('[data-testid="mobile-menu-toggle"]').isVisible()
      if (isMobile) {
        await page.locator('[data-testid="mobile-menu-toggle"]').click()
        await page.waitForTimeout(500)
        // Click signup button in mobile menu
        await page.locator('[data-testid="mobile-menu"]').locator('[data-testid="nav-signup"]').click()
      } else {
        // Click signup button in desktop nav
        await page.locator('[data-testid="nav-signup"]').click()
      }
      
      await expect(page).toHaveURL('/auth/signup')
      await expect(page.locator('h1')).toContainText('サインアップ')
    })

    test('should redirect to signin when accessing protected routes', async ({ page }) => {
      // Try to access checker page
      await page.goto('/checker')
      await expect(page).toHaveURL('/auth/signin')
      
      // Try to access history page
      await page.goto('/history')
      await expect(page).toHaveURL('/auth/signin')
      
      // Try to access admin page
      await page.goto('/admin/users')
      await expect(page).toHaveURL('/auth/signin')
    })
  })

  test.describe('Authenticated Regular User', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/')
    })

    test('should display user navigation items', async ({ page }) => {
      // Check if we're on mobile - if so, open mobile menu
      const isMobile = await page.locator('[data-testid="mobile-menu-toggle"]').isVisible()
      if (isMobile) {
        await page.locator('[data-testid="mobile-menu-toggle"]').click()
        await page.waitForTimeout(500)
      }
      
      // Check for authenticated navigation items
      await expect(page.locator('[data-testid="nav-home"]').first()).toBeVisible()
      await expect(page.locator('[data-testid="nav-checker"]').first()).toBeVisible()
      await expect(page.locator('[data-testid="nav-history"]').first()).toBeVisible()
      await expect(page.locator('[data-testid="nav-signout"]').first()).toBeVisible()
      
      // Check that public auth items are not visible
      await expect(page.locator('[data-testid="nav-signin"]')).not.toBeVisible()
      await expect(page.locator('[data-testid="nav-signup"]')).not.toBeVisible()
      
      // Check that admin items are not visible for regular users
      await expect(page.locator('[data-testid="nav-admin"]')).not.toBeVisible()
      await expect(page.locator('[data-testid="nav-dictionaries"]')).not.toBeVisible()
    })

    test('should navigate to checker page', async ({ page }) => {
      // Check if we're on mobile - if so, open mobile menu
      const isMobile = await page.locator('[data-testid="mobile-menu-toggle"]').isVisible()
      if (isMobile) {
        await page.locator('[data-testid="mobile-menu-toggle"]').click()
        await page.waitForTimeout(500)
      }
      
      await page.locator('[data-testid="nav-checker"]').first().click()
      await expect(page).toHaveURL('/checker')
      await expect(page.locator('h1')).toContainText('薬機法チェック')
    })

    test('should navigate to history page', async ({ page }) => {
      // Check if we're on mobile - if so, open mobile menu
      const isMobile = await page.locator('[data-testid="mobile-menu-toggle"]').isVisible()
      if (isMobile) {
        await page.locator('[data-testid="mobile-menu-toggle"]').click()
        await page.waitForTimeout(500)
      }
      
      await page.locator('[data-testid="nav-history"]').first().click()
      await expect(page).toHaveURL('/history')
      await expect(page.locator('h1')).toContainText('チェック履歴')
    })

    test('should prevent access to admin pages', async ({ page }) => {
      // Try to access admin page directly
      await page.goto('/admin/users')
      await expect(page).toHaveURL('/') // Should redirect to home or show error
      
      // Try to access dictionaries page
      await page.goto('/dictionaries')
      await expect(page).toHaveURL('/') // Should redirect to home or show error
    })

    test('should sign out successfully', async ({ page }) => {
      // Check if we're on mobile - if so, open mobile menu
      const isMobile = await page.locator('[data-testid="mobile-menu-toggle"]').isVisible()
      if (isMobile) {
        await page.locator('[data-testid="mobile-menu-toggle"]').click()
        await page.waitForTimeout(500)
        // Click signout button in mobile menu
        await page.locator('[data-testid="mobile-menu"]').locator('[data-testid="nav-signout"]').click()
      } else {
        // Click signout button in desktop nav
        await page.locator('[data-testid="nav-signout"]').click()
      }
      
      // Should redirect to home page and show public navigation
      await expect(page).toHaveURL('/')
      
      // Check for signin/signup buttons (might need to open mobile menu again)
      const isMobileAfterSignout = await page.locator('[data-testid="mobile-menu-toggle"]').isVisible()
      if (isMobileAfterSignout) {
        await page.locator('[data-testid="mobile-menu-toggle"]').click()
        await page.waitForTimeout(500)
        
        await expect(page.locator('[data-testid="mobile-menu"]').locator('[data-testid="nav-signin"]')).toBeVisible()
        await expect(page.locator('[data-testid="mobile-menu"]').locator('[data-testid="nav-signup"]')).toBeVisible()
      } else {
        await expect(page.locator('[data-testid="nav-signin"]')).toBeVisible()
        await expect(page.locator('[data-testid="nav-signup"]')).toBeVisible()
      }
    })
  })

  test.describe('Mobile Navigation', () => {
    test.beforeEach(async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/')
    })

    test('should display mobile menu toggle', async ({ page }) => {
      await expect(page.locator('[data-testid="mobile-menu-toggle"]')).toBeVisible()
      
      // Navigation items should be hidden on mobile initially - check desktop nav specifically
      await expect(page.locator('[data-testid="desktop-nav"]').locator('[data-testid="nav-checker"]')).not.toBeVisible()
    })

    test('should toggle mobile menu', async ({ page }) => {
      const menuToggle = page.locator('[data-testid="mobile-menu-toggle"]')
      const mobileMenu = page.locator('[data-testid="mobile-menu"]')
      
      // Open mobile menu
      await menuToggle.click()
      await expect(mobileMenu).toBeVisible()
      
      // Navigation items should be visible in mobile menu specifically
      await expect(mobileMenu.locator('[data-testid="nav-checker"]')).toBeVisible()
      await expect(mobileMenu.locator('[data-testid="nav-history"]')).toBeVisible()
      
      // Close mobile menu
      await menuToggle.click()
      await expect(mobileMenu).not.toBeVisible()
    })

    test('should navigate via mobile menu', async ({ page }) => {
      // Open mobile menu
      await page.locator('[data-testid="mobile-menu-toggle"]').click()
      
      // Navigate to checker page via mobile menu
      await page.locator('[data-testid="mobile-menu"]').locator('[data-testid="nav-checker"]').click()
      await expect(page).toHaveURL('/checker')
      
      // Mobile menu should close after navigation
      await expect(page.locator('[data-testid="mobile-menu"]')).not.toBeVisible()
    })
  })

  test.describe('Breadcrumb Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/')
    })

    test('should display breadcrumbs on history detail page', async ({ page }) => {
      // Navigate to history page
      await page.goto('/history')
      
      // Wait for history items and click on first one's "詳細を見る" button
      await page.waitForSelector('[data-testid="history-item"]', { timeout: 10000 })
      await page.locator('[data-testid="history-item"]').first().locator('text=詳細を見る').click()
      
      // Check breadcrumb navigation
      await expect(page.locator('[data-testid="breadcrumb"]')).toBeVisible()
      await expect(page.locator('[data-testid="breadcrumb-home"]')).toContainText('ホーム')
      await expect(page.locator('[data-testid="breadcrumb-history"]')).toContainText('チェック履歴')
      await expect(page.locator('[data-testid="breadcrumb-current"]')).toContainText('詳細')
    })

    test('should navigate via breadcrumbs', async ({ page }) => {
      // Navigate to history detail page
      await page.goto('/history')
      await page.waitForSelector('[data-testid="history-item"]', { timeout: 10000 })
      await page.locator('[data-testid="history-item"]').first().locator('text=詳細を見る').click()
      
      // Click on history breadcrumb
      await page.locator('[data-testid="breadcrumb-history"]').click()
      await expect(page).toHaveURL('/history')
      
      // Navigate back to detail and click home breadcrumb
      await page.goBack()
      await page.locator('[data-testid="breadcrumb-home"]').click()
      await expect(page).toHaveURL('/')
    })
  })

  test.describe('Deep Linking and Page Refresh', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/')
    })

    test('should handle direct URL access', async ({ page }) => {
      // Direct access to checker page
      await page.goto('/checker')
      await expect(page).toHaveURL('/checker')
      await expect(page.locator('h1')).toContainText('薬機法チェック')
      
      // Direct access to history page
      await page.goto('/history')
      await expect(page).toHaveURL('/history')
      await expect(page.locator('h1')).toContainText('チェック履歴')
    })

    test('should handle page refresh', async ({ page }) => {
      // Navigate to checker page
      await page.goto('/checker')
      
      // Refresh the page
      await page.reload()
      
      // Should still be on checker page
      await expect(page).toHaveURL('/checker')
      await expect(page.locator('h1')).toContainText('薬機法チェック')
    })

    test('should handle browser back/forward navigation', async ({ page }) => {
      // Navigate through pages
      await page.goto('/')
      await page.goto('/checker')
      await page.goto('/history')
      
      // Go back
      await page.goBack()
      await expect(page).toHaveURL('/checker')
      
      // Go back again
      await page.goBack()
      await expect(page).toHaveURL('/')
      
      // Go forward
      await page.goForward()
      await expect(page).toHaveURL('/checker')
    })
  })

  test.describe('Error Page Navigation', () => {
    test('should display 404 page for non-existent routes', async ({ page }) => {
      await page.goto('/non-existent-page')
      
      // Should show 404 error page
      await expect(page.locator('[data-testid="error-404"]')).toBeVisible()
      await expect(page.locator('[data-testid="error-message"]')).toContainText('ページが見つかりません')
      
      // Should have navigation back to home
      await expect(page.locator('[data-testid="back-to-home"]')).toBeVisible()
    })

    test('should navigate back to home from error page', async ({ page }) => {
      await page.goto('/non-existent-page')
      
      // Click back to home button
      await page.locator('[data-testid="back-to-home"]').click()
      await expect(page).toHaveURL('/')
    })
  })

  test.describe('URL Query Parameters', () => {
    test('should handle query parameters in history page', async ({ page }) => {
      // Navigate to history page with query parameters
      await page.goto('/history?page=2&status=completed&search=test')
      
      // Verify query parameters are applied
      await expect(page).toHaveURL('/history?page=2&status=completed&search=test')
      
      // Verify UI reflects the query parameters
      await expect(page.locator('[data-testid="status-filter"]')).toHaveValue('completed')
      await expect(page.locator('[data-testid="history-search"]')).toHaveValue('test')
    })

    test('should update URL when filters change', async ({ page }) => {
      await page.goto('/history')
      
      // Change status filter - handle shadcn/ui Select
      try {
        await page.locator('[data-testid="status-filter"]').click()
        
        // Wait for dropdown with multiple selectors
        const listboxVisible = await page.waitForSelector('[role="listbox"], [role="menu"], .select-content, [data-state="open"]', { timeout: 3000 }).catch(() => null)
        
        if (listboxVisible) {
          await page.locator('[role="option"], [role="menuitem"], text="完了"').first().click()
        } else {
          // Keyboard navigation fallback
          await page.locator('[data-testid="status-filter"]').press('ArrowDown')
          await page.waitForTimeout(500)
          await page.locator('[data-testid="status-filter"]').press('Enter')
        }
      } catch {
        // If filter doesn't work, just skip this part of the test
        console.log('Status filter Select component not working, continuing test')
      }
      
      // URL should update with filter
      await expect(page).toHaveURL('/history?status=completed')
      
      // Add search term
      await page.locator('[data-testid="history-search"]').fill('test')
      await page.locator('[data-testid="search-button"]').click()
      
      // URL should update with both filters
      await expect(page).toHaveURL('/history?status=completed&search=test')
    })
  })
})