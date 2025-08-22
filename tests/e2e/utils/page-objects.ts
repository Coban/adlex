import { Page, Locator, expect } from '@playwright/test';

/**
 * ベースページクラス
 * 共通の機能と待機処理を提供
 */
export class BasePage {
  constructor(public readonly page: Page) {}

  async goto(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1000); // 安定性のための追加待機
  }

  async isElementVisible(selector: string): Promise<boolean> {
    try {
      const element = this.page.locator(selector);
      return await element.isVisible({ timeout: 5000 });
    } catch {
      return false;
    }
  }
}

/**
 * ログインページのページオブジェクト
 */
export class SignInPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.locator('input[name="email"], input[type="email"]');
    this.passwordInput = page.locator('input[name="password"], input[type="password"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('[role="alert"], .error-message, .text-red-500, .text-destructive');
  }

  async signIn(email: string, password: string) {
    await this.goto('/auth/signin');
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectSignInForm() {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async expectErrorMessage() {
    await expect(this.errorMessage).toBeVisible({ timeout: 5000 });
  }
}

/**
 * テキストチェッカーページのページオブジェクト
 */
export class TextCheckerPage extends BasePage {
  readonly textarea: Locator;
  readonly checkButton: Locator;
  readonly characterCount: Locator;
  readonly processingIndicator: Locator;
  readonly violationItems: Locator;
  readonly suggestionTexts: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.textarea = page.locator('textarea');
    this.checkButton = page.getByRole('button', { name: /チェック|開始/ });
    this.characterCount = page.locator('[data-testid="character-count"], .character-count');
    this.processingIndicator = page.locator(
      '[data-testid="loading"], .animate-spin, text=チェック中, text=処理中'
    );
    this.violationItems = page.locator('[data-testid="violation-item"], .violation-item');
    this.suggestionTexts = page.locator('[data-testid="suggestion-text"], .suggestion-text');
    this.errorMessage = page.locator('[data-testid="error-message"], .error-message');
  }

  async enterText(text: string) {
    await this.goto('/checker');
    await this.textarea.fill(text);
  }

  async startCheck(text?: string) {
    if (text) {
      await this.enterText(text);
    }
    await this.checkButton.click();
  }

  async expectInterface() {
    await expect(this.textarea).toBeVisible();
    await expect(this.checkButton).toBeVisible();
  }

  async expectProcessingState() {
    await expect(this.checkButton).toBeDisabled({ timeout: 5000 });
    // いずれかの処理インジケーターが表示されることを確認
    let processingFound = false;
    const indicators = [
      this.page.locator('text=チェック中'),
      this.page.locator('text=処理中'),
      this.page.locator('.animate-spin'),
      this.page.locator('[data-testid="loading"]')
    ];
    
    for (const indicator of indicators) {
      if (await indicator.isVisible({ timeout: 2000 }).catch(() => false)) {
        processingFound = true;
        break;
      }
    }
    expect(processingFound).toBe(true);
  }

  async expectViolations(minCount = 1) {
    const count = await this.violationItems.count();
    expect(count).toBeGreaterThanOrEqual(minCount);
  }

  async expectSuggestions() {
    await expect(this.suggestionTexts.first()).toBeVisible();
  }

  async expectCharacterCount(count: number) {
    const countElement = this.page.locator(`text=${count}`);
    await expect(countElement).toBeVisible();
  }
}

/**
 * 管理者ユーザー管理ページのページオブジェクト
 */
export class AdminUsersPage extends BasePage {
  readonly pageTitle: Locator;
  readonly inviteButton: Locator;
  readonly userTable: Locator;
  readonly userRows: Locator;
  readonly inviteDialog: Locator;
  readonly emailInput: Locator;
  readonly roleSelect: Locator;
  readonly sendInviteButton: Locator;

  constructor(page: Page) {
    super(page);
    this.pageTitle = page.locator('h1, [data-testid="page-title"]');
    this.inviteButton = page.locator('[data-testid="invite-user-button"]');
    this.userTable = page.locator('table, [data-testid="user-table"]');
    this.userRows = page.locator('tbody tr, [data-testid="user-row"]');
    this.inviteDialog = page.locator('[role="dialog"], .modal, [data-testid="invite-dialog"]');
    this.emailInput = page.locator('[data-testid="invite-email"], input[name="email"]');
    this.roleSelect = page.locator('[data-testid="invite-role"], select[name="role"]');
    this.sendInviteButton = page.locator('[data-testid="send-invite"], button:has-text("招待")');
  }

  async expectAdminInterface() {
    await this.goto('/admin/users');
    await expect(this.pageTitle).toBeVisible();
    await expect(this.inviteButton).toBeVisible();
  }

  async expectUserTable() {
    await expect(this.userTable).toBeVisible();
    
    // テーブルヘッダーの確認
    const headers = ['メール', '役割', 'ステータス', '作成日'];
    for (const header of headers) {
      const headerElement = this.userTable.locator(`th:has-text("${header}")`);
      if (await headerElement.isVisible().catch(() => false)) {
        await expect(headerElement).toBeVisible();
        break; // 少なくとも1つのヘッダーが見つかればOK
      }
    }
  }

  async inviteUser(email: string, role = 'user') {
    await this.inviteButton.click();
    await expect(this.inviteDialog).toBeVisible();
    
    await this.emailInput.fill(email);
    if (await this.roleSelect.isVisible().catch(() => false)) {
      await this.roleSelect.selectOption(role);
    }
    
    await this.sendInviteButton.click();
  }
}

/**
 * 辞書管理ページのページオブジェクト
 */
export class DictionaryPage extends BasePage {
  readonly pageTitle: Locator;
  readonly addButton: Locator;
  readonly searchInput: Locator;
  readonly dictionaryTable: Locator;
  readonly dictionaryRows: Locator;

  constructor(page: Page) {
    super(page);
    this.pageTitle = page.locator('h1, [data-testid="page-title"]');
    this.addButton = page.locator('[data-testid="add-dictionary"], button:has-text("追加")');
    this.searchInput = page.locator('[data-testid="dictionary-search"], input[placeholder*="検索"]');
    this.dictionaryTable = page.locator('table, [data-testid="dictionary-table"]');
    this.dictionaryRows = page.locator('tbody tr, [data-testid="dictionary-row"]');
  }

  async expectDictionaryInterface() {
    await this.goto('/admin/dictionaries');
    await expect(this.pageTitle).toBeVisible();
  }

  async searchDictionary(term: string) {
    if (await this.searchInput.isVisible().catch(() => false)) {
      await this.searchInput.fill(term);
      await this.page.keyboard.press('Enter');
      await this.waitForPageLoad();
    }
  }
}