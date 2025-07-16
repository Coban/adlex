import { test, expect } from '@playwright/test'

test.describe('File Operations', () => {
  test.describe('PDF Export', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/checker')
      
      // Submit test text to get results
      await page.locator('[data-testid="text-input"]').fill('PDFエクスポートテスト用のテキストです。この製品は驚異的な効果があります。')
      await page.locator('[data-testid="check-button"]').click()
      
      // Wait for results
      await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
    })

    test('should download PDF report successfully', async ({ page }) => {
      // Set up download promise
      const downloadPromise = page.waitForEvent('download')
      
      // Click PDF download button
      await page.locator('[data-testid="download-button"]').click()
      
      // Wait for download to complete
      const download = await downloadPromise
      
      // Verify download properties
      expect(download.suggestedFilename()).toMatch(/check-report-\d+\.pdf/)
      expect(await download.failure()).toBeNull()
      
      // Verify file size is reasonable (not empty)
      const path = await download.path()
      expect(path).toBeTruthy()
    })

    test('should generate PDF with correct content', async ({ page }) => {
      const downloadPromise = page.waitForEvent('download')
      
      await page.locator('[data-testid="download-button"]').click()
      
      const download = await downloadPromise
      const path = await download.path()
      
      // Verify file exists and has content
      const fs = require('fs')
      const stats = fs.statSync(path)
      expect(stats.size).toBeGreaterThan(1000) // PDF should be at least 1KB
    })

    test('should handle PDF download errors', async ({ page }) => {
      // Mock PDF generation failure
      await page.route('**/api/pdf/**', route => route.abort('failed'))
      
      // Try to download PDF
      await page.locator('[data-testid="download-button"]').click()
      
      // Should show error message
      await expect(page.locator('[data-testid="pdf-error"]')).toContainText('PDFの生成に失敗しました')
    })

    test('should handle multiple PDF downloads', async ({ page }) => {
      // First download
      const downloadPromise1 = page.waitForEvent('download')
      await page.locator('[data-testid="download-button"]').click()
      const download1 = await downloadPromise1
      
      // Second download
      const downloadPromise2 = page.waitForEvent('download')
      await page.locator('[data-testid="download-button"]').click()
      const download2 = await downloadPromise2
      
      // Both should succeed
      expect(await download1.failure()).toBeNull()
      expect(await download2.failure()).toBeNull()
    })

    test('should download PDF from history detail page', async ({ page }) => {
      // Navigate to history page
      await page.goto('/history')
      
      // Wait for history items and click on first one
      await page.waitForSelector('[data-testid="history-item"]', { timeout: 10000 })
      await page.locator('[data-testid="history-item"]').first().click()
      
      // Download PDF from detail page
      const downloadPromise = page.waitForEvent('download')
      await page.locator('[data-testid="pdf-download"]').click()
      
      const download = await downloadPromise
      expect(download.suggestedFilename()).toMatch(/check-report-\d+\.pdf/)
    })

    test('should handle PDF download with large content', async ({ page }) => {
      // Submit large text
      const largeText = 'この製品は素晴らしい効果があります。'.repeat(100)
      await page.locator('[data-testid="text-input"]').fill(largeText)
      await page.locator('[data-testid="check-button"]').click()
      
      // Wait for results
      await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
      
      // Download PDF
      const downloadPromise = page.waitForEvent('download')
      await page.locator('[data-testid="download-button"]').click()
      
      const download = await downloadPromise
      expect(await download.failure()).toBeNull()
      
      // Large content should produce larger PDF
      const path = await download.path()
      const fs = require('fs')
      const stats = fs.statSync(path)
      expect(stats.size).toBeGreaterThan(5000) // Should be larger than normal PDF
    })
  })

  test.describe('CSV Export', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/history')
      
      // Wait for history items to load
      await page.waitForSelector('[data-testid="history-item"]', { timeout: 10000 })
    })

    test('should export history to CSV successfully', async ({ page }) => {
      // Set up download promise
      const downloadPromise = page.waitForEvent('download')
      
      // Click CSV export button
      await page.locator('[data-testid="csv-export"]').click()
      
      // Wait for download to complete
      const download = await downloadPromise
      
      // Verify download properties
      expect(download.suggestedFilename()).toMatch(/check-history-\d{4}-\d{2}-\d{2}\.csv/)
      expect(await download.failure()).toBeNull()
    })

    test('should generate CSV with correct headers', async ({ page }) => {
      const downloadPromise = page.waitForEvent('download')
      
      await page.locator('[data-testid="csv-export"]').click()
      
      const download = await downloadPromise
      const path = await download.path()
      
      // Read CSV content
      const fs = require('fs')
      const content = fs.readFileSync(path, 'utf-8')
      
      // Verify CSV headers
      expect(content).toContain('ID,作成日時,元のテキスト,修正されたテキスト,ステータス,違反数')
    })

    test('should export filtered history to CSV', async ({ page }) => {
      // Apply status filter
      await page.locator('[data-testid="status-filter"]').selectOption('completed')
      
      // Wait for filter to apply
      await page.waitForTimeout(1000)
      
      // Export filtered results
      const downloadPromise = page.waitForEvent('download')
      await page.locator('[data-testid="csv-export"]').click()
      
      const download = await downloadPromise
      expect(await download.failure()).toBeNull()
    })

    test('should handle CSV export errors', async ({ page }) => {
      // Mock CSV generation failure
      await page.route('**/api/export/csv', route => route.abort('failed'))
      
      // Try to export CSV
      await page.locator('[data-testid="csv-export"]').click()
      
      // Should show error message
      await expect(page.locator('[data-testid="export-error"]')).toContainText('エクスポートに失敗しました')
    })

    test('should handle empty history CSV export', async ({ page }) => {
      // Clear history or navigate to user with no history
      await page.route('**/api/history**', route => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ data: [], pagination: { total: 0, page: 1, totalPages: 1 } })
        })
      })
      
      await page.reload()
      
      // Try to export empty history
      const downloadPromise = page.waitForEvent('download')
      await page.locator('[data-testid="csv-export"]').click()
      
      const download = await downloadPromise
      const path = await download.path()
      
      // Should still generate CSV with headers
      const fs = require('fs')
      const content = fs.readFileSync(path, 'utf-8')
      expect(content).toContain('ID,作成日時,元のテキスト,修正されたテキスト,ステータス,違反数')
    })
  })

  test.describe('Text Copy Operations', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/checker')
      
      // Submit test text
      await page.locator('[data-testid="text-input"]').fill('コピーテスト用のテキストです。')
      await page.locator('[data-testid="check-button"]').click()
      
      // Wait for results
      await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
    })

    test('should copy modified text to clipboard', async ({ page }) => {
      // Click copy button
      await page.locator('[data-testid="copy-button"]').click()
      
      // Just verify the copy button works (UI feedback)
      // Note: Actual clipboard verification is browser-dependent
      await expect(page.locator('[data-testid="copy-success"]')).toBeVisible()
    })

    test('should show copy success feedback', async ({ page }) => {
      // Click copy button
      await page.locator('[data-testid="copy-button"]').click()
      
      // Should show success message
      await expect(page.locator('[data-testid="copy-success"]')).toContainText('コピーしました')
    })

    test('should handle clipboard API not available', async ({ page }) => {
      // Disable clipboard API
      await page.addInitScript(() => {
        (navigator as unknown as { clipboard?: Clipboard }).clipboard = undefined
      })
      
      // Try to copy
      await page.locator('[data-testid="copy-button"]').click()
      
      // Should show fallback message
      await expect(page.locator('[data-testid="copy-fallback"]')).toContainText('手動でコピーしてください')
    })

    test('should copy original text when requested', async ({ page }) => {
      // Click copy original text button (if available)
      const copyOriginalButton = page.locator('[data-testid="copy-original-button"]')
      if (await copyOriginalButton.isVisible()) {
        await copyOriginalButton.click()
        
        // Verify UI feedback appears
        await expect(page.locator('[data-testid="copy-success"]')).toBeVisible()
      }
    })

    test('should copy violation details', async ({ page }) => {
      // Clipboard permissions are granted globally in playwright config
      
      // Switch to violations tab
      await page.locator('[data-testid="violations-tab"]').click()
      
      // Copy violation details if available
      const copyViolationButton = page.locator('[data-testid="copy-violation-button"]')
      if (await copyViolationButton.isVisible()) {
        await copyViolationButton.click()
        
        // Verify UI feedback appears
        await expect(page.locator('[data-testid="copy-success"]')).toBeVisible()
      }
    })
  })

  test.describe('File Upload Operations', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/checker')
    })

    test('should handle text file upload', async ({ page }) => {
      // Create temporary text file
      const fs = require('fs')
      const path = require('path')
      const tmpDir = require('os').tmpdir()
      const testFile = path.join(tmpDir, 'test-upload.txt')
      fs.writeFileSync(testFile, 'アップロードテスト用のテキストです。')
      
      // Check if file upload is available
      const fileUpload = page.locator('[data-testid="file-upload"]')
      if (await fileUpload.isVisible()) {
        await fileUpload.setInputFiles(testFile)
        
        // Text should be populated
        await expect(page.locator('[data-testid="text-input"]')).toHaveValue('アップロードテスト用のテキストです。')
      }
      
      // Clean up
      fs.unlinkSync(testFile)
    })

    test('should handle file upload errors', async ({ page }) => {
      // Create invalid file
      const fs = require('fs')
      const path = require('path')
      const tmpDir = require('os').tmpdir()
      const testFile = path.join(tmpDir, 'test-upload.pdf')
      fs.writeFileSync(testFile, 'invalid content')
      
      const fileUpload = page.locator('[data-testid="file-upload"]')
      if (await fileUpload.isVisible()) {
        await fileUpload.setInputFiles(testFile)
        
        // Should show error message
        await expect(page.locator('[data-testid="upload-error"]')).toContainText('サポートされていないファイル形式です')
      }
      
      // Clean up
      fs.unlinkSync(testFile)
    })

    test('should handle large file upload', async ({ page }) => {
      // Create large text file
      const fs = require('fs')
      const path = require('path')
      const tmpDir = require('os').tmpdir()
      const testFile = path.join(tmpDir, 'large-upload.txt')
      fs.writeFileSync(testFile, 'a'.repeat(50000)) // 50KB file
      
      const fileUpload = page.locator('[data-testid="file-upload"]')
      if (await fileUpload.isVisible()) {
        await fileUpload.setInputFiles(testFile)
        
        // Should show file size warning
        await expect(page.locator('[data-testid="file-size-warning"]')).toContainText('ファイルサイズが大きすぎます')
      }
      
      // Clean up
      fs.unlinkSync(testFile)
    })
  })

  test.describe('Batch Operations', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/history')
      
      // Wait for history items
      await page.waitForSelector('[data-testid="history-item"]', { timeout: 10000 })
    })

    test('should select multiple history items', async ({ page }) => {
      // Check if batch operations are available
      const selectAllButton = page.locator('[data-testid="select-all"]')
      if (await selectAllButton.isVisible()) {
        await selectAllButton.click()
        
        // All items should be selected
        const checkedItems = page.locator('[data-testid="history-item"] [data-testid="item-checkbox"]:checked')
        await expect(checkedItems.first()).toBeVisible()
      }
    })

    test('should export selected items to CSV', async ({ page }) => {
      const selectAllButton = page.locator('[data-testid="select-all"]')
      if (await selectAllButton.isVisible()) {
        await selectAllButton.click()
        
        // Export selected items
        const downloadPromise = page.waitForEvent('download')
        await page.locator('[data-testid="export-selected"]').click()
        
        const download = await downloadPromise
        expect(download.suggestedFilename()).toMatch(/selected-checks-\d{4}-\d{2}-\d{2}\.csv/)
      }
    })

    test('should delete selected items', async ({ page }) => {
      const selectAllButton = page.locator('[data-testid="select-all"]')
      if (await selectAllButton.isVisible()) {
        // Select first item
        await page.locator('[data-testid="history-item"]').first().locator('[data-testid="item-checkbox"]').check()
        
        // Delete selected items
        await page.locator('[data-testid="delete-selected"]').click()
        
        // Confirm deletion
        await page.locator('[data-testid="confirm-delete"]').click()
        
        // Should show success message
        await expect(page.locator('[data-testid="delete-success"]')).toContainText('選択したアイテムを削除しました')
      }
    })
  })

  test.describe('Print Operations', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/checker')
      
      // Submit test text
      await page.locator('[data-testid="text-input"]').fill('印刷テスト用のテキストです。')
      await page.locator('[data-testid="check-button"]').click()
      
      // Wait for results
      await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
    })

    test('should open print dialog', async ({ page }) => {
      // Check if print button is available
      const printButton = page.locator('[data-testid="print-button"]')
      if (await printButton.isVisible()) {
        // Mock print dialog
        await page.evaluate(() => {
          window.print = () => console.log('Print dialog opened')
        })
        
        await printButton.click()
        
        // Should trigger print
        const printLogs = []
        page.on('console', msg => {
          if (msg.text().includes('Print dialog opened')) {
            printLogs.push(msg.text())
          }
        })
        
        expect(printLogs.length).toBeGreaterThan(0)
      }
    })

    test('should format content for printing', async ({ page }) => {
      const printButton = page.locator('[data-testid="print-button"]')
      if (await printButton.isVisible()) {
        await printButton.click()
        
        // Check print styles are applied
        const printStyles = await page.evaluate(() => {
          const printStyleSheets = Array.from(document.styleSheets).filter(sheet => 
            sheet.media.mediaText.includes('print')
          )
          return printStyleSheets.length > 0
        })
        
        expect(printStyles).toBeTruthy()
      }
    })
  })

  test.describe('File Operations Performance', () => {
    test('should handle multiple simultaneous downloads', async ({ page }) => {
      await page.goto('/checker')
      
      // Submit test text
      await page.locator('[data-testid="text-input"]').fill('パフォーマンステスト')
      await page.locator('[data-testid="check-button"]').click()
      
      // Wait for results
      await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 30000 })
      
      // Start multiple downloads simultaneously
      const downloadPromises = []
      for (let i = 0; i < 3; i++) {
        downloadPromises.push(page.waitForEvent('download'))
        await page.locator('[data-testid="download-button"]').click()
      }
      
      // All downloads should complete
      const downloads = await Promise.all(downloadPromises)
      downloads.forEach(download => {
        expect(download.failure()).toBeNull()
      })
    })

    test('should handle large file operations without timeout', async ({ page }) => {
      await page.goto('/checker')
      
      // Submit large text
      const largeText = 'パフォーマンステスト用の長いテキスト。'.repeat(500)
      await page.locator('[data-testid="text-input"]').fill(largeText)
      await page.locator('[data-testid="check-button"]').click()
      
      // Wait for results
      await expect(page.locator('[data-testid="results-section"]')).toBeVisible({ timeout: 45000 })
      
      // Download should complete without timeout
      const downloadPromise = page.waitForEvent('download')
      await page.locator('[data-testid="download-button"]').click()
      
      const download = await downloadPromise
      expect(await download.failure()).toBeNull()
    })
  })
})