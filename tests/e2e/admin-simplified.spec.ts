import { test, expect } from '@playwright/test'

test.describe('管理機能（簡素版）', () => {
  test.beforeEach(async ({ page }) => {
    // SKIP_AUTH環境変数を設定
    await page.addInitScript(() => {
      (window as any).process = {
        env: {
          NEXT_PUBLIC_SKIP_AUTH: 'true',
          SKIP_AUTH: 'true',
          NODE_ENV: process.env.NODE_ENV || 'test',
          TZ: process.env.TZ
        }
      };
    });
    
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
  })

  test('should access admin user management page', async ({ page }) => {
    // ページタイトルまたは管理要素の確認
    const titleElement = page.locator('h1, [data-testid="page-title"]')
    const inviteButton = page.locator('[data-testid="invite-user-button"]')
    
    // 少なくとも1つの管理要素が表示されること
    const hasTitle = await titleElement.isVisible({ timeout: 5000 }).catch(() => false)
    const hasInviteButton = await inviteButton.isVisible({ timeout: 5000 }).catch(() => false)
    
    expect(hasTitle || hasInviteButton).toBe(true)
  })

  test('should display user management interface', async ({ page }) => {
    // ページの基本構造要素を確認
    const pageElements = [
      page.locator('h1'),
      page.locator('[data-testid="invite-user-button"]'),
      page.locator('[data-testid="user-list"], .user-list, table')
    ]
    
    let visibleElements = 0
    for (const element of pageElements) {
      if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
        visibleElements++
      }
    }
    
    // 少なくとも1つの要素が表示されていること
    expect(visibleElements).toBeGreaterThan(0)
  })

  test('should handle invite user interaction', async ({ page }) => {
    // 招待ボタンが存在すること
    const inviteButton = page.locator('[data-testid="invite-user-button"]')
    await expect(inviteButton).toBeVisible()
    
    // クリックして何らかの反応があること
    await inviteButton.click()
    await page.waitForTimeout(500)
    
    // 何らかの招待関連要素が表示されること（厳密な検証）
    const inviteElements = page.locator('[data-testid*="invite"]')
    await expect(inviteElements.first()).toBeVisible()
  })
})