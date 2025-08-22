import { Page, Locator, expect } from '@playwright/test';

/**
 * T006: 管理画面用ページオブジェクトの追加
 * 共通アクション（ログイン、ナビゲーション）の統一
 * エラー状態確認メソッドの標準化
 */

/**
 * 基底ページクラス - 共通機能を提供
 */
export class BasePage {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * 指定したURLに移動
   */
  async goto(url: string): Promise<void> {
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * ページタイトルの確認
   */
  async expectTitle(title: string): Promise<void> {
    await expect(this.page).toHaveTitle(new RegExp(title));
  }

  /**
   * 基本的なページ構造の確認
   */
  async expectBasicStructure(): Promise<void> {
    const structureElements = [
      this.page.locator('header, [role="banner"]'),
      this.page.locator('main, [role="main"]'),
      this.page.locator('nav, [role="navigation"]')
    ];

    let visibleElements = 0;
    for (const element of structureElements) {
      if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
        visibleElements++;
      }
    }

    expect(visibleElements).toBeGreaterThan(0);
  }

  /**
   * エラーメッセージの確認
   */
  async expectError(errorText?: string): Promise<void> {
    const errorSelectors = [
      '[data-testid="error-message"]',
      '[role="alert"]',
      '.error-message',
      '.text-red-500',
      '.text-destructive'
    ];

    if (errorText) {
      await expect(this.page.locator(`text=${errorText}`)).toBeVisible();
    } else {
      let errorFound = false;
      for (const selector of errorSelectors) {
        if (await this.page.locator(selector).isVisible({ timeout: 3000 }).catch(() => false)) {
          errorFound = true;
          break;
        }
      }
      expect(errorFound).toBe(true);
    }
  }

  /**
   * 成功メッセージの確認
   */
  async expectSuccess(successText?: string): Promise<void> {
    const successSelectors = [
      '[data-testid="success-message"]',
      '.success-message',
      '.text-green-500',
      '.text-success',
      'text=成功',
      'text=完了',
      'text=保存しました'
    ];

    if (successText) {
      await expect(this.page.locator(`text=${successText}`)).toBeVisible();
    } else {
      let successFound = false;
      for (const selector of successSelectors) {
        if (await this.page.locator(selector).isVisible({ timeout: 5000 }).catch(() => false)) {
          successFound = true;
          break;
        }
      }
      expect(successFound).toBe(true);
    }
  }
}

/**
 * 管理画面ユーザー管理ページのページオブジェクト
 */
export class AdminUsersPage extends BasePage {
  // メインUI要素
  readonly userListTable: Locator;
  readonly inviteButton: Locator;
  readonly searchInput: Locator;
  readonly userRows: Locator;
  readonly inviteDialog: Locator;

  constructor(page: Page) {
    super(page);
    
    // より柔軟なセレクターを使用
    this.userListTable = this.page.locator([
      '[data-testid="user-table"]',
      'table',
      '.user-list'
    ].join(', '));

    this.inviteButton = this.page.locator([
      '[data-testid="user-invite-button"]',
      'button:has-text("招待")',
      'button:has-text("ユーザー招待")',
      'button:has-text("追加")'
    ].join(', '));

    this.searchInput = this.page.locator([
      '[data-testid="user-search"]',
      'input[placeholder*="検索"]',
      'input[type="search"]',
      'input[name="search"]'
    ].join(', '));

    this.userRows = this.page.locator([
      '[data-testid="user-row"]',
      'tbody tr',
      '.user-row'
    ].join(', '));

    this.inviteDialog = this.page.locator([
      '[data-testid="invite-dialog"]',
      '[role="dialog"]',
      '.modal',
      '.dialog'
    ].join(', '));
  }

  /**
   * 管理者インターフェースの確認
   */
  async expectAdminInterface(): Promise<void> {
    await this.expectBasicStructure();
    
    // 管理者専用要素の確認
    const adminElements = [
      this.userListTable,
      this.inviteButton,
      this.page.locator('h1, h2').filter({ hasText: /ユーザー|User|管理/ })
    ];

    let visibleAdminElements = 0;
    for (const element of adminElements) {
      if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
        visibleAdminElements++;
      }
    }

    expect(visibleAdminElements).toBeGreaterThan(0);
  }

  /**
   * ユーザーテーブルの確認
   */
  async expectUserTable(): Promise<void> {
    await expect(this.userListTable).toBeVisible({ timeout: 10000 });
  }

  /**
   * ユーザー招待処理
   */
  async inviteUser(email: string, role: 'admin' | 'user' = 'user'): Promise<void> {
    await this.inviteButton.click();
    await expect(this.inviteDialog).toBeVisible({ timeout: 5000 });

    // メールアドレス入力
    const emailInput = this.inviteDialog.locator([
      '[data-testid="invite-email"]',
      'input[name="email"]',
      'input[type="email"]'
    ].join(', '));
    
    await emailInput.fill(email);

    // ロール選択
    const roleSelect = this.inviteDialog.locator([
      '[data-testid="invite-role"]',
      'select[name="role"]',
      '[name="role"]'
    ].join(', '));

    if (await roleSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await roleSelect.selectOption(role);
    }

    // 送信ボタン
    const submitButton = this.inviteDialog.locator([
      'button[type="submit"]',
      'button:has-text("招待")',
      'button:has-text("送信")',
      '[data-testid="invite-submit"]'
    ].join(', '));

    await submitButton.click();
  }

  /**
   * ユーザー検索
   */
  async searchUser(searchTerm: string): Promise<void> {
    if (await this.searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.searchInput.fill(searchTerm);
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(1000); // 検索結果の待機
    }
  }

  /**
   * ユーザーのステータス変更
   */
  async changeUserStatus(userEmail: string, newStatus: 'active' | 'suspended'): Promise<void> {
    // ユーザー行を探す
    const userRow = this.page.locator('tr').filter({ hasText: userEmail });
    
    // ステータス変更ボタンを探す
    const statusButton = userRow.locator([
      '[data-testid="user-status-button"]',
      'button:has-text("変更")',
      'button:has-text("停止")',
      'button:has-text("有効")',
      '.status-toggle'
    ].join(', '));

    if (await statusButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statusButton.click();

      // 確認ダイアログがある場合は確認
      const confirmButton = this.page.locator([
        'button:has-text("確認")',
        'button:has-text("OK")',
        '[data-testid="confirm-button"]'
      ].join(', '));

      if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmButton.click();
      }
    }
  }
}

/**
 * 辞書管理ページのページオブジェクト
 */
export class AdminDictionaryPage extends BasePage {
  readonly dictionaryTable: Locator;
  readonly addButton: Locator;
  readonly searchInput: Locator;
  readonly dictionaryRows: Locator;
  readonly addDialog: Locator;

  constructor(page: Page) {
    super(page);

    this.dictionaryTable = this.page.locator([
      '[data-testid="dictionary-table"]',
      'table',
      '.dictionary-list'
    ].join(', '));

    this.addButton = this.page.locator([
      '[data-testid="add-dictionary-button"]',
      'button:has-text("追加")',
      'button:has-text("新規")',
      'button:has-text("作成")'
    ].join(', '));

    this.searchInput = this.page.locator([
      '[data-testid="dictionary-search"]',
      'input[placeholder*="検索"]',
      'input[type="search"]'
    ].join(', '));

    this.dictionaryRows = this.page.locator([
      '[data-testid="dictionary-row"]',
      'tbody tr',
      '.dictionary-row'
    ].join(', '));

    this.addDialog = this.page.locator([
      '[data-testid="add-dictionary-dialog"]',
      '[role="dialog"]',
      '.modal'
    ].join(', '));
  }

  /**
   * 辞書管理インターフェースの確認
   */
  async expectDictionaryInterface(): Promise<void> {
    await this.expectBasicStructure();
    
    const dictionaryElements = [
      this.dictionaryTable,
      this.addButton,
      this.page.locator('h1, h2').filter({ hasText: /辞書|Dictionary|管理/ })
    ];

    let visibleElements = 0;
    for (const element of dictionaryElements) {
      if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
        visibleElements++;
      }
    }

    expect(visibleElements).toBeGreaterThan(0);
  }

  /**
   * 新しい辞書エントリーの追加
   */
  async addDictionaryEntry(phrase: string, type: 'NG' | 'ALLOW', category?: string): Promise<void> {
    await this.addButton.click();
    await expect(this.addDialog).toBeVisible({ timeout: 5000 });

    // フレーズ入力
    const phraseInput = this.addDialog.locator([
      '[data-testid="dictionary-phrase"]',
      'input[name="phrase"]',
      'textarea[name="phrase"]'
    ].join(', '));
    
    await phraseInput.fill(phrase);

    // タイプ選択
    const typeSelect = this.addDialog.locator([
      '[data-testid="dictionary-type"]',
      'select[name="type"]',
      '[name="type"]'
    ].join(', '));

    if (await typeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await typeSelect.selectOption(type);
    }

    // カテゴリ入力（オプション）
    if (category) {
      const categoryInput = this.addDialog.locator([
        '[data-testid="dictionary-category"]',
        'input[name="category"]'
      ].join(', '));

      if (await categoryInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await categoryInput.fill(category);
      }
    }

    // 保存ボタン
    const saveButton = this.addDialog.locator([
      'button[type="submit"]',
      'button:has-text("保存")',
      'button:has-text("追加")',
      '[data-testid="save-dictionary"]'
    ].join(', '));

    await saveButton.click();
  }

  /**
   * 辞書エントリーの検索
   */
  async searchDictionary(searchTerm: string): Promise<void> {
    if (await this.searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.searchInput.fill(searchTerm);
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * 辞書エントリーの編集
   */
  async editDictionaryEntry(originalPhrase: string, newPhrase: string): Promise<void> {
    // エントリー行を探す
    const entryRow = this.page.locator('tr').filter({ hasText: originalPhrase });
    
    // 編集ボタンを探す
    const editButton = entryRow.locator([
      '[data-testid="edit-dictionary"]',
      'button:has-text("編集")',
      'button[title="編集"]',
      '.edit-button'
    ].join(', '));

    await editButton.click();

    // 編集ダイアログ
    const editDialog = this.page.locator([
      '[data-testid="edit-dictionary-dialog"]',
      '[role="dialog"]',
      '.modal'
    ].join(', '));

    await expect(editDialog).toBeVisible({ timeout: 5000 });

    // フレーズを更新
    const phraseInput = editDialog.locator([
      '[data-testid="dictionary-phrase"]',
      'input[name="phrase"]',
      'textarea[name="phrase"]'
    ].join(', '));

    await phraseInput.fill(newPhrase);

    // 保存
    const saveButton = editDialog.locator([
      'button[type="submit"]',
      'button:has-text("保存")',
      '[data-testid="save-dictionary"]'
    ].join(', '));

    await saveButton.click();
  }
}

/**
 * 組織設定ページのページオブジェクト
 */
export class AdminSettingsPage extends BasePage {
  readonly settingsForm: Locator;
  readonly organizationNameInput: Locator;
  readonly maxUsersInput: Locator;
  readonly maxChecksInput: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    super(page);

    this.settingsForm = this.page.locator([
      '[data-testid="settings-form"]',
      'form',
      '.settings-form'
    ].join(', '));

    this.organizationNameInput = this.page.locator([
      '[data-testid="organization-name"]',
      'input[name="organizationName"]',
      'input[name="name"]'
    ].join(', '));

    this.maxUsersInput = this.page.locator([
      '[data-testid="max-users"]',
      'input[name="maxUsers"]'
    ].join(', '));

    this.maxChecksInput = this.page.locator([
      '[data-testid="max-checks"]',
      'input[name="maxChecks"]'
    ].join(', '));

    this.saveButton = this.page.locator([
      'button[type="submit"]',
      'button:has-text("保存")',
      '[data-testid="save-settings"]'
    ].join(', '));
  }

  /**
   * 設定インターフェースの確認
   */
  async expectSettingsInterface(): Promise<void> {
    await this.expectBasicStructure();
    await expect(this.settingsForm).toBeVisible({ timeout: 10000 });
  }

  /**
   * 組織設定の更新
   */
  async updateOrganizationSettings(settings: {
    name?: string;
    maxUsers?: number;
    maxChecks?: number;
  }): Promise<void> {
    if (settings.name) {
      await this.organizationNameInput.fill(settings.name);
    }

    if (settings.maxUsers) {
      await this.maxUsersInput.fill(settings.maxUsers.toString());
    }

    if (settings.maxChecks) {
      await this.maxChecksInput.fill(settings.maxChecks.toString());
    }

    await this.saveButton.click();
  }
}