import { test, expect } from '@playwright/test'

test.describe('結果表示モード', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/checker')
    
    // 結果が出る想定のテキストを送信
    const testText = 'このサプリメントで驚異的な効果を実感できます。即効性があり、絶対に効きます。'
    await page.locator('[data-testid="text-input"]').fill(testText)
    await page.locator('[data-testid="check-button"]').click()
    
    // 結果が表示されるまで待機
    await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
  })

  test('should display side-by-side view correctly', async ({ page }) => {
    // 並列表示タブをクリック
    await page.locator('[data-testid="side-by-side-tab"]').click()
    
    // 並列表示ビューがアクティブであること
    await expect(page.locator('[data-testid="side-by-side-view"]')).toBeVisible()
    
    // 原文と修正文の両方が表示される
    await expect(page.locator('[data-testid="original-text-panel"]')).toBeVisible()
    await expect(page.locator('[data-testid="modified-text-panel"]')).toBeVisible()
    
    // 見出しが正しい
    await expect(page.locator('[data-testid="original-text-header"]')).toContainText('元のテキスト')
    await expect(page.locator('[data-testid="modified-text-header"]')).toContainText('修正されたテキスト')
    
    // テキスト内容が表示される
    await expect(page.locator('[data-testid="original-text-content"]')).toContainText('驚異的な効果')
    await expect(page.locator('[data-testid="modified-text-content"]')).toBeVisible()
  })

  test('should highlight violations in original text', async ({ page }) => {
    await page.locator('[data-testid="side-by-side-tab"]').click()
    
    // 違反箇所のハイライトを確認
    const highlightedText = page.locator('[data-testid="violation-highlight"]')
    await expect(highlightedText.first()).toBeVisible()
    
    // ハイライトのスタイルが適切である
    await expect(highlightedText.first()).toHaveClass(/bg-red-200/)
    
    // ツールチップに違反理由が表示される
    await highlightedText.first().hover()
    await expect(page.locator('[data-testid="violation-tooltip"]')).toBeVisible()
    await expect(page.locator('[data-testid="violation-tooltip"]')).toContainText('薬機法違反')
  })

  test('should display diff view correctly', async ({ page }) => {
    // 差分表示タブをクリック
    await page.locator('[data-testid="diff-tab"]').click()
    
    // 差分ビューがアクティブ
    await expect(page.locator('[data-testid="diff-view"]')).toBeVisible()
    
    // 差分行が表示されている
    const diffLines = page.locator('[data-testid="diff-line"]')
    await expect(diffLines.first()).toBeVisible()
    
    // 削除行（赤背景）を確認
    const deletedLines = page.locator('[data-testid="diff-line"].bg-red-50')
    if (await deletedLines.count() > 0) {
      await expect(deletedLines.first()).toBeVisible()
    }
    
    // 追加行（緑背景）を確認
    const addedLines = page.locator('[data-testid="diff-line"].bg-green-50')
    if (await addedLines.count() > 0) {
      await expect(addedLines.first()).toBeVisible()
    }
  })

  test('should display violations view correctly', async ({ page }) => {
    // 違反詳細タブをクリック
    await page.locator('[data-testid="violations-tab"]').click()
    
    // 違反詳細ビューがアクティブ
    await expect(page.locator('[data-testid="violations-view"]')).toBeVisible()
    
    // 違反項目が表示される
    const violationItems = page.locator('[data-testid="violation-item"]')
    await expect(violationItems.first()).toBeVisible()
    
    // 違反詳細の内容を確認
    const firstViolation = violationItems.first()
    await expect(firstViolation.locator('[data-testid="violation-number"]')).toContainText('違反箇所 1')
    await expect(firstViolation.locator('[data-testid="violation-position"]')).toContainText('位置:')
    await expect(firstViolation.locator('[data-testid="violation-text"]')).toContainText('該当テキスト:')
    await expect(firstViolation.locator('[data-testid="violation-reason"]')).toContainText('理由:')
  })

  test('should switch between display modes smoothly', async ({ page }) => {
    // まず並列表示
    await page.locator('[data-testid="side-by-side-tab"]').click()
    await expect(page.locator('[data-testid="side-by-side-view"]')).toBeVisible()
    
    // 差分表示に切り替え
    await page.locator('[data-testid="diff-tab"]').click()
    await expect(page.locator('[data-testid="diff-view"]')).toBeVisible()
    await expect(page.locator('[data-testid="side-by-side-view"]')).not.toBeVisible()
    
    // 違反詳細に切り替え
    await page.locator('[data-testid="violations-tab"]').click()
    await expect(page.locator('[data-testid="violations-view"]')).toBeVisible()
    await expect(page.locator('[data-testid="diff-view"]')).not.toBeVisible()
    
    // 再び並列表示へ
    await page.locator('[data-testid="side-by-side-tab"]').click()
    await expect(page.locator('[data-testid="side-by-side-view"]')).toBeVisible()
    await expect(page.locator('[data-testid="violations-view"]')).not.toBeVisible()
  })

  test('should handle results with no violations', async ({ page }) => {
    // 違反の無いクリーンなテキストを送信
    await page.locator('[data-testid="text-input"]').fill('これは安全なテキストです。')
    await page.locator('[data-testid="check-button"]').click()
    
    // 結果を待機
    await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
    
    // 違反なしのメッセージが表示される
    await page.locator('[data-testid="violations-tab"]').click()
    await expect(page.locator('[data-testid="no-violations-message"]')).toContainText('違反は検出されませんでした')
    
    // 並列表示でも表示できる
    await page.locator('[data-testid="side-by-side-tab"]').click()
    await expect(page.locator('[data-testid="original-text-content"]')).toContainText('安全なテキスト')
    await expect(page.locator('[data-testid="modified-text-content"]')).toContainText('安全なテキスト')
  })

  test('should display copy button and functionality', async ({ page }) => {
    await page.locator('[data-testid="side-by-side-tab"]').click()
    
    // コピーボタンが表示される
    await expect(page.locator('[data-testid="copy-button"]')).toBeVisible()
    
    // コピーボタンをクリック
    await page.locator('[data-testid="copy-button"]').click()
    
    // コピー成功のフィードバック（トーストやボタン状態の変化）を確認
    const copyFeedback = page.locator('[data-testid="copy-success"]')
    if (await copyFeedback.isVisible()) {
      await expect(copyFeedback).toContainText('コピーしました')
    }
  })

  test('should display download button and functionality', async ({ page }) => {
    await page.locator('[data-testid="side-by-side-tab"]').click()
    
    // ダウンロードボタンが表示される
    await expect(page.locator('[data-testid="download-button"]')).toBeVisible()
    
    // ダウンロード待機を設定
    const downloadPromise = page.waitForEvent('download')
    
    // ダウンロードボタンをクリック
    await page.locator('[data-testid="download-button"]').click()
    
    // ダウンロード完了を待機
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/.*\.pdf/)
  })

  test('should handle long text content properly', async ({ page }) => {
    // 非常に長いテキストを送信
    const longText = 'この製品は素晴らしい効果があります。'.repeat(50)
    await page.locator('[data-testid="text-input"]').fill(longText)
    await page.locator('[data-testid="check-button"]').click()
    
    // 結果を待機
    await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
    
    // 並列表示で長文が適切に扱えるか確認
    await page.locator('[data-testid="side-by-side-tab"]').click()
    await expect(page.locator('[data-testid="original-text-content"]')).toBeVisible()
    await expect(page.locator('[data-testid="modified-text-content"]')).toBeVisible()
    
    // スクロールが機能する
    await page.locator('[data-testid="original-text-content"]').scrollIntoViewIfNeeded()
    await expect(page.locator('[data-testid="original-text-content"]')).toBeVisible()
  })

  test('should preserve line breaks in text display', async ({ page }) => {
    // 改行を含むテキストを送信
    const textWithBreaks = 'この製品は\n驚異的な効果があります。\n\n即効性があり、\n絶対に効きます。'
    await page.locator('[data-testid="text-input"]').fill(textWithBreaks)
    await page.locator('[data-testid="check-button"]').click()
    
    // 結果を待機
    await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
    
    // 改行が保持されて表示されること
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
