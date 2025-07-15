import { test, expect } from '@playwright/test'

test.describe('Mobile Responsiveness', () => {
  test.describe('Mobile Layout - Phone', () => {
    test.beforeEach(async ({ page }) => {
      // Set mobile viewport (iPhone 12)
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto('/')
    })

    test('should display mobile navigation correctly', async ({ page }) => {
      // Mobile menu toggle should be visible
      await expect(page.locator('[data-testid="mobile-menu-toggle"]')).toBeVisible()
      
      // Desktop navigation should be hidden
      await expect(page.locator('[data-testid="desktop-nav"]')).not.toBeVisible()
      
      // Menu items should be hidden initially
      await expect(page.locator('[data-testid="nav-checker"]')).not.toBeVisible()
    })

    test('should open and close mobile menu', async ({ page }) => {
      const menuToggle = page.locator('[data-testid="mobile-menu-toggle"]')
      const mobileMenu = page.locator('[data-testid="mobile-menu"]')
      
      // Open menu
      await menuToggle.click()
      await expect(mobileMenu).toBeVisible()
      
      // Menu items should be visible
      await expect(page.locator('[data-testid="nav-checker"]')).toBeVisible()
      await expect(page.locator('[data-testid="nav-history"]')).toBeVisible()
      
      // Close menu by clicking toggle again
      await menuToggle.click()
      await expect(mobileMenu).not.toBeVisible()
    })

    test('should close mobile menu when clicking outside', async ({ page }) => {
      const menuToggle = page.locator('[data-testid="mobile-menu-toggle"]')
      const mobileMenu = page.locator('[data-testid="mobile-menu"]')
      
      // Open menu
      await menuToggle.click()
      await expect(mobileMenu).toBeVisible()
      
      // Click outside menu
      await page.click('body', { position: { x: 50, y: 50 } })
      
      // Menu should close
      await expect(mobileMenu).not.toBeVisible()
    })

    test('should display text checker in mobile layout', async ({ page }) => {
      await page.goto('/checker')
      
      // Text input should be full width on mobile
      const textInput = page.locator('[data-testid="text-input"]')
      await expect(textInput).toBeVisible()
      
      // Check button should be properly sized
      await expect(page.locator('[data-testid="check-button"]')).toBeVisible()
      
      // Results section should stack vertically
      await textInput.fill('モバイルテスト')
      await page.locator('[data-testid="check-button"]').click()
      
      // Wait for results
      await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
      
      // Results should be in mobile layout
      await expect(page.locator('[data-testid="mobile-results"]')).toBeVisible()
    })

    test('should handle mobile text input interactions', async ({ page }) => {
      await page.goto('/checker')
      
      const textInput = page.locator('[data-testid="text-input"]')
      
      // Test touch interactions
      await textInput.tap()
      await expect(textInput).toBeFocused()
      
      // Test typing with mobile viewport
      await textInput.fill('これはモバイルでのテキスト入力テストです。')
      
      // Character count should be visible
      await expect(page.locator('[data-testid="character-count"]')).toBeVisible()
      
      // Scroll should work with content
      await textInput.fill('a'.repeat(1000))
      await textInput.scrollIntoViewIfNeeded()
    })

    test('should display mobile-optimized results', async ({ page }) => {
      await page.goto('/checker')
      
      await page.locator('[data-testid="text-input"]').fill('モバイル結果表示テスト')
      await page.locator('[data-testid="check-button"]').click()
      
      // Wait for results
      await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
      
      // Tabs should be mobile-friendly
      await expect(page.locator('[data-testid="mobile-tabs"]')).toBeVisible()
      
      // Tab content should be properly sized
      await page.locator('[data-testid="side-by-side-tab"]').tap()
      await expect(page.locator('[data-testid="mobile-side-by-side"]')).toBeVisible()
      
      // Text should be readable on mobile
      const originalText = page.locator('[data-testid="original-text-content"]')
      await expect(originalText).toBeVisible()
    })

    test('should handle mobile scrolling in results', async ({ page }) => {
      await page.goto('/checker')
      
      // Submit long text
      const longText = 'これは長いテキストのテストです。'.repeat(50)
      await page.locator('[data-testid="text-input"]').fill(longText)
      await page.locator('[data-testid="check-button"]').click()
      
      // Wait for results
      await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
      
      // Test scrolling in results
      await page.locator('[data-testid="side-by-side-tab"]').tap()
      
      const originalTextArea = page.locator('[data-testid="original-text-content"]')
      await originalTextArea.scrollIntoViewIfNeeded()
      
      // Should be able to scroll within text area
      await originalTextArea.hover()
      await page.mouse.wheel(0, 100)
    })

    test('should display mobile-optimized history', async ({ page }) => {
      await page.goto('/history')
      
      // History items should be mobile-friendly
      await page.waitForSelector('[data-testid="history-item"]', { timeout: 10000 })
      
      const historyItems = page.locator('[data-testid="history-item"]')
      await expect(historyItems.first()).toBeVisible()
      
      // Search should be mobile-optimized
      await expect(page.locator('[data-testid="mobile-search"]')).toBeVisible()
      
      // Filters should be accessible
      await expect(page.locator('[data-testid="mobile-filters"]')).toBeVisible()
    })

    test('should handle mobile form interactions', async ({ page }) => {
      await page.goto('/auth/signin')
      
      // Form inputs should be mobile-friendly
      const emailInput = page.locator('[data-testid="email-input"]')
      const passwordInput = page.locator('[data-testid="password-input"]')
      
      await emailInput.tap()
      await expect(emailInput).toBeFocused()
      
      await emailInput.fill('test@example.com')
      await passwordInput.tap()
      await passwordInput.fill('password123')
      
      // Submit button should be properly sized
      await expect(page.locator('[data-testid="submit-button"]')).toBeVisible()
    })
  })

  test.describe('Tablet Layout', () => {
    test.beforeEach(async ({ page }) => {
      // Set tablet viewport (iPad)
      await page.setViewportSize({ width: 768, height: 1024 })
      await page.goto('/')
    })

    test('should display tablet navigation correctly', async ({ page }) => {
      // Tablet might show desktop nav or mobile nav depending on design
      const desktopNav = page.locator('[data-testid="desktop-nav"]')
      const mobileNav = page.locator('[data-testid="mobile-menu-toggle"]')
      
      // One of them should be visible
      await expect(desktopNav.or(mobileNav)).toBeVisible()
    })

    test('should display text checker in tablet layout', async ({ page }) => {
      await page.goto('/checker')
      
      // Should have more space than mobile
      await expect(page.locator('[data-testid="text-input"]')).toBeVisible()
      
      // Submit test
      await page.locator('[data-testid="text-input"]').fill('タブレットテスト')
      await page.locator('[data-testid="check-button"]').click()
      
      // Wait for results
      await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
      
      // Results should use tablet layout
      await expect(page.locator('[data-testid="results-section"]')).toBeVisible()
    })

    test('should handle tablet touch interactions', async ({ page }) => {
      await page.goto('/checker')
      
      // Test touch scrolling
      await page.locator('[data-testid="text-input"]').fill('a'.repeat(2000))
      
      // Should handle touch scrolling
      await page.touchscreen.tap(200, 300)
      await page.mouse.wheel(0, 500)
      
      // Check button should be accessible
      await expect(page.locator('[data-testid="check-button"]')).toBeVisible()
    })
  })

  test.describe('Responsive Breakpoints', () => {
    const viewports = [
      { name: 'Mobile S', width: 320, height: 568 },
      { name: 'Mobile M', width: 375, height: 667 },
      { name: 'Mobile L', width: 414, height: 736 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1024, height: 768 }
    ]

    viewports.forEach(({ name, width, height }) => {
      test(`should display correctly on ${name} (${width}x${height})`, async ({ page }) => {
        await page.setViewportSize({ width, height })
        await page.goto('/checker')
        
        // Basic elements should be visible
        await expect(page.locator('[data-testid="text-input"]')).toBeVisible()
        await expect(page.locator('[data-testid="check-button"]')).toBeVisible()
        
        // Submit test
        await page.locator('[data-testid="text-input"]').fill(`${name}テスト`)
        await page.locator('[data-testid="check-button"]').click()
        
        // Results should be accessible
        await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
      })
    })
  })

  test.describe('Touch Gestures', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto('/checker')
    })

    test('should handle swipe gestures in results', async ({ page }) => {
      // Submit test to get results
      await page.locator('[data-testid="text-input"]').fill('スワイプテスト')
      await page.locator('[data-testid="check-button"]').click()
      
      // Wait for results
      await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
      
      // Test swipe between tabs if implemented
      const tabsContainer = page.locator('[data-testid="tabs-container"]')
      if (await tabsContainer.isVisible()) {
        // Simulate swipe gesture
        await page.touchscreen.tap(200, 400)
        await page.mouse.down()
        await page.mouse.move(100, 400)
        await page.mouse.up()
      }
    })

    test('should handle pinch-to-zoom on text', async ({ page }) => {
      await page.locator('[data-testid="text-input"]').fill('ピンチズームテスト')
      await page.locator('[data-testid="check-button"]').click()
      
      // Wait for results
      await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
      
      // Test pinch gesture (simulated)
      const textArea = page.locator('[data-testid="original-text-content"]')
      await textArea.hover()
      
      // Simulate pinch gesture
      await page.touchscreen.tap(200, 400)
      await page.touchscreen.tap(300, 500)
    })

    test('should handle long press interactions', async ({ page }) => {
      await page.locator('[data-testid="text-input"]').fill('長押しテスト')
      await page.locator('[data-testid="check-button"]').click()
      
      // Wait for results
      await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
      
      // Test long press on violation text
      const violationText = page.locator('[data-testid="violation-highlight"]')
      if (await violationText.count() > 0) {
        // Simulate long press
        await violationText.first().hover()
        await page.mouse.down()
        await page.waitForTimeout(1000)
        await page.mouse.up()
        
        // Should show context menu or tooltip
        await expect(page.locator('[data-testid="violation-tooltip"]')).toBeVisible()
      }
    })
  })

  test.describe('Mobile Performance', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
    })

    test('should load quickly on mobile', async ({ page }) => {
      const startTime = Date.now()
      await page.goto('/checker')
      
      // Main elements should load quickly
      await expect(page.locator('[data-testid="text-input"]')).toBeVisible()
      const loadTime = Date.now() - startTime
      
      // Should load within reasonable time (adjust threshold as needed)
      expect(loadTime).toBeLessThan(5000)
    })

    test('should handle concurrent mobile interactions', async ({ page }) => {
      await page.goto('/checker')
      
      // Test multiple rapid interactions
      const textInput = page.locator('[data-testid="text-input"]')
      const checkButton = page.locator('[data-testid="check-button"]')
      
      await textInput.fill('並行処理テスト1')
      await checkButton.click()
      
      // Quickly start another check
      await textInput.fill('並行処理テスト2')
      await checkButton.click()
      
      // Should handle gracefully
      await expect(page.locator('[data-testid="history-item"]')).toHaveCount(2)
    })
  })

  test.describe('Accessibility on Mobile', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto('/checker')
    })

    test('should have proper touch targets', async ({ page }) => {
      // Check that interactive elements have adequate touch target size
      const checkButton = page.locator('[data-testid="check-button"]')
      const buttonBox = await checkButton.boundingBox()
      
      // Touch target should be at least 44x44px
      expect(buttonBox.width).toBeGreaterThan(44)
      expect(buttonBox.height).toBeGreaterThan(44)
    })

    test('should support screen reader navigation', async ({ page }) => {
      // Test that headings are properly structured
      await expect(page.locator('h1')).toBeVisible()
      
      // Test that form labels are associated
      const textInput = page.locator('[data-testid="text-input"]')
      await expect(textInput).toHaveAttribute('aria-label')
    })

    test('should handle focus management on mobile', async ({ page }) => {
      const textInput = page.locator('[data-testid="text-input"]')
      
      // Focus should be manageable
      await textInput.focus()
      await expect(textInput).toBeFocused()
      
      // Tab navigation should work
      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="check-button"]')).toBeFocused()
    })
  })

  test.describe('Mobile-Specific Features', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto('/checker')
    })

    test('should handle mobile keyboard appearance', async ({ page }) => {
      const textInput = page.locator('[data-testid="text-input"]')
      
      // Focus should bring up keyboard
      await textInput.tap()
      await expect(textInput).toBeFocused()
      
      // Input should still be visible with virtual keyboard
      await expect(textInput).toBeVisible()
      
      // Should handle keyboard dismissal
      await page.keyboard.press('Escape')
    })

    test('should handle orientation changes', async ({ page }) => {
      // Start in portrait
      await page.setViewportSize({ width: 390, height: 844 })
      await expect(page.locator('[data-testid="text-input"]')).toBeVisible()
      
      // Switch to landscape
      await page.setViewportSize({ width: 844, height: 390 })
      await expect(page.locator('[data-testid="text-input"]')).toBeVisible()
      
      // Layout should adapt
      await page.locator('[data-testid="text-input"]').fill('画面回転テスト')
      await page.locator('[data-testid="check-button"]').click()
      
      await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
    })

    test('should handle mobile-specific input types', async ({ page }) => {
      await page.goto('/auth/signin')
      
      // Email input should trigger appropriate keyboard
      const emailInput = page.locator('[data-testid="email-input"]')
      await expect(emailInput).toHaveAttribute('type', 'email')
      
      // Password input should be secure
      const passwordInput = page.locator('[data-testid="password-input"]')
      await expect(passwordInput).toHaveAttribute('type', 'password')
    })
  })
})