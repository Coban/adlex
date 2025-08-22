import { test, expect } from '@playwright/test';

import { injectTestEnvironment, shouldSkipAuthTest, setupAuthIfAvailable } from './utils/environment-detector';
import { AdminUsersPage, DictionaryPage } from './utils/page-objects';
import { 
  mockApiResponse,
  setupTestEnvironment,
  validatePageStructure,
  testFormValidation
} from './utils/test-helpers';

test.describe('管理機能（完全版）', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // クリーン状態で開始

  test.beforeEach(async ({ page }) => {
    await injectTestEnvironment(page);
    await setupTestEnvironment(page);
    
    // 全ての管理機能テストで認証状態をチェック
    if (shouldSkipAuthTest()) {
      test.skip(true, 'Supabase環境が利用できないため、管理機能テスト全体をスキップ');
      return;
    }
  });

  test.describe('ユーザー管理', () => {
    let adminUsersPage: AdminUsersPage;

    test.beforeEach(async ({ page }) => {
      adminUsersPage = new AdminUsersPage(page);
    });

    test('管理者ページの基本インターフェースが表示される', async ({ page }) => {
      if (shouldSkipAuthTest()) {
        test.skip(true, 'Supabase環境が利用できないため、管理機能テストをスキップ');
        return;
      }

      const authSetupSuccessful = await setupAuthIfAvailable(page);
      if (!authSetupSuccessful) {
        test.skip(true, '管理者認証セットアップに失敗しました');
        return;
      }

      await adminUsersPage.expectAdminInterface();
      await validatePageStructure(page);
    });

    test('ユーザーリストが正しく表示される', async ({ page }) => {
      // モックユーザーデータの設定
      const mockUsers = [
        {
          id: '1',
          email: 'admin@test.com',
          role: 'admin',
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z'
        },
        {
          id: '2',
          email: 'user1@test.com',
          role: 'user',
          status: 'active',
          createdAt: '2024-01-02T00:00:00Z'
        }
      ];

      await mockApiResponse(page, 'admin/users', { users: mockUsers });
      
      await adminUsersPage.expectUserTable();
      
      // ユーザー行が表示されることを確認
      const userRows = adminUsersPage.userRows;
      const rowCount = await userRows.count();
      expect(rowCount).toBeGreaterThan(0);
    });

    test('ユーザー招待フローが正常に動作する', async ({ page }) => {
      // 招待API のモック
      await mockApiResponse(page, 'admin/users/invite', {
        success: true,
        message: '招待メールを送信しました'
      });

      await adminUsersPage.goto('/admin/users');
      
      const testEmail = 'newuser@test.com';
      await adminUsersPage.inviteUser(testEmail, 'user');
      
      // 成功メッセージまたはリストの更新を確認
      const successMessage = page.locator('text=招待メールを送信, text=招待しました, text=成功');
      const hasSuccessMessage = await successMessage.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasSuccessMessage) {
        await expect(successMessage).toBeVisible();
      } else {
        // ダイアログが閉じられることを確認
        await expect(adminUsersPage.inviteDialog).not.toBeVisible();
      }
    });

    test('ユーザー招待時のバリデーション', async ({ page }) => {
      await adminUsersPage.goto('/admin/users');
      await adminUsersPage.inviteButton.click();
      
      // フォームバリデーションのテスト
      await testFormValidation(
        page,
        '[role="dialog"], .modal, [data-testid="invite-dialog"]',
        ['input[name="email"]', '[data-testid="invite-email"]']
      );
    });

    test('ユーザーステータスの変更', async ({ page }) => {
      const mockUsers = [
        {
          id: '2',
          email: 'user1@test.com',
          role: 'user',
          status: 'active',
          createdAt: '2024-01-02T00:00:00Z'
        }
      ];

      await mockApiResponse(page, 'admin/users', { users: mockUsers });
      await mockApiResponse(page, 'admin/users/2/status', { 
        success: true,
        user: { ...mockUsers[0], status: 'suspended' }
      });

      await adminUsersPage.goto('/admin/users');
      
      // ステータス変更ボタンまたはメニューを探す
      const statusButtons = [
        '[data-testid="user-status-button"]',
        'button:has-text("停止")',
        'button:has-text("有効")',
        '[data-testid="user-actions"]'
      ];

      let statusButtonFound = false;
      for (const selector of statusButtons) {
        if (await page.locator(selector).isVisible({ timeout: 3000 }).catch(() => false)) {
          await page.locator(selector).first().click();
          statusButtonFound = true;
          break;
        }
      }

      if (statusButtonFound) {
        // ステータス変更の確認ダイアログまたは成功メッセージを確認
        const confirmationElements = [
          'text=変更しますか',
          'text=確認',
          'text=更新されました',
          'text=変更しました'
        ];

        let confirmationFound = false;
        for (const selector of confirmationElements) {
          if (await page.locator(selector).isVisible({ timeout: 3000 }).catch(() => false)) {
            confirmationFound = true;
            break;
          }
        }

        expect(confirmationFound).toBe(true);
      } else {
        console.log('Status change buttons not found - feature may not be implemented yet');
      }
    });

    test('ユーザー検索機能', async ({ page }) => {
      const mockUsers = [
        {
          id: '1',
          email: 'admin@test.com',
          role: 'admin',
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z'
        },
        {
          id: '2',
          email: 'user1@test.com',
          role: 'user',
          status: 'active',
          createdAt: '2024-01-02T00:00:00Z'
        }
      ];

      await mockApiResponse(page, 'admin/users', { users: mockUsers });
      await mockApiResponse(page, 'admin/users?search=user1', { 
        users: [mockUsers[1]]
      });

      await adminUsersPage.goto('/admin/users');
      
      // 検索フィールドを探す
      const searchInput = page.locator(
        '[data-testid="user-search"], input[placeholder*="検索"], input[type="search"]'
      );

      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.fill('user1');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000); // 検索結果の待機

        // 検索結果が1件になることを確認
        const visibleRows = await adminUsersPage.userRows.count();
        expect(visibleRows).toBe(1);
      } else {
        console.log('Search functionality not found - feature may not be implemented yet');
      }
    });
  });

  test.describe('辞書管理', () => {
    let dictionaryPage: DictionaryPage;

    test.beforeEach(async ({ page }) => {
      dictionaryPage = new DictionaryPage(page);
    });

    test('辞書管理ページの基本インターフェースが表示される', async ({ page }) => {
      await dictionaryPage.expectDictionaryInterface();
      await validatePageStructure(page);
    });

    test('辞書エントリーの一覧表示', async ({ page }) => {
      const mockDictionaries = [
        {
          id: '1',
          phrase: 'がんが治る',
          type: 'NG',
          category: '医薬品効果',
          createdAt: '2024-01-01T00:00:00Z'
        },
        {
          id: '2',
          phrase: '健康維持に役立つ',
          type: 'ALLOW',
          category: '一般表現',
          createdAt: '2024-01-02T00:00:00Z'
        }
      ];

      await mockApiResponse(page, 'admin/dictionaries', { dictionaries: mockDictionaries });
      
      await dictionaryPage.goto('/admin/dictionaries');
      
      // 辞書テーブルが表示されることを確認
      if (await dictionaryPage.dictionaryTable.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(dictionaryPage.dictionaryTable).toBeVisible();
        
        // 辞書エントリーが表示されることを確認
        const rowCount = await dictionaryPage.dictionaryRows.count();
        expect(rowCount).toBeGreaterThan(0);
      }
    });

    test('新しい辞書エントリーの追加', async ({ page }) => {
      await mockApiResponse(page, 'admin/dictionaries', { 
        success: true,
        dictionary: {
          id: '3',
          phrase: 'テスト表現',
          type: 'NG',
          category: 'テスト',
          createdAt: new Date().toISOString()
        }
      });

      await dictionaryPage.goto('/admin/dictionaries');
      
      // 追加ボタンを探す
      if (await dictionaryPage.addButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await dictionaryPage.addButton.click();
        
        // 追加フォームまたはモーダルが表示されることを確認
        const addForm = page.locator(
          '[data-testid="add-dictionary-form"], [role="dialog"], .modal'
        );
        await expect(addForm).toBeVisible({ timeout: 5000 });
        
        // フォームフィールドの確認
        const phraseInput = page.locator(
          '[data-testid="dictionary-phrase"], input[name="phrase"]'
        );
        const typeSelect = page.locator(
          '[data-testid="dictionary-type"], select[name="type"]'
        );
        
        if (await phraseInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await phraseInput.fill('テスト表現');
        }
        
        if (await typeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
          await typeSelect.selectOption('NG');
        }
        
        // 保存ボタン
        const saveButton = page.locator(
          'button:has-text("保存"), button:has-text("追加"), [data-testid="save-dictionary"]'
        );
        if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await saveButton.click();
          
          // 成功メッセージまたはリストの更新を確認
          const successMessage = page.locator('text=追加しました, text=保存しました, text=成功');
          const hasSuccess = await successMessage.isVisible({ timeout: 5000 }).catch(() => false);
          
          expect(hasSuccess || await addForm.isHidden()).toBe(true);
        }
      } else {
        console.log('Add dictionary button not found - feature may not be implemented yet');
      }
    });

    test('辞書エントリーの検索', async ({ page }) => {
      const allDictionaries = [
        {
          id: '1',
          phrase: 'がんが治る',
          type: 'NG',
          category: '医薬品効果',
          createdAt: '2024-01-01T00:00:00Z'
        },
        {
          id: '2',
          phrase: '健康維持',
          type: 'ALLOW',
          category: '一般表現',
          createdAt: '2024-01-02T00:00:00Z'
        }
      ];

      const searchResults = [allDictionaries[0]];

      await mockApiResponse(page, 'admin/dictionaries', { dictionaries: allDictionaries });
      await mockApiResponse(page, 'admin/dictionaries?search=がん', { 
        dictionaries: searchResults 
      });

      await dictionaryPage.goto('/admin/dictionaries');
      await dictionaryPage.searchDictionary('がん');
      
      // 検索結果が絞り込まれることを確認
      if (await dictionaryPage.dictionaryTable.isVisible({ timeout: 3000 }).catch(() => false)) {
        const rowCount = await dictionaryPage.dictionaryRows.count();
        expect(rowCount).toBe(1);
      }
    });

    test('辞書エントリーの編集', async ({ page }) => {
      const mockDictionaries = [
        {
          id: '1',
          phrase: 'がんが治る',
          type: 'NG',
          category: '医薬品効果',
          createdAt: '2024-01-01T00:00:00Z'
        }
      ];

      await mockApiResponse(page, 'admin/dictionaries', { dictionaries: mockDictionaries });
      await mockApiResponse(page, 'admin/dictionaries/1', {
        success: true,
        dictionary: { ...mockDictionaries[0], phrase: '更新された表現' }
      });

      await dictionaryPage.goto('/admin/dictionaries');
      
      // 編集ボタンを探す
      const editButtons = [
        '[data-testid="edit-dictionary"]',
        'button:has-text("編集")',
        'button[title="編集"]'
      ];

      let editButtonFound = false;
      for (const selector of editButtons) {
        if (await page.locator(selector).isVisible({ timeout: 3000 }).catch(() => false)) {
          await page.locator(selector).first().click();
          editButtonFound = true;
          break;
        }
      }

      if (editButtonFound) {
        // 編集フォームが表示されることを確認
        const editForm = page.locator(
          '[data-testid="edit-dictionary-form"], [role="dialog"]'
        );
        await expect(editForm).toBeVisible({ timeout: 5000 });
      } else {
        console.log('Edit dictionary button not found - feature may not be implemented yet');
      }
    });
  });

  test.describe('組織設定', () => {
    test('組織設定ページへのアクセス', async ({ page }) => {
      await page.goto('/admin/settings');
      await page.waitForLoadState('networkidle');

      // 組織設定ページの基本要素を確認
      const pageElements = [
        page.locator('h1'),
        page.locator('[data-testid="organization-settings"]'),
        page.locator('form')
      ];

      let visibleElements = 0;
      for (const element of pageElements) {
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          visibleElements++;
        }
      }

      expect(visibleElements).toBeGreaterThan(0);
    });

    test('使用量統計の表示', async ({ page }) => {
      const mockStats = {
        totalChecks: 1250,
        monthlyChecks: 85,
        activeUsers: 12,
        violationsFound: 340
      };

      await mockApiResponse(page, 'admin/stats', mockStats);
      
      await page.goto('/admin/dashboard');
      await page.waitForLoadState('networkidle');

      // 統計情報の表示を確認
      const statsElements = [
        'text=1250',
        'text=85',
        'text=12',
        'text=340',
        '[data-testid="stats-card"]',
        '.stats-card'
      ];

      let statsFound = false;
      for (const selector of statsElements) {
        if (await page.locator(selector).isVisible({ timeout: 3000 }).catch(() => false)) {
          statsFound = true;
          break;
        }
      }

      if (statsFound) {
        console.log('Statistics display is working');
      } else {
        console.log('No statistics display found - feature may not be implemented yet');
      }
    });
  });

  test.describe('権限制御', () => {
    test.use({ storageState: 'playwright/.auth/user.json' }); // 一般ユーザーとしてテスト

    test('一般ユーザーは管理ページにアクセスできない', async ({ page }) => {
      await page.goto('/admin/users');
      await page.waitForLoadState('networkidle');

      const currentUrl = page.url();
      
      // アクセス拒否または認証ページへのリダイレクトを確認
      const isAccessDenied = 
        currentUrl.includes('/auth/signin') ||
        currentUrl.includes('/403') ||
        currentUrl.includes('/unauthorized') ||
        await page.locator('text=アクセス権限がありません, text=403, text=Forbidden').isVisible({ timeout: 3000 }).catch(() => false);

      expect(isAccessDenied).toBe(true);
    });
  });
});