import { test, expect } from '@playwright/test'

test.describe('Error Handling', () => {
  test.describe('Network Errors', () => {
    test('should handle API endpoint unavailable', async ({ page }) => {
      // Block all API requests
      await page.route('**/api/**', route => route.abort('connectionfailed'))
      
      await page.goto('/checker')
      
      // Try to submit a check
      await page.locator('[data-testid="text-input"]').fill('テストテキスト')
      await page.locator('[data-testid="check-button"]').click()
      
      // Should show network error message
      await expect(page.locator('[data-testid="error-message"]')).toContainText('サーバーとの接続でエラーが発生しました')
      
      // Should show retry option
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
    })

    test('should handle slow network connections', async ({ page }) => {
      // Delay all API requests significantly
      await page.route('**/api/**', route => {
        setTimeout(() => route.continue(), 10000)
      })
      
      await page.goto('/checker')
      
      await page.locator('[data-testid="text-input"]').fill('低速ネットワークテスト')
      await page.locator('[data-testid="check-button"]').click()
      
      // Should show loading state
      await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible()
      
      // Should eventually timeout with appropriate message
      await expect(page.locator('[data-testid="error-message"]')).toContainText('処理がタイムアウトしました', { timeout: 35000 })
    })

    test('should handle server errors (500)', async ({ page }) => {
      // Return 500 error for API requests
      await page.route('**/api/checks', route => {
        route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal Server Error' }) })
      })
      
      await page.goto('/checker')
      
      await page.locator('[data-testid="text-input"]').fill('サーバーエラーテスト')
      await page.locator('[data-testid="check-button"]').click()
      
      // Should show server error message
      await expect(page.locator('[data-testid="error-message"]')).toContainText('サーバーエラーが発生しました')
    })

    test('should handle authentication errors (401)', async ({ page }) => {
      // Return 401 error for API requests
      await page.route('**/api/checks', route => {
        route.fulfill({ status: 401, body: JSON.stringify({ error: 'Unauthorized' }) })
      })
      
      await page.goto('/checker')
      
      await page.locator('[data-testid="text-input"]').fill('認証エラーテスト')
      await page.locator('[data-testid="check-button"]').click()
      
      // Should show authentication error and redirect to login
      await expect(page.locator('[data-testid="error-message"]')).toContainText('認証が必要です')
      await expect(page).toHaveURL('/auth/signin')
    })

    test('should handle usage limit exceeded (403)', async ({ page }) => {
      // Return 403 error for API requests
      await page.route('**/api/checks', route => {
        route.fulfill({ status: 403, body: JSON.stringify({ error: 'Usage limit exceeded' }) })
      })
      
      await page.goto('/checker')
      
      await page.locator('[data-testid="text-input"]').fill('使用制限テスト')
      await page.locator('[data-testid="check-button"]').click()
      
      // Should show usage limit error
      await expect(page.locator('[data-testid="error-message"]')).toContainText('使用制限を超過しました')
      
      // Should show upgrade option or contact admin message
      await expect(page.locator('[data-testid="upgrade-prompt"]')).toBeVisible()
    })
  })

  test.describe('Input Validation Errors', () => {
    test('should handle empty text input', async ({ page }) => {
      await page.goto('/checker')
      
      // Try to submit empty text
      await page.locator('[data-testid="check-button"]').click()
      
      // Button should be disabled or show validation error
      await expect(page.locator('[data-testid="check-button"]')).toBeDisabled()
    })

    test('should handle text exceeding character limit', async ({ page }) => {
      await page.goto('/checker')
      
      // Fill with text exceeding limit
      const longText = 'a'.repeat(10001)
      await page.locator('[data-testid="text-input"]').fill(longText)
      
      // Should show character limit error
      await expect(page.locator('[data-testid="character-limit-error"]')).toContainText('10,000文字以内')
      
      // Submit button should be disabled
      await expect(page.locator('[data-testid="check-button"]')).toBeDisabled()
    })

    test('should handle invalid characters in text', async ({ page }) => {
      await page.goto('/checker')
      
      // Fill with problematic characters
      const invalidText = '\u0000\u0001\u0002これは無効な文字を含みます'
      await page.locator('[data-testid="text-input"]').fill(invalidText)
      await page.locator('[data-testid="check-button"]').click()
      
      // Should handle gracefully or show validation error
      await expect(page.locator('[data-testid="status-message"]')).toContainText('チェック完了', { timeout: 30000 })
    })
  })

  test.describe('Session and Authentication Errors', () => {
    test('should handle session expiration during check', async ({ page }) => {
      await page.goto('/checker')
      
      // Start a check
      await page.locator('[data-testid="text-input"]').fill('セッション期限切れテスト')
      await page.locator('[data-testid="check-button"]').click()
      
      // Simulate session expiration by clearing cookies
      await page.context().clearCookies()
      
      // Wait for session to be detected as expired
      await page.waitForTimeout(2000)
      
      // Should redirect to login or show session expired message
      await expect(page).toHaveURL('/auth/signin')
    })

    test('should handle invalid authentication tokens', async ({ page }) => {
      // Set invalid token
      await page.evaluate(() => {
        localStorage.setItem('supabase.auth.token', 'invalid-token')
      })
      
      await page.goto('/checker')
      
      // Should redirect to login
      await expect(page).toHaveURL('/auth/signin')
    })
  })

  test.describe('Data Loading Errors', () => {
    test('should handle history loading errors', async ({ page }) => {
      // Block history API requests
      await page.route('**/api/history/**', route => route.abort('connectionfailed'))
      
      await page.goto('/history')
      
      // Should show error loading history
      await expect(page.locator('[data-testid="history-error"]')).toContainText('履歴の読み込みに失敗しました')
      
      // Should show retry button
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
    })

    test('should handle check detail loading errors', async ({ page }) => {
      // Block check detail API requests
      await page.route('**/api/checks/123', route => route.abort('connectionfailed'))
      
      await page.goto('/history/123')
      
      // Should show error loading check details
      await expect(page.locator('[data-testid="detail-error"]')).toContainText('チェック詳細の読み込みに失敗しました')
    })

    test('should handle missing check data', async ({ page }) => {
      // Return 404 for non-existent check
      await page.route('**/api/checks/999999', route => {
        route.fulfill({ status: 404, body: JSON.stringify({ error: 'Check not found' }) })
      })
      
      await page.goto('/history/999999')
      
      // Should show not found message
      await expect(page.locator('[data-testid="not-found-error"]')).toContainText('チェックが見つかりません')
    })
  })

  test.describe('Admin Error Handling', () => {
    test('should handle admin API errors', async ({ page }) => {
      // Block admin API requests
      await page.route('**/api/admin/**', route => route.abort('connectionfailed'))
      
      await page.goto('/admin/users')
      
      // Should show admin error message
      await expect(page.locator('[data-testid="admin-error"]')).toContainText('管理者データの読み込みに失敗しました')
    })

    test('should handle insufficient permissions', async ({ page }) => {
      // Return 403 for admin requests
      await page.route('**/api/admin/users', route => {
        route.fulfill({ status: 403, body: JSON.stringify({ error: 'Insufficient permissions' }) })
      })
      
      await page.goto('/admin/users')
      
      // Should show permission error
      await expect(page.locator('[data-testid="permission-error"]')).toContainText('権限がありません')
    })
  })

  test.describe('Browser Compatibility Errors', () => {
    test('should handle SSE not supported', async ({ page }) => {
      // Disable EventSource
      await page.addInitScript(() => {
        (window as unknown as { EventSource?: typeof EventSource }).EventSource = undefined
      })
      
      await page.goto('/checker')
      
      await page.locator('[data-testid="text-input"]').fill('SSE非対応テスト')
      await page.locator('[data-testid="check-button"]').click()
      
      // Should fall back to polling
      await expect(page.locator('[data-testid="status-message"]')).toContainText('チェック完了', { timeout: 30000 })
    })

    test('should handle clipboard API not available', async ({ page }) => {
      // Disable clipboard API
      await page.addInitScript(() => {
        (navigator as unknown as { clipboard?: Clipboard }).clipboard = undefined
      })
      
      await page.goto('/checker')
      
      // Submit test to get results
      await page.locator('[data-testid="text-input"]').fill('クリップボードテスト')
      await page.locator('[data-testid="check-button"]').click()
      await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
      
      // Try to copy
      await page.locator('[data-testid="copy-button"]').click()
      
      // Should show fallback message or handle gracefully
      await expect(page.locator('[data-testid="copy-fallback"]')).toContainText('手動でコピーしてください')
    })
  })

  test.describe('File Operation Errors', () => {
    test('should handle PDF generation errors', async ({ page }) => {
      // Block PDF generation requests
      await page.route('**/api/pdf/**', route => route.abort('connectionfailed'))
      
      await page.goto('/checker')
      
      // Submit test to get results
      await page.locator('[data-testid="text-input"]').fill('PDFテスト')
      await page.locator('[data-testid="check-button"]').click()
      await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
      
      // Try to download PDF
      await page.locator('[data-testid="download-button"]').click()
      
      // Should show PDF generation error
      await expect(page.locator('[data-testid="pdf-error"]')).toContainText('PDFの生成に失敗しました')
    })

    test('should handle CSV export errors', async ({ page }) => {
      // Block CSV export requests
      await page.route('**/api/export/**', route => route.abort('connectionfailed'))
      
      await page.goto('/history')
      
      // Try to export CSV
      await page.locator('[data-testid="csv-export"]').click()
      
      // Should show export error
      await expect(page.locator('[data-testid="export-error"]')).toContainText('エクスポートに失敗しました')
    })
  })

  test.describe('Error Recovery', () => {
    test('should recover from network errors with retry', async ({ page }) => {
      let requestCount = 0
      
      // Fail first request, succeed on retry
      await page.route('**/api/checks', route => {
        requestCount++
        if (requestCount === 1) {
          route.abort('connectionfailed')
        } else {
          route.continue()
        }
      })
      
      await page.goto('/checker')
      
      await page.locator('[data-testid="text-input"]').fill('リトライテスト')
      await page.locator('[data-testid="check-button"]').click()
      
      // Should show error first
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      
      // Click retry
      await page.locator('[data-testid="retry-button"]').click()
      
      // Should succeed on retry
      await expect(page.locator('[data-testid="status-message"]')).toContainText('チェック完了', { timeout: 30000 })
    })

    test('should handle partial failures gracefully', async ({ page }) => {
      // Allow check creation but fail SSE
      await page.route('**/api/checks/*/stream', route => route.abort('connectionfailed'))
      
      await page.goto('/checker')
      
      await page.locator('[data-testid="text-input"]').fill('部分的失敗テスト')
      await page.locator('[data-testid="check-button"]').click()
      
      // Should fall back to polling and eventually succeed
      await expect(page.locator('[data-testid="status-message"]')).toContainText('チェック完了', { timeout: 30000 })
    })
  })

  test.describe('Error Logging and Reporting', () => {
    test('should log errors to console', async ({ page }) => {
      const consoleLogs: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleLogs.push(msg.text())
        }
      })
      
      // Cause an error
      await page.route('**/api/checks', route => route.abort('connectionfailed'))
      
      await page.goto('/checker')
      await page.locator('[data-testid="text-input"]').fill('エラーログテスト')
      await page.locator('[data-testid="check-button"]').click()
      
      // Wait for error to occur
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      
      // Check that error was logged
      expect(consoleLogs.some(log => log.includes('connection'))).toBeTruthy()
    })
  })
})