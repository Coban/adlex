import { test, expect } from '@playwright/test'

test.describe('Results Display Modes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/checker')
    
    // Submit a test text that will generate results
    const testText = 'このサプリメントで驚異的な効果を実感できます。即効性があり、絶対に効きます。'
    await page.locator('[data-testid="text-input"]').fill(testText)
    await page.locator('[data-testid="check-button"]').click()
    
    // Wait for results to appear
    await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
  })

  test('should display side-by-side view correctly', async ({ page }) => {
    // Click on side-by-side tab
    await page.locator('[data-testid="side-by-side-tab"]').click()
    
    // Verify side-by-side view is active
    await expect(page.locator('[data-testid="side-by-side-view"]')).toBeVisible()
    
    // Verify both original and modified text are displayed
    await expect(page.locator('[data-testid="original-text-panel"]')).toBeVisible()
    await expect(page.locator('[data-testid="modified-text-panel"]')).toBeVisible()
    
    // Verify headers are correct
    await expect(page.locator('[data-testid="original-text-header"]')).toContainText('元のテキスト')
    await expect(page.locator('[data-testid="modified-text-header"]')).toContainText('修正されたテキスト')
    
    // Verify text content is displayed
    await expect(page.locator('[data-testid="original-text-content"]')).toContainText('驚異的な効果')
    await expect(page.locator('[data-testid="modified-text-content"]')).toBeVisible()
  })

  test('should highlight violations in original text', async ({ page }) => {
    await page.locator('[data-testid="side-by-side-tab"]').click()
    
    // Check for violation highlights
    const highlightedText = page.locator('[data-testid="violation-highlight"]')
    await expect(highlightedText.first()).toBeVisible()
    
    // Verify highlighted text has proper styling
    await expect(highlightedText.first()).toHaveClass(/bg-red-200/)
    
    // Verify tooltip shows violation reason
    await highlightedText.first().hover()
    await expect(page.locator('[data-testid="violation-tooltip"]')).toBeVisible()
    await expect(page.locator('[data-testid="violation-tooltip"]')).toContainText('薬機法違反')
  })

  test('should display diff view correctly', async ({ page }) => {
    // Click on diff tab
    await page.locator('[data-testid="diff-tab"]').click()
    
    // Verify diff view is active
    await expect(page.locator('[data-testid="diff-view"]')).toBeVisible()
    
    // Verify diff lines are displayed
    const diffLines = page.locator('[data-testid="diff-line"]')
    await expect(diffLines.first()).toBeVisible()
    
    // Check for deleted lines (red background)
    const deletedLines = page.locator('[data-testid="diff-line"].bg-red-50')
    if (await deletedLines.count() > 0) {
      await expect(deletedLines.first()).toBeVisible()
    }
    
    // Check for added lines (green background)
    const addedLines = page.locator('[data-testid="diff-line"].bg-green-50')
    if (await addedLines.count() > 0) {
      await expect(addedLines.first()).toBeVisible()
    }
  })

  test('should display violations view correctly', async ({ page }) => {
    // Click on violations tab
    await page.locator('[data-testid="violations-tab"]').click()
    
    // Verify violations view is active
    await expect(page.locator('[data-testid="violations-view"]')).toBeVisible()
    
    // Verify violation items are displayed
    const violationItems = page.locator('[data-testid="violation-item"]')
    await expect(violationItems.first()).toBeVisible()
    
    // Check violation details
    const firstViolation = violationItems.first()
    await expect(firstViolation.locator('[data-testid="violation-number"]')).toContainText('違反箇所 1')
    await expect(firstViolation.locator('[data-testid="violation-position"]')).toContainText('位置:')
    await expect(firstViolation.locator('[data-testid="violation-text"]')).toContainText('該当テキスト:')
    await expect(firstViolation.locator('[data-testid="violation-reason"]')).toContainText('理由:')
  })

  test('should switch between display modes smoothly', async ({ page }) => {
    // Start with side-by-side
    await page.locator('[data-testid="side-by-side-tab"]').click()
    await expect(page.locator('[data-testid="side-by-side-view"]')).toBeVisible()
    
    // Switch to diff view
    await page.locator('[data-testid="diff-tab"]').click()
    await expect(page.locator('[data-testid="diff-view"]')).toBeVisible()
    await expect(page.locator('[data-testid="side-by-side-view"]')).not.toBeVisible()
    
    // Switch to violations view
    await page.locator('[data-testid="violations-tab"]').click()
    await expect(page.locator('[data-testid="violations-view"]')).toBeVisible()
    await expect(page.locator('[data-testid="diff-view"]')).not.toBeVisible()
    
    // Switch back to side-by-side
    await page.locator('[data-testid="side-by-side-tab"]').click()
    await expect(page.locator('[data-testid="side-by-side-view"]')).toBeVisible()
    await expect(page.locator('[data-testid="violations-view"]')).not.toBeVisible()
  })

  test('should handle results with no violations', async ({ page }) => {
    // Submit clean text with no violations
    await page.locator('[data-testid="text-input"]').fill('これは安全なテキストです。')
    await page.locator('[data-testid="check-button"]').click()
    
    // Wait for results
    await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
    
    // Check violations view shows no violations message
    await page.locator('[data-testid="violations-tab"]').click()
    await expect(page.locator('[data-testid="no-violations-message"]')).toContainText('違反は検出されませんでした')
    
    // Side-by-side view should still work
    await page.locator('[data-testid="side-by-side-tab"]').click()
    await expect(page.locator('[data-testid="original-text-content"]')).toContainText('安全なテキスト')
    await expect(page.locator('[data-testid="modified-text-content"]')).toContainText('安全なテキスト')
  })

  test('should display copy button and functionality', async ({ page }) => {
    await page.locator('[data-testid="side-by-side-tab"]').click()
    
    // Verify copy button is visible
    await expect(page.locator('[data-testid="copy-button"]')).toBeVisible()
    
    // Click copy button
    await page.locator('[data-testid="copy-button"]').click()
    
    // Verify copy success feedback (toast or button state change)
    const copyFeedback = page.locator('[data-testid="copy-success"]')
    if (await copyFeedback.isVisible()) {
      await expect(copyFeedback).toContainText('コピーしました')
    }
  })

  test('should display download button and functionality', async ({ page }) => {
    await page.locator('[data-testid="side-by-side-tab"]').click()
    
    // Verify download button is visible
    await expect(page.locator('[data-testid="download-button"]')).toBeVisible()
    
    // Set up download promise
    const downloadPromise = page.waitForEvent('download')
    
    // Click download button
    await page.locator('[data-testid="download-button"]').click()
    
    // Wait for download to complete
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/.*\.pdf/)
  })

  test('should handle long text content properly', async ({ page }) => {
    // Submit very long text
    const longText = 'この製品は素晴らしい効果があります。'.repeat(50)
    await page.locator('[data-testid="text-input"]').fill(longText)
    await page.locator('[data-testid="check-button"]').click()
    
    // Wait for results
    await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
    
    // Check side-by-side view handles long text
    await page.locator('[data-testid="side-by-side-tab"]').click()
    await expect(page.locator('[data-testid="original-text-content"]')).toBeVisible()
    await expect(page.locator('[data-testid="modified-text-content"]')).toBeVisible()
    
    // Check scrolling works
    await page.locator('[data-testid="original-text-content"]').scrollIntoViewIfNeeded()
    await expect(page.locator('[data-testid="original-text-content"]')).toBeVisible()
  })

  test('should preserve line breaks in text display', async ({ page }) => {
    // Submit text with line breaks
    const textWithBreaks = 'この製品は\n驚異的な効果があります。\n\n即効性があり、\n絶対に効きます。'
    await page.locator('[data-testid="text-input"]').fill(textWithBreaks)
    await page.locator('[data-testid="check-button"]').click()
    
    // Wait for results
    await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
    
    // Check that line breaks are preserved
    await page.locator('[data-testid="side-by-side-tab"]').click()
    const originalContent = page.locator('[data-testid="original-text-content"]')
    await expect(originalContent).toContainText('この製品は')
    await expect(originalContent).toContainText('驚異的な効果')
    await expect(originalContent).toContainText('即効性があり')
  })

  test('should handle violation positioning correctly', async ({ page }) => {
    await page.locator('[data-testid="violations-tab"]').click()
    
    // Check violation positioning information
    const violationItems = page.locator('[data-testid="violation-item"]')
    const firstViolation = violationItems.first()
    
    // Verify position information is displayed
    const positionText = await firstViolation.locator('[data-testid="violation-position"]').textContent()
    expect(positionText).toMatch(/位置: \d+ - \d+/)
    
    // Verify the actual text snippet is shown
    await expect(firstViolation.locator('[data-testid="violation-text"]')).toBeVisible()
    
    // Verify the violation reason is shown
    await expect(firstViolation.locator('[data-testid="violation-reason"]')).toBeVisible()
  })

  test('should handle tab keyboard navigation', async ({ page }) => {
    // Focus on tab list
    await page.locator('[data-testid="tab-list"]').focus()
    
    // Use keyboard to navigate tabs
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('[data-testid="diff-tab"]')).toBeFocused()
    
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('[data-testid="violations-tab"]')).toBeFocused()
    
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-testid="violations-view"]')).toBeVisible()
  })

  test('should maintain tab state when switching between checks', async ({ page }) => {
    // Switch to violations tab
    await page.locator('[data-testid="violations-tab"]').click()
    await expect(page.locator('[data-testid="violations-view"]')).toBeVisible()
    
    // Start a new check
    await page.locator('[data-testid="text-input"]').fill('新しいテスト文章です。')
    await page.locator('[data-testid="check-button"]').click()
    
    // Wait for new results
    await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
    
    // Should still be on violations tab
    await expect(page.locator('[data-testid="violations-view"]')).toBeVisible()
  })
})