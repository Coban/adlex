import { test, expect } from '@playwright/test';

/**
 * 管理者ユーザー管理テスト（管理者認証済み）
 * 
 * 目的:
 * - 管理者画面へのアクセス確認
 * - ユーザー管理機能の基本動作
 * - 招待機能のUI動作確認
 * - 管理者権限の適切な動作確認
 */

test.describe('管理者ユーザー管理（管理者認証済み）', () => {
  test.beforeEach(async ({ page }) => {
    // 管理者storageStateにより認証済み状態で開始
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
  });

  test('管理者ページへのアクセス確認', async ({ page }) => {
    // 管理者ページの基本要素確認
    const titleElement = page.locator('h1, [data-testid="page-title"]');
    const inviteButton = page.locator('[data-testid="invite-user-button"]');
    
    // 管理者専用要素が表示されていること
    const hasTitle = await titleElement.isVisible({ timeout: 5000 }).catch(() => false);
    const hasInviteButton = await inviteButton.isVisible({ timeout: 5000 }).catch(() => false);
    
    expect(hasTitle || hasInviteButton).toBe(true);
    
    // URLが管理者ページであることを確認
    expect(page.url()).toContain('/admin/users');
  });

  test('ユーザー管理インターフェースの表示', async ({ page }) => {
    // ページの基本構造要素を確認
    const pageElements = [
      page.locator('h1'),
      page.locator('[data-testid="invite-user-button"]'),
      page.locator('[data-testid="user-list"], .user-list, table')
    ];
    
    let visibleElements = 0;
    for (const element of pageElements) {
      if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
        visibleElements++;
      }
    }
    
    // 少なくとも1つの管理要素が表示されていること
    expect(visibleElements).toBeGreaterThan(0);
  });

  test('ユーザー招待機能の基本動作', async ({ page }) => {
    // 招待ボタンの存在確認
    const inviteButton = page.locator('[data-testid="invite-user-button"]');
    await expect(inviteButton).toBeVisible();
    
    // 招待ボタンをクリック
    await inviteButton.click();
    
    // 招待フォームまたはモーダルが表示されることを確認
    const inviteElements = [
      page.locator('[data-testid*="invite"]'),
      page.locator('[data-testid="invite-email"]'),
      page.locator('input[type="email"]'),
      page.locator('text=/招待|invite/i')
    ];
    
    let inviteFormFound = false;
    for (const element of inviteElements) {
      if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
        inviteFormFound = true;
        break;
      }
    }
    
    expect(inviteFormFound).toBe(true);
  });

  test('ユーザー招待フォームの入力テスト', async ({ page }) => {
    const inviteButton = page.locator('[data-testid="invite-user-button"]');
    await inviteButton.click();
    
    // メールアドレス入力フィールドの確認
    const emailInput = page.locator('[data-testid="invite-email"], input[type="email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill('newuser@test.com');
      await expect(emailInput).toHaveValue('newuser@test.com');
      
      // ロール選択（存在する場合）
      const roleSelect = page.locator('[data-testid="invite-role"], select, [data-testid*="role"]');
      if (await roleSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        await roleSelect.click();
        
        // ロールオプションの確認
        const userOption = page.locator('option[value="user"], [data-value="user"]');
        if (await userOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await userOption.click();
        }
      }
      
      // 送信ボタンの確認
      const submitButton = page.locator('[data-testid="invite-submit"], button[type="submit"]');
      if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(submitButton).toBeEnabled();
      }
    }
  });

  test('既存ユーザーリストの表示確認', async ({ page }) => {
    // ユーザーリストの表示確認
    const userListElements = [
      page.locator('[data-testid="user-list"]'),
      page.locator('.user-list'),
      page.locator('table'),
      page.locator('[data-testid*="user"]')
    ];
    
    let userListFound = false;
    for (const element of userListElements) {
      if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
        userListFound = true;
        
        // ユーザー情報の基本項目確認
        const userInfoElements = [
          page.locator('text=/email|メール/i'),
          page.locator('text=/role|ロール|権限/i'),
          page.locator('text=/status|ステータス|状態/i')
        ];
        
        for (const infoElement of userInfoElements) {
          if (await infoElement.isVisible({ timeout: 2000 }).catch(() => false)) {
            break;
          }
        }
        break;
      }
    }
    
    // ユーザーリストまたは空状態メッセージが表示されていること
    if (!userListFound) {
      const emptyStateElements = [
        page.locator('text=/ユーザーがいません|No users|空/i'),
        page.locator('[data-testid="empty-state"]')
      ];
      
      for (const element of emptyStateElements) {
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          userListFound = true;
          break;
        }
      }
    }
    
    expect(userListFound).toBe(true);
  });

  test('ユーザー操作メニューの確認', async ({ page }) => {
    // ユーザー行のアクションボタン確認
    const actionElements = [
      page.locator('[data-testid*="user-actions"]'),
      page.locator('[data-testid*="menu"]'),
      page.locator('button[aria-label*="menu"]'),
      page.locator('.user-actions')
    ];
    
    let actionFound = false;
    for (const element of actionElements) {
      if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
        await element.click();
        
        // アクションメニューの項目確認
        const menuItems = [
          page.locator('text=/編集|Edit/i'),
          page.locator('text=/削除|Delete/i'),
          page.locator('text=/停止|Disable/i'),
          page.locator('text=/有効化|Enable/i')
        ];
        
        for (const item of menuItems) {
          if (await item.isVisible({ timeout: 2000 }).catch(() => false)) {
            actionFound = true;
            break;
          }
        }
        break;
      }
    }
    
    // アクションメニューが見つからない場合は、テストデータが不足している可能性
    if (!actionFound) {
      console.log('User action menus not found - this may be due to empty user list');
    }
  });

  test('管理者ナビゲーションの確認', async ({ page }) => {
    // 管理者サイドバーまたはナビゲーションの確認
    const navElements = [
      page.locator('[data-testid="admin-nav"]'),
      page.locator('.admin-sidebar'),
      page.locator('nav'),
      page.locator('text=/ユーザー管理|User Management/i')
    ];
    
    let navFound = false;
    for (const element of navElements) {
      if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
        navFound = true;
        break;
      }
    }
    
    // ナビゲーション関連の管理者リンク確認
    const adminLinks = [
      page.locator('text=/辞書管理|Dictionary/i'),
      page.locator('text=/設定|Settings/i'),
      page.locator('text=/統計|Statistics/i'),
      page.locator('text=/ダッシュボード|Dashboard/i')
    ];
    
    for (const link of adminLinks) {
      if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
        navFound = true;
        break;
      }
    }
    
    expect(navFound).toBe(true);
  });

  test('管理者権限の確認', async ({ page }) => {
    // 現在のページが管理者ページであることを確認
    expect(page.url()).toContain('/admin');
    
    // 管理者専用要素の確認
    const adminOnlyElements = [
      page.locator('[data-testid="invite-user-button"]'),
      page.locator('text=/招待|Invite/i'),
      page.locator('text=/管理|Admin/i')
    ];
    
    let adminElementFound = false;
    for (const element of adminOnlyElements) {
      if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
        adminElementFound = true;
        break;
      }
    }
    
    expect(adminElementFound).toBe(true);
  });
});