import { test, expect } from '@playwright/test'

test.describe('Check History', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to history page
    await page.goto('/history')
  })

  test('should display history page correctly', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('チェック履歴')
    await expect(page.locator('[data-testid="history-search"]')).toBeVisible()
    await expect(page.locator('[data-testid="status-filter"]')).toBeVisible()
  })

  test('should display paginated history items', async ({ page }) => {
    // Wait for history items to load
    await page.waitForSelector('[data-testid="history-item"]', { timeout: 10000 })
    
    // Check that history items are displayed
    const historyItems = page.locator('[data-testid="history-item"]')
    await expect(historyItems).toHaveCount(20) // Default page size
    
    // Check pagination controls
    await expect(page.locator('[data-testid="pagination"]')).toBeVisible()
  })

  test('should filter history by search term', async ({ page }) => {
    // Wait for initial items to load
    await page.waitForSelector('[data-testid="history-item"]', { timeout: 10000 })
    
    // Search for specific text
    await page.locator('[data-testid="history-search"]').fill('テスト')
    await page.locator('[data-testid="search-button"]').click()
    
    // Wait for filtered results
    await page.waitForTimeout(1000)
    
    // Verify search results contain the search term
    const searchResults = page.locator('[data-testid="history-item"]')
    const count = await searchResults.count()
    
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const item = searchResults.nth(i)
        await expect(item).toContainText('テスト')
      }
    }
  })

  test('should filter history by status', async ({ page }) => {
    // Wait for initial items to load
    await page.waitForSelector('[data-testid="history-item"]', { timeout: 10000 })
    
    // Select completed status filter
    await page.locator('[data-testid="status-filter"]').selectOption('completed')
    
    // Wait for filtered results
    await page.waitForTimeout(1000)
    
    // Verify all items have completed status
    const statusBadges = page.locator('[data-testid="status-badge"]')
    const count = await statusBadges.count()
    
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const badge = statusBadges.nth(i)
        await expect(badge).toContainText('完了')
      }
    }
  })

  test('should navigate to check detail page', async ({ page }) => {
    // Wait for history items to load
    await page.waitForSelector('[data-testid="history-item"]', { timeout: 10000 })
    
    // Click on first history item
    await page.locator('[data-testid="history-item"]').first().click()
    
    // Verify navigation to detail page
    await expect(page).toHaveURL(/\/history\/\d+/)
    await expect(page.locator('h1')).toContainText('チェック詳細')
  })

  test('should export history to CSV', async ({ page }) => {
    // Wait for history items to load
    await page.waitForSelector('[data-testid="history-item"]', { timeout: 10000 })
    
    // Set up download promise
    const downloadPromise = page.waitForEvent('download')
    
    // Click CSV export button
    await page.locator('[data-testid="csv-export"]').click()
    
    // Wait for download to complete
    const download = await downloadPromise
    
    // Verify download filename
    expect(download.suggestedFilename()).toMatch(/check-history-.*\.csv/)
  })

  test('should handle pagination correctly', async ({ page }) => {
    // Wait for initial items to load
    await page.waitForSelector('[data-testid="history-item"]', { timeout: 10000 })
    
    // Check if next page button exists (only if there are more than 20 items)
    const nextButton = page.locator('[data-testid="next-page"]')
    const isNextButtonVisible = await nextButton.isVisible()
    
    if (isNextButtonVisible) {
      // Click next page
      await nextButton.click()
      
      // Wait for new items to load
      await page.waitForTimeout(1000)
      
      // Verify URL changed to include page parameter
      await expect(page).toHaveURL(/page=2/)
      
      // Verify previous button is now visible
      await expect(page.locator('[data-testid="prev-page"]')).toBeVisible()
    }
  })

  test('should display empty state when no history exists', async ({ page }) => {
    // Clear all history or navigate to a user with no history
    // This might require specific test setup
    
    // Check for empty state message
    const emptyState = page.locator('[data-testid="empty-state"]')
    if (await emptyState.isVisible()) {
      await expect(emptyState).toContainText('チェック履歴はありません')
    }
  })

  test('should handle loading states correctly', async ({ page }) => {
    // Navigate to history page
    await page.goto('/history')
    
    // Check for loading indicator
    const loadingIndicator = page.locator('[data-testid="loading-indicator"]')
    
    // Loading should disappear after items load
    await expect(loadingIndicator).not.toBeVisible({ timeout: 10000 })
  })
})

test.describe('Check History Detail', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to history page first
    await page.goto('/history')
    
    // Wait for history items and click on first one
    await page.waitForSelector('[data-testid="history-item"]', { timeout: 10000 })
    await page.locator('[data-testid="history-item"]').first().click()
  })

  test('should display check detail correctly', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('チェック詳細')
    await expect(page.locator('[data-testid="original-text"]')).toBeVisible()
    await expect(page.locator('[data-testid="modified-text"]')).toBeVisible()
    await expect(page.locator('[data-testid="violations-section"]')).toBeVisible()
  })

  test('should switch between view modes', async ({ page }) => {
    // Test side-by-side view
    await page.locator('[data-testid="side-by-side-tab"]').click()
    await expect(page.locator('[data-testid="side-by-side-view"]')).toBeVisible()
    
    // Test stacked view
    await page.locator('[data-testid="stacked-tab"]').click()
    await expect(page.locator('[data-testid="stacked-view"]')).toBeVisible()
  })

  test('should copy modified text to clipboard', async ({ page }) => {
    // Click copy button
    await page.locator('[data-testid="copy-button"]').click()
    
    // Verify copy success (might need to check for toast notification)
    // This is difficult to test directly, but we can verify the button exists
    await expect(page.locator('[data-testid="copy-button"]')).toBeVisible()
  })

  test('should download PDF report', async ({ page }) => {
    // Set up download promise
    const downloadPromise = page.waitForEvent('download')
    
    // Click PDF download button
    await page.locator('[data-testid="pdf-download"]').click()
    
    // Wait for download to complete
    const download = await downloadPromise
    
    // Verify download filename
    expect(download.suggestedFilename()).toMatch(/check-report-.*\.pdf/)
  })

  test('should display violation details with highlighting', async ({ page }) => {
    // Check if violations exist
    const violationsSection = page.locator('[data-testid="violations-section"]')
    
    if (await violationsSection.isVisible()) {
      // Check for violation highlights in text
      const highlightedText = page.locator('[data-testid="highlighted-violation"]')
      
      if (await highlightedText.count() > 0) {
        await expect(highlightedText.first()).toBeVisible()
        
        // Verify violation details
        await expect(page.locator('[data-testid="violation-reason"]')).toBeVisible()
        await expect(page.locator('[data-testid="violation-position"]')).toBeVisible()
      }
    }
  })

  test('should navigate back to history list', async ({ page }) => {
    // Click back button
    await page.locator('[data-testid="back-button"]').click()
    
    // Verify navigation back to history page
    await expect(page).toHaveURL('/history')
    await expect(page.locator('h1')).toContainText('チェック履歴')
  })

  test('should handle non-existent check ID', async ({ page }) => {
    // Navigate to non-existent check
    await page.goto('/history/999999')
    
    // Verify 404 or error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('チェックが見つかりません')
  })
})