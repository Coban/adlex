import { Page, expect } from '@playwright/test';

/**
 * T006: エラー状態確認メソッドの標準化
 * 詳細なエラータイプ別検証機能
 */

export type ErrorType = 
  | 'network' 
  | 'server' 
  | 'validation' 
  | 'auth' 
  | 'permission' 
  | 'timeout' 
  | 'rate_limit' 
  | 'generic';

export interface ErrorStateOptions {
  timeout?: number;
  expectMessage?: string;
  allowPartialMatch?: boolean;
}

/**
 * エラータイプ別の詳細検証
 */
export class ErrorStateVerifier {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * ネットワークエラーの検証
   */
  async expectNetworkError(options: ErrorStateOptions = {}): Promise<void> {
    const { timeout = 5000, expectMessage, allowPartialMatch = true } = options;

    const networkErrorIndicators = [
      'text=ネットワークエラー',
      'text=接続に失敗',
      'text=オフライン',
      'text=接続できません',
      'text=ネットワークに接続',
      'text=インターネット接続',
      '[data-testid="network-error"]',
      '[data-testid="connection-error"]'
    ];

    if (expectMessage) {
      if (allowPartialMatch) {
        await expect(this.page.locator(`text*=${expectMessage}`)).toBeVisible({ timeout });
      } else {
        await expect(this.page.locator(`text=${expectMessage}`)).toBeVisible({ timeout });
      }
    } else {
      await this.expectAnyError(networkErrorIndicators, timeout);
    }
  }

  /**
   * サーバーエラーの検証
   */
  async expectServerError(options: ErrorStateOptions = {}): Promise<void> {
    const { timeout = 5000, expectMessage, allowPartialMatch = true } = options;

    const serverErrorIndicators = [
      'text=サーバーエラー',
      'text=内部エラー',
      'text=500',
      'text=502',
      'text=503',
      'text=504',
      'text=処理に失敗しました',
      'text=一時的なエラー',
      '[data-testid="server-error"]',
      '[data-testid="internal-error"]'
    ];

    if (expectMessage) {
      if (allowPartialMatch) {
        await expect(this.page.locator(`text*=${expectMessage}`)).toBeVisible({ timeout });
      } else {
        await expect(this.page.locator(`text=${expectMessage}`)).toBeVisible({ timeout });
      }
    } else {
      await this.expectAnyError(serverErrorIndicators, timeout);
    }
  }

  /**
   * バリデーションエラーの検証
   */
  async expectValidationError(options: ErrorStateOptions = {}): Promise<void> {
    const { timeout = 5000, expectMessage, allowPartialMatch = true } = options;

    const validationErrorIndicators = [
      'text=バリデーションエラー',
      'text=入力エラー',
      'text=必須です',
      'text=形式が正しくありません',
      'text=文字数制限',
      'text=無効な値',
      '[data-testid="validation-error"]',
      '[data-testid="input-error"]',
      '.error-message',
      '.field-error'
    ];

    if (expectMessage) {
      if (allowPartialMatch) {
        await expect(this.page.locator(`text*=${expectMessage}`)).toBeVisible({ timeout });
      } else {
        await expect(this.page.locator(`text=${expectMessage}`)).toBeVisible({ timeout });
      }
    } else {
      await this.expectAnyError(validationErrorIndicators, timeout);
    }
  }

  /**
   * 認証エラーの検証
   */
  async expectAuthError(options: ErrorStateOptions = {}): Promise<void> {
    const { timeout = 5000, expectMessage, allowPartialMatch = true } = options;

    const authErrorIndicators = [
      'text=認証エラー',
      'text=ログインが必要',
      'text=認証に失敗',
      'text=セッションが期限切れ',
      'text=再ログイン',
      'text=401',
      'text=Unauthorized',
      '[data-testid="auth-error"]',
      '[data-testid="session-expired"]'
    ];

    // リダイレクトもチェック
    const currentUrl = this.page.url();
    const isRedirectedToAuth = currentUrl.includes('/auth/signin') || currentUrl.includes('/auth/login');

    if (expectMessage) {
      if (allowPartialMatch) {
        await expect(this.page.locator(`text*=${expectMessage}`)).toBeVisible({ timeout });
      } else {
        await expect(this.page.locator(`text=${expectMessage}`)).toBeVisible({ timeout });
      }
    } else {
      if (!isRedirectedToAuth) {
        await this.expectAnyError(authErrorIndicators, timeout);
      }
    }

    // リダイレクトまたはエラーメッセージのいずれかが表示されていることを確認
    if (!expectMessage) {
      const hasErrorMessage = await this.hasAnyError(authErrorIndicators, 1000);
      expect(isRedirectedToAuth || hasErrorMessage).toBe(true);
    }
  }

  /**
   * 権限エラーの検証
   */
  async expectPermissionError(options: ErrorStateOptions = {}): Promise<void> {
    const { timeout = 5000, expectMessage, allowPartialMatch = true } = options;

    const permissionErrorIndicators = [
      'text=アクセス権限がありません',
      'text=権限がありません',
      'text=管理者権限が必要',
      'text=403',
      'text=Forbidden',
      'text=アクセス拒否',
      '[data-testid="permission-error"]',
      '[data-testid="access-denied"]'
    ];

    if (expectMessage) {
      if (allowPartialMatch) {
        await expect(this.page.locator(`text*=${expectMessage}`)).toBeVisible({ timeout });
      } else {
        await expect(this.page.locator(`text=${expectMessage}`)).toBeVisible({ timeout });
      }
    } else {
      await this.expectAnyError(permissionErrorIndicators, timeout);
    }
  }

  /**
   * タイムアウトエラーの検証
   */
  async expectTimeoutError(options: ErrorStateOptions = {}): Promise<void> {
    const { timeout = 5000, expectMessage, allowPartialMatch = true } = options;

    const timeoutErrorIndicators = [
      'text=タイムアウト',
      'text=時間がかかっています',
      'text=処理に時間が',
      'text=長時間',
      'text=応答がありません',
      '[data-testid="timeout-error"]',
      '[data-testid="processing-timeout"]'
    ];

    if (expectMessage) {
      if (allowPartialMatch) {
        await expect(this.page.locator(`text*=${expectMessage}`)).toBeVisible({ timeout });
      } else {
        await expect(this.page.locator(`text=${expectMessage}`)).toBeVisible({ timeout });
      }
    } else {
      await this.expectAnyError(timeoutErrorIndicators, timeout);
    }
  }

  /**
   * レート制限エラーの検証
   */
  async expectRateLimitError(options: ErrorStateOptions = {}): Promise<void> {
    const { timeout = 5000, expectMessage, allowPartialMatch = true } = options;

    const rateLimitErrorIndicators = [
      'text=リクエスト制限',
      'text=制限に達しました',
      'text=しばらく待って',
      'text=429',
      'text=Too Many Requests',
      'text=利用制限',
      '[data-testid="rate-limit-error"]',
      '[data-testid="usage-limit"]'
    ];

    if (expectMessage) {
      if (allowPartialMatch) {
        await expect(this.page.locator(`text*=${expectMessage}`)).toBeVisible({ timeout });
      } else {
        await expect(this.page.locator(`text=${expectMessage}`)).toBeVisible({ timeout });
      }
    } else {
      await this.expectAnyError(rateLimitErrorIndicators, timeout);
    }
  }

  /**
   * 一般的なエラーの検証
   */
  async expectGenericError(options: ErrorStateOptions = {}): Promise<void> {
    const { timeout = 5000, expectMessage, allowPartialMatch = true } = options;

    const genericErrorIndicators = [
      'text=エラー',
      'text=失敗',
      'text=問題が発生',
      'text=予期しないエラー',
      '[data-testid="error-message"]',
      '[role="alert"]',
      '.error',
      '.error-message',
      '.text-red-500',
      '.text-destructive'
    ];

    if (expectMessage) {
      if (allowPartialMatch) {
        await expect(this.page.locator(`text*=${expectMessage}`)).toBeVisible({ timeout });
      } else {
        await expect(this.page.locator(`text=${expectMessage}`)).toBeVisible({ timeout });
      }
    } else {
      await this.expectAnyError(genericErrorIndicators, timeout);
    }
  }

  /**
   * エラータイプに基づく統一検証メソッド
   */
  async expectErrorByType(errorType: ErrorType, options: ErrorStateOptions = {}): Promise<void> {
    switch (errorType) {
      case 'network':
        await this.expectNetworkError(options);
        break;
      case 'server':
        await this.expectServerError(options);
        break;
      case 'validation':
        await this.expectValidationError(options);
        break;
      case 'auth':
        await this.expectAuthError(options);
        break;
      case 'permission':
        await this.expectPermissionError(options);
        break;
      case 'timeout':
        await this.expectTimeoutError(options);
        break;
      case 'rate_limit':
        await this.expectRateLimitError(options);
        break;
      case 'generic':
      default:
        await this.expectGenericError(options);
        break;
    }
  }

  /**
   * エラー状態からの復旧確認
   */
  async expectErrorRecovery(): Promise<void> {
    // リトライボタンの確認
    const retryButtons = [
      'button:has-text("再試行")',
      'button:has-text("もう一度")',
      'button:has-text("リトライ")',
      '[data-testid="retry-button"]'
    ];

    let retryButtonFound = false;
    for (const selector of retryButtons) {
      if (await this.page.locator(selector).isVisible({ timeout: 3000 }).catch(() => false)) {
        retryButtonFound = true;
        break;
      }
    }

    if (retryButtonFound) {
      console.log('Retry functionality is available');
    } else {
      // リトライボタンがない場合は、UI要素が再び使用可能になることを確認
      const interactiveElements = this.page.locator('button, input, select').first();
      await expect(interactiveElements).toBeEnabled({ timeout: 10000 });
    }
  }

  /**
   * プライベートヘルパーメソッド: いずれかのエラーインジケータが表示されることを確認
   */
  private async expectAnyError(indicators: string[], timeout: number): Promise<void> {
    let errorFound = false;
    for (const selector of indicators) {
      if (await this.page.locator(selector).isVisible({ timeout: 1000 }).catch(() => false)) {
        errorFound = true;
        break;
      }
    }
    expect(errorFound).toBe(true);
  }

  /**
   * プライベートヘルパーメソッド: いずれかのエラーインジケータが表示されているかチェック
   */
  private async hasAnyError(indicators: string[], timeout: number): Promise<boolean> {
    for (const selector of indicators) {
      if (await this.page.locator(selector).isVisible({ timeout }).catch(() => false)) {
        return true;
      }
    }
    return false;
  }
}

/**
 * 便利な関数として利用できるように関数もエクスポート
 */
export async function expectErrorByType(
  page: Page, 
  errorType: ErrorType, 
  options: ErrorStateOptions = {}
): Promise<void> {
  const verifier = new ErrorStateVerifier(page);
  await verifier.expectErrorByType(errorType, options);
}

export async function expectErrorRecovery(page: Page): Promise<void> {
  const verifier = new ErrorStateVerifier(page);
  await verifier.expectErrorRecovery();
}