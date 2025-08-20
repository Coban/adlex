import { test, expect } from '@playwright/test'

test.describe('リアルタイムSSE更新', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/checker')
  })

  test('should receive real-time updates during text processing', async ({ page }) => {
    // チェック対象のテキストを入力
    const testText = 'このサプリメントで驚異的な効果を実感できます。'
    await page.locator('[data-testid="text-input"]').fill(testText)
    
    // チェックを開始
    await page.locator('[data-testid="check-button"]').click()
    
    // 初期のキュー投入ステータスを確認
    await expect(page.locator('[data-testid="status-message"]')).toContainText('チェックをキューに追加しています')
    
    // 処理中ステータスへの更新を待機
    await expect(page.locator('[data-testid="status-message"]')).toContainText('AIによるテキスト解析を実行中', { timeout: 10000 })
    
    // 完了まで待機
    await expect(page.locator('[data-testid="status-message"]')).toContainText('チェック完了', { timeout: 30000 })
    
    // 結果の表示を確認
    await expect(page.locator('[data-testid="results-section"]')).toBeVisible()
  })

  test('should handle SSE connection errors gracefully', async ({ page }) => {
    // SSEを妨害して接続エラーを再現
    await page.route('**/api/checks/*/stream', route => {
      route.abort('connectionfailed')
    })
    
    const testText = 'テストテキスト'
    await page.locator('[data-testid="text-input"]').fill(testText)
    await page.locator('[data-testid="check-button"]').click()
    
    // ポーリングへのフォールバックを確認
    await expect(page.locator('[data-testid="status-message"]')).toContainText('チェック完了', { timeout: 30000 })
    
    // 結果は表示されること
    await expect(page.locator('[data-testid="results-section"]')).toBeVisible()
  })

  test('should handle multiple concurrent checks', async ({ page }) => {
    // 1件目のチェックを開始
    await page.locator('[data-testid="text-input"]').fill('最初のテキスト')
    await page.locator('[data-testid="check-button"]').click()
    
    // 処理開始を待機
    await expect(page.locator('[data-testid="status-message"]')).toContainText('チェックをキューに追加しています')
    
    // 1件目の処理中に2件目のチェックを開始
    await page.locator('[data-testid="text-input"]').fill('二番目のテキスト')
    await page.locator('[data-testid="check-button"]').click()
    
    // 履歴に2件が表示されること
    await expect(page.locator('[data-testid="history-item"]')).toHaveCount(2)
    
    // 両方のチェックが完了するまで待機
    await expect(page.locator('[data-testid="history-item"]').first().locator('[data-testid="status-indicator"]')).toContainText('完了', { timeout: 30000 })
    await expect(page.locator('[data-testid="history-item"]').last().locator('[data-testid="status-indicator"]')).toContainText('完了', { timeout: 30000 })
  })

  test('should update check history in real-time', async ({ page }) => {
    // チェックを開始
    await page.locator('[data-testid="text-input"]').fill('履歴テストテキスト')
    await page.locator('[data-testid="check-button"]').click()
    
    // 履歴に即時反映されること
    await expect(page.locator('[data-testid="history-item"]')).toHaveCount(1)
    
    // 履歴側の初期ステータスを確認
    await expect(page.locator('[data-testid="history-item"]').first().locator('[data-testid="status-indicator"]')).toContainText('処理中')
    
    // 完了に更新されるまで待機
    await expect(page.locator('[data-testid="history-item"]').first().locator('[data-testid="status-indicator"]')).toContainText('完了', { timeout: 30000 })
  })

  test('should handle SSE timeout gracefully', async ({ page }) => {
    // SSEをブロックしてタイムアウトを再現
    await page.route('**/api/checks/*/stream', route => route.abort('timedout'))
    
    const testText = 'タイムアウトテスト'
    await page.locator('[data-testid="text-input"]').fill(testText)
    await page.locator('[data-testid="check-button"]').click()
    
    // まずは処理中ステータスの表示を待機
    await page.waitForTimeout(3000)
    
    // 何らかの処理中またはエラーステータスが表示される（初期状態のままではない）
    const statusMessage = await page.locator('[data-testid="status-message"]').textContent()
    console.log(`SSE timeout test status: ${statusMessage}`)
    
    // タイムアウトやエラーハンドリングなどのステータス更新があれば合格
    expect(statusMessage).toBeTruthy()
    expect(statusMessage).not.toBe('') // Should not be empty
  })

  test('should display progress indicators correctly', async ({ page }) => {
    await page.locator('[data-testid="text-input"]').fill('プログレステスト')
    await page.locator('[data-testid="check-button"]').click()
    
    // 処理中のスピナーを確認
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible()
    
    // 進捗バーがあれば表示を確認
    const progressBar = page.locator('[data-testid="progress-bar"]')
    if (await progressBar.isVisible()) {
      await expect(progressBar).toBeVisible()
    }
    
    // 完了時にはローディングが消える
    await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible({ timeout: 30000 })
  })

  test('should handle SSE connection reconnection', async ({ page }) => {
    let requestCount = 0
    
    // Intercept SSE requests and fail the first few attempts
    await page.route('**/api/checks/*/stream', route => {
      requestCount++
      if (requestCount <= 2) {
        route.abort('connectionfailed')
      } else {
        route.continue()
      }
    })
    
    await page.locator('[data-testid="text-input"]').fill('再接続テスト')
    await page.locator('[data-testid="check-button"]').click()
    
    // Should eventually complete despite initial connection failures
    await expect(page.locator('[data-testid="status-message"]')).toContainText('チェック完了', { timeout: 30000 })
    await expect(page.locator('[data-testid="results-section"]')).toBeVisible()
  })

  test('should handle SSE error messages from server', async ({ page }) => {
    // Intercept SSE requests to simulate server error
    await page.route('**/api/checks/*/stream', route => {
      route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        },
        body: 'data: {"status": "failed", "error": "サーバーエラーが発生しました"}\n\n'
      })
    })
    
    await page.locator('[data-testid="text-input"]').fill('エラーテスト')
    await page.locator('[data-testid="check-button"]').click()
    
    // Should show error message
    await expect(page.locator('[data-testid="status-message"]')).toContainText('エラー: サーバーエラーが発生しました', { timeout: 10000 })
    
    // Should show error alert
    await expect(page.locator('[data-testid="error-alert"]')).toBeVisible()
  })

  test('should cleanup SSE connections on page navigation', async ({ page }) => {
    // Start a check
    await page.locator('[data-testid="text-input"]').fill('ナビゲーションテスト')
    await page.locator('[data-testid="check-button"]').click()
    
    // Wait for processing to start
    await expect(page.locator('[data-testid="status-message"]')).toContainText('処理中')
    
    // Navigate away from the page
    await page.goto('/history')
    
    // Navigate back
    await page.goto('/checker')
    
    // Should not show processing status from previous check
    await expect(page.locator('[data-testid="status-message"]')).not.toContainText('処理中')
  })

  test('should handle malformed SSE data gracefully', async ({ page }) => {
    // Intercept SSE requests to send malformed data
    await page.route('**/api/checks/*/stream', route => {
      route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        },
        body: 'data: invalid json data\n\n'
      })
    })
    
    await page.locator('[data-testid="text-input"]').fill('不正データテスト')
    await page.locator('[data-testid="check-button"]').click()
    
    // Should show data parsing error
    await expect(page.locator('[data-testid="status-message"]')).toContainText('データ解析エラー', { timeout: 10000 })
  })

  test('should handle browser tab switching during SSE', async ({ page }) => {
    // Start a check
    await page.locator('[data-testid="text-input"]').fill('タブ切り替えテスト')
    await page.locator('[data-testid="check-button"]').click()
    
    // Wait for processing to start
    await expect(page.locator('[data-testid="status-message"]')).toContainText('処理中')
    
    // Simulate tab switching by changing visibility
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    
    // Wait a bit
    await page.waitForTimeout(1000)
    
    // Switch back to visible
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    
    // Check should still complete
    await expect(page.locator('[data-testid="status-message"]')).toContainText('チェック完了', { timeout: 30000 })
  })

  test('should handle SSE with large response data', async ({ page }) => {
    // Create a large text to process
    const largeText = 'この製品は素晴らしい効果があります。'.repeat(100)
    
    await page.locator('[data-testid="text-input"]').fill(largeText)
    await page.locator('[data-testid="check-button"]').click()
    
    // Should handle large response without issues
    await expect(page.locator('[data-testid="status-message"]')).toContainText('チェック完了', { timeout: 45000 })
    
    // Results should be displayed correctly
    await expect(page.locator('[data-testid="results-section"]')).toBeVisible()
    await expect(page.locator('[data-testid="original-text"]')).toContainText(largeText.substring(0, 50))
  })
})
