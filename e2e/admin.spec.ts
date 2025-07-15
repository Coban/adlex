import { test, expect } from '@playwright/test'

test.describe('Admin Functionality', () => {
  test.describe('Admin User Management', () => {
    test.beforeEach(async ({ page }) => {
      // This test suite should run with admin authentication
      // We'll need to set up admin auth in the setup file
      await page.goto('/admin/users')
    })

    test('should display admin user management page', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('ユーザー管理')
      await expect(page.locator('[data-testid="user-list"]')).toBeVisible()
      await expect(page.locator('[data-testid="invite-user-button"]')).toBeVisible()
    })

    test('should display user list with correct information', async ({ page }) => {
      // Wait for users to load
      await page.waitForSelector('[data-testid="user-item"]', { timeout: 10000 })
      
      const userItems = page.locator('[data-testid="user-item"]')
      await expect(userItems).toHaveCount.greaterThan(0)
      
      // Check first user item has required fields
      const firstUser = userItems.first()
      await expect(firstUser.locator('[data-testid="user-email"]')).toBeVisible()
      await expect(firstUser.locator('[data-testid="user-role"]')).toBeVisible()
      await expect(firstUser.locator('[data-testid="user-status"]')).toBeVisible()
      await expect(firstUser.locator('[data-testid="user-actions"]')).toBeVisible()
    })

    test('should open invite user modal', async ({ page }) => {
      await page.locator('[data-testid="invite-user-button"]').click()
      
      // Check modal is opened
      await expect(page.locator('[data-testid="invite-modal"]')).toBeVisible()
      await expect(page.locator('[data-testid="invite-email-input"]')).toBeVisible()
      await expect(page.locator('[data-testid="invite-role-select"]')).toBeVisible()
      await expect(page.locator('[data-testid="send-invite-button"]')).toBeVisible()
    })

    test('should send user invitation', async ({ page }) => {
      await page.locator('[data-testid="invite-user-button"]').click()
      
      // Fill invitation form
      await page.locator('[data-testid="invite-email-input"]').fill('newuser@example.com')
      await page.locator('[data-testid="invite-role-select"]').selectOption('user')
      
      // Send invitation
      await page.locator('[data-testid="send-invite-button"]').click()
      
      // Check for success message
      await expect(page.locator('[data-testid="success-message"]')).toContainText('招待メールを送信しました')
      
      // Modal should close
      await expect(page.locator('[data-testid="invite-modal"]')).not.toBeVisible()
    })

    test('should handle invitation form validation', async ({ page }) => {
      await page.locator('[data-testid="invite-user-button"]').click()
      
      // Try to send without email
      await page.locator('[data-testid="send-invite-button"]').click()
      await expect(page.locator('[data-testid="email-error"]')).toContainText('メールアドレスが必要です')
      
      // Enter invalid email
      await page.locator('[data-testid="invite-email-input"]').fill('invalid-email')
      await page.locator('[data-testid="send-invite-button"]').click()
      await expect(page.locator('[data-testid="email-error"]')).toContainText('有効なメールアドレスを入力してください')
    })

    test('should change user role', async ({ page }) => {
      await page.waitForSelector('[data-testid="user-item"]', { timeout: 10000 })
      
      const userItem = page.locator('[data-testid="user-item"]').first()
      const roleSelect = userItem.locator('[data-testid="role-select"]')
      
      // Get current role
      const currentRole = await roleSelect.inputValue()
      const newRole = currentRole === 'admin' ? 'user' : 'admin'
      
      // Change role
      await roleSelect.selectOption(newRole)
      
      // Check for confirmation dialog
      await expect(page.locator('[data-testid="confirm-role-change"]')).toBeVisible()
      await page.locator('[data-testid="confirm-button"]').click()
      
      // Check for success message
      await expect(page.locator('[data-testid="success-message"]')).toContainText('ユーザーの役割を変更しました')
    })

    test('should deactivate user', async ({ page }) => {
      await page.waitForSelector('[data-testid="user-item"]', { timeout: 10000 })
      
      const userItem = page.locator('[data-testid="user-item"]').first()
      await userItem.locator('[data-testid="deactivate-button"]').click()
      
      // Check for confirmation dialog
      await expect(page.locator('[data-testid="confirm-deactivate"]')).toBeVisible()
      await page.locator('[data-testid="confirm-button"]').click()
      
      // Check for success message
      await expect(page.locator('[data-testid="success-message"]')).toContainText('ユーザーを無効化しました')
      
      // User should show as inactive
      await expect(userItem.locator('[data-testid="user-status"]')).toContainText('無効')
    })

    test('should filter users by role', async ({ page }) => {
      await page.waitForSelector('[data-testid="user-item"]', { timeout: 10000 })
      
      // Filter by admin role
      await page.locator('[data-testid="role-filter"]').selectOption('admin')
      
      // Wait for filter to apply
      await page.waitForTimeout(1000)
      
      // All visible users should be admin
      const userItems = page.locator('[data-testid="user-item"]')
      const count = await userItems.count()
      
      for (let i = 0; i < count; i++) {
        const roleText = await userItems.nth(i).locator('[data-testid="user-role"]').textContent()
        expect(roleText).toContain('管理者')
      }
    })

    test('should search users by email', async ({ page }) => {
      await page.waitForSelector('[data-testid="user-item"]', { timeout: 10000 })
      
      // Search for specific user
      await page.locator('[data-testid="user-search"]').fill('admin@test.com')
      await page.locator('[data-testid="search-button"]').click()
      
      // Wait for search results
      await page.waitForTimeout(1000)
      
      // Should show only matching users
      const userItems = page.locator('[data-testid="user-item"]')
      const count = await userItems.count()
      
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const emailText = await userItems.nth(i).locator('[data-testid="user-email"]').textContent()
          expect(emailText).toContain('admin@test.com')
        }
      }
    })
  })

  test.describe('Dictionary Management', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/dictionaries')
    })

    test('should display dictionary management page', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('辞書管理')
      await expect(page.locator('[data-testid="dictionary-list"]')).toBeVisible()
      await expect(page.locator('[data-testid="add-phrase-button"]')).toBeVisible()
    })

    test('should display dictionary entries', async ({ page }) => {
      await page.waitForSelector('[data-testid="dictionary-item"]', { timeout: 10000 })
      
      const dictionaryItems = page.locator('[data-testid="dictionary-item"]')
      await expect(dictionaryItems).toHaveCount.greaterThan(0)
      
      // Check first dictionary item has required fields
      const firstItem = dictionaryItems.first()
      await expect(firstItem.locator('[data-testid="phrase-text"]')).toBeVisible()
      await expect(firstItem.locator('[data-testid="phrase-category"]')).toBeVisible()
      await expect(firstItem.locator('[data-testid="phrase-actions"]')).toBeVisible()
    })

    test('should add new dictionary phrase', async ({ page }) => {
      await page.locator('[data-testid="add-phrase-button"]').click()
      
      // Check modal is opened
      await expect(page.locator('[data-testid="add-phrase-modal"]')).toBeVisible()
      
      // Fill form
      await page.locator('[data-testid="phrase-input"]').fill('テスト用語')
      await page.locator('[data-testid="category-select"]').selectOption('NG')
      await page.locator('[data-testid="reason-input"]').fill('テスト用の理由')
      
      // Submit form
      await page.locator('[data-testid="save-phrase-button"]').click()
      
      // Check for success message
      await expect(page.locator('[data-testid="success-message"]')).toContainText('辞書に追加しました')
      
      // Modal should close
      await expect(page.locator('[data-testid="add-phrase-modal"]')).not.toBeVisible()
    })

    test('should edit dictionary phrase', async ({ page }) => {
      await page.waitForSelector('[data-testid="dictionary-item"]', { timeout: 10000 })
      
      const firstItem = page.locator('[data-testid="dictionary-item"]').first()
      await firstItem.locator('[data-testid="edit-button"]').click()
      
      // Check edit modal is opened
      await expect(page.locator('[data-testid="edit-phrase-modal"]')).toBeVisible()
      
      // Modify the phrase
      await page.locator('[data-testid="phrase-input"]').fill('編集されたテスト用語')
      
      // Save changes
      await page.locator('[data-testid="save-phrase-button"]').click()
      
      // Check for success message
      await expect(page.locator('[data-testid="success-message"]')).toContainText('辞書を更新しました')
    })

    test('should delete dictionary phrase', async ({ page }) => {
      await page.waitForSelector('[data-testid="dictionary-item"]', { timeout: 10000 })
      
      const firstItem = page.locator('[data-testid="dictionary-item"]').first()
      await firstItem.locator('[data-testid="delete-button"]').click()
      
      // Check for confirmation dialog
      await expect(page.locator('[data-testid="confirm-delete"]')).toBeVisible()
      await page.locator('[data-testid="confirm-button"]').click()
      
      // Check for success message
      await expect(page.locator('[data-testid="success-message"]')).toContainText('辞書から削除しました')
    })

    test('should filter dictionary by category', async ({ page }) => {
      await page.waitForSelector('[data-testid="dictionary-item"]', { timeout: 10000 })
      
      // Filter by NG category
      await page.locator('[data-testid="category-filter"]').selectOption('NG')
      
      // Wait for filter to apply
      await page.waitForTimeout(1000)
      
      // All visible items should be NG category
      const dictionaryItems = page.locator('[data-testid="dictionary-item"]')
      const count = await dictionaryItems.count()
      
      for (let i = 0; i < count; i++) {
        const categoryText = await dictionaryItems.nth(i).locator('[data-testid="phrase-category"]').textContent()
        expect(categoryText).toContain('NG')
      }
    })

    test('should search dictionary phrases', async ({ page }) => {
      await page.waitForSelector('[data-testid="dictionary-item"]', { timeout: 10000 })
      
      // Search for specific phrase
      await page.locator('[data-testid="dictionary-search"]').fill('効果')
      await page.locator('[data-testid="search-button"]').click()
      
      // Wait for search results
      await page.waitForTimeout(1000)
      
      // Should show only matching phrases
      const dictionaryItems = page.locator('[data-testid="dictionary-item"]')
      const count = await dictionaryItems.count()
      
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const phraseText = await dictionaryItems.nth(i).locator('[data-testid="phrase-text"]').textContent()
          expect(phraseText).toContain('効果')
        }
      }
    })

    test('should regenerate embeddings', async ({ page }) => {
      await page.waitForSelector('[data-testid="dictionary-item"]', { timeout: 10000 })
      
      // Click regenerate embeddings button
      await page.locator('[data-testid="regenerate-embeddings"]').click()
      
      // Check for confirmation dialog
      await expect(page.locator('[data-testid="confirm-regenerate"]')).toBeVisible()
      await page.locator('[data-testid="confirm-button"]').click()
      
      // Check for processing message
      await expect(page.locator('[data-testid="processing-message"]')).toContainText('埋め込みを再生成中...')
      
      // Wait for completion (this might take a while)
      await expect(page.locator('[data-testid="success-message"]')).toContainText('埋め込みの再生成が完了しました', { timeout: 30000 })
    })
  })

  test.describe('Admin Access Control', () => {
    test('should prevent non-admin users from accessing admin pages', async ({ page }) => {
      // This test should be run with regular user authentication
      // We'll need to set up user auth in a separate test file or context
      
      // Try to access admin pages directly
      await page.goto('/admin/users')
      await expect(page).toHaveURL('/') // Should redirect to home
      
      await page.goto('/dictionaries')
      await expect(page).toHaveURL('/') // Should redirect to home
    })

    test('should show admin navigation items only to admin users', async ({ page }) => {
      await page.goto('/')
      
      // Admin should see admin navigation items
      await expect(page.locator('[data-testid="nav-admin"]')).toBeVisible()
      await expect(page.locator('[data-testid="nav-dictionaries"]')).toBeVisible()
    })
  })

  test.describe('Admin Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/admin')
    })

    test('should display admin dashboard', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('管理ダッシュボード')
      await expect(page.locator('[data-testid="stats-cards"]')).toBeVisible()
    })

    test('should display usage statistics', async ({ page }) => {
      // Check for statistics cards
      await expect(page.locator('[data-testid="total-users"]')).toBeVisible()
      await expect(page.locator('[data-testid="total-checks"]')).toBeVisible()
      await expect(page.locator('[data-testid="active-users"]')).toBeVisible()
      await expect(page.locator('[data-testid="usage-limit"]')).toBeVisible()
    })

    test('should display recent activity', async ({ page }) => {
      await expect(page.locator('[data-testid="recent-activity"]')).toBeVisible()
      
      // Check for activity items
      const activityItems = page.locator('[data-testid="activity-item"]')
      if (await activityItems.count() > 0) {
        await expect(activityItems.first()).toBeVisible()
      }
    })
  })
})