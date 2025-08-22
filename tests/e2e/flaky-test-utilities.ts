import { Page, expect } from '@playwright/test';

/**
 * フレイキーテスト対策のユーティリティ関数集
 * 
 * これらの関数は以下の戦略でテストの安定性を向上させます：
 * 1. リトライメカニズム
 * 2. 複数のセレクタによるフォールバック
 * 3. 適切な待機戦略
 * 4. エラーハンドリングとグレースフルフォールバック
 */

export interface RetryOptions {
  maxRetries: number;
  retryDelay: number;
  timeout: number;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 10000
};

/**
 * 複数のセレクタを試してエレメントを見つける
 */
export async function findElementWithFallback(
  page: Page,
  selectors: string[],
  options: Partial<RetryOptions> = {}
): Promise<{ element: any; selector: string } | null> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  
  for (let retry = 0; retry < opts.maxRetries; retry++) {
    for (const selector of selectors) {
      try {
        const element = page.locator(selector);
        const count = await element.count();
        
        if (count > 0) {
          const isVisible = await element.first().isVisible({ timeout: opts.timeout / selectors.length });
          if (isVisible) {
            return { element: element.first(), selector };
          }
        }
      } catch (error) {
        console.log(`Selector ${selector} failed on retry ${retry + 1}:`, (error as Error).message);
      }
    }
    
    if (retry < opts.maxRetries - 1) {
      await page.waitForTimeout(opts.retryDelay * (retry + 1));
    }
  }
  
  return null;
}

/**
 * 安定したクリック操作
 */
export async function stableClick(
  page: Page,
  selectors: string[],
  options: Partial<RetryOptions> = {}
): Promise<boolean> {
  const result = await findElementWithFallback(page, selectors, options);
  
  if (!result) {
    return false;
  }
  
  try {
    await result.element.click();
    return true;
  } catch (error) {
    console.log(`Click failed with selector ${result.selector}:`, (error as Error).message);
    return false;
  }
}

/**
 * 安定したフォーム入力
 */
export async function stableFill(
  page: Page,
  selectors: string[],
  value: string,
  options: Partial<RetryOptions> = {}
): Promise<boolean> {
  const result = await findElementWithFallback(page, selectors, options);
  
  if (!result) {
    return false;
  }
  
  try {
    await result.element.clear();
    await result.element.fill(value);
    return true;
  } catch (error) {
    console.log(`Fill failed with selector ${result.selector}:`, (error as Error).message);
    return false;
  }
}

/**
 * 安定した表示確認
 */
export async function stableExpectVisible(
  page: Page,
  selectors: string[],
  options: Partial<RetryOptions> = {}
): Promise<boolean> {
  const result = await findElementWithFallback(page, selectors, options);
  
  if (!result) {
    return false;
  }
  
  try {
    await expect(result.element).toBeVisible({ timeout: options.timeout || DEFAULT_RETRY_OPTIONS.timeout });
    return true;
  } catch (error) {
    console.log(`Visibility check failed with selector ${result.selector}:`, (error as Error).message);
    return false;
  }
}

/**
 * ページ状態の待機（ネットワーク、ロード状態など）
 */
export async function waitForPageStable(page: Page, options: {
  networkIdle?: boolean;
  domContentLoaded?: boolean;
  additionalWait?: number;
} = {}): Promise<void> {
  const { networkIdle = true, domContentLoaded = true, additionalWait = 1000 } = options;
  
  const waitUntilConditions: Array<'load' | 'domcontentloaded' | 'networkidle'> = [];
  
  if (domContentLoaded) {
    waitUntilConditions.push('domcontentloaded');
  }
  
  if (networkIdle) {
    waitUntilConditions.push('networkidle');
  }
  
  if (waitUntilConditions.length === 0) {
    waitUntilConditions.push('load');
  }
  
  try {
    await page.waitForLoadState(waitUntilConditions[waitUntilConditions.length - 1]);
    
    if (additionalWait > 0) {
      await page.waitForTimeout(additionalWait);
    }
  } catch (error) {
    console.log('Page stability wait failed:', (error as Error).message);
  }
}

/**
 * 認証状態の安定した確認
 */
export async function checkAuthenticationStatusStable(
  page: Page,
  expectedAuthenticated: boolean
): Promise<boolean> {
  const signOutSelectors = [
    'button:has-text("サインアウト")',
    '[data-testid="signout-button"]',
    '.signout-btn'
  ];
  
  const signInSelectors = [
    'a:has-text("サインイン")',
    'a[href="/auth/signin"]',
    '[data-testid="signin-link"]',
    'button:has-text("サインイン")'
  ];
  
  // デスクトップでの確認
  const signOutResult = await findElementWithFallback(page, signOutSelectors, { maxRetries: 2, retryDelay: 500, timeout: 3000 });
  const signInResult = await findElementWithFallback(page, signInSelectors, { maxRetries: 2, retryDelay: 500, timeout: 3000 });
  
  // モバイルメニューの確認
  const mobileMenuButton = page.locator('.md\\:hidden button, [data-testid="mobile-menu"]');
  const isMobileMenuVisible = await mobileMenuButton.count() > 0 && await mobileMenuButton.first().isVisible();
  
  if (isMobileMenuVisible) {
    try {
      await mobileMenuButton.first().click();
      await page.waitForTimeout(500);
      
      const mobileSignOutResult = await findElementWithFallback(page, signOutSelectors, { maxRetries: 1, retryDelay: 200, timeout: 2000 });
      
      // メニューを閉じる
      if (await mobileMenuButton.first().isVisible()) {
        await mobileMenuButton.first().click();
      }
      
      if (mobileSignOutResult && expectedAuthenticated) {
        return true;
      }
    } catch (error) {
      console.log('Mobile menu check failed:', (error as Error).message);
    }
  }
  
  // 結果の評価
  const hasSignOut = !!signOutResult;
  const hasSignIn = !!signInResult;
  
  if (expectedAuthenticated) {
    return hasSignOut && !hasSignIn;
  } else {
    return !hasSignOut && hasSignIn;
  }
}

/**
 * フォームの安定した送信
 */
export async function stableFormSubmit(
  page: Page,
  formData: { [key: string]: string },
  options: {
    formSelectors?: string[];
    submitSelectors?: string[];
    retryOptions?: Partial<RetryOptions>;
  } = {}
): Promise<boolean> {
  const {
    formSelectors = ['form', '[data-testid="form"]'],
    submitSelectors = ['button[type="submit"]', '[data-testid="submit-button"]', 'button:has-text("送信")'],
    retryOptions = {}
  } = options;
  
  // フォームの存在確認
  const formResult = await findElementWithFallback(page, formSelectors, retryOptions);
  if (!formResult) {
    console.log('Form not found');
    return false;
  }
  
  // フォームデータの入力
  for (const [fieldName, value] of Object.entries(formData)) {
    const fieldSelectors = [
      `input[name="${fieldName}"]`,
      `input[id="${fieldName}"]`,
      `[data-testid="${fieldName}-input"]`,
      `textarea[name="${fieldName}"]`,
      `select[name="${fieldName}"]`
    ];
    
    const fieldFilled = await stableFill(page, fieldSelectors, value, retryOptions);
    if (!fieldFilled) {
      console.log(`Failed to fill field: ${fieldName}`);
      return false;
    }
  }
  
  // フォーム送信
  const submitClicked = await stableClick(page, submitSelectors, retryOptions);
  if (!submitClicked) {
    console.log('Failed to click submit button');
    return false;
  }
  
  return true;
}

/**
 * 結果メッセージの安定した確認
 */
export async function waitForResultMessage(
  page: Page,
  messageType: 'success' | 'error' | 'info',
  options: {
    customSelectors?: string[];
    timeout?: number;
    retryOptions?: Partial<RetryOptions>;
  } = {}
): Promise<{ found: boolean; message?: string }> {
  const { timeout = 10000, retryOptions = {} } = options;
  
  let selectors = options.customSelectors || [];
  
  if (selectors.length === 0) {
    switch (messageType) {
      case 'success':
        selectors = [
          '[data-testid="success-message"]',
          '.success-message',
          '.alert-success',
          '.toast-success',
          'text=成功',
          'text=完了',
          'text=しました'
        ];
        break;
      case 'error':
        selectors = [
          '[data-testid="error-message"]',
          '.error-message',
          '.alert-error',
          '.toast-error',
          '.text-red-600',
          'text=エラー',
          'text=失敗'
        ];
        break;
      case 'info':
        selectors = [
          '[data-testid="info-message"]',
          '.info-message',
          '.alert-info',
          '.toast-info'
        ];
        break;
    }
  }
  
  const result = await findElementWithFallback(page, selectors, { ...retryOptions, timeout });
  
  if (result) {
    try {
      const messageText = await result.element.textContent();
      return { found: true, message: messageText || undefined };
    } catch {
      return { found: true };
    }
  }
  
  return { found: false };
}

/**
 * ダウンロード操作の安定した処理
 */
export async function stableDownload(
  page: Page,
  triggerSelectors: string[],
  options: {
    retryOptions?: Partial<RetryOptions>;
    expectedFilename?: RegExp;
    timeout?: number;
  } = {}
): Promise<{ success: boolean; download?: any }> {
  const { timeout = 30000 } = options;
  
  // ダウンロード待機を設定
  const downloadPromise = page.waitForEvent('download', { timeout });
  
  // トリガーボタンをクリック
  const clicked = await stableClick(page, triggerSelectors, options.retryOptions);
  
  if (!clicked) {
    return { success: false };
  }
  
  try {
    const download = await downloadPromise;
    
    // ファイル名の確認
    if (options.expectedFilename) {
      const filename = download.suggestedFilename();
      if (!options.expectedFilename.test(filename)) {
        console.log(`Unexpected filename: ${filename}`);
        return { success: false, download };
      }
    }
    
    // ダウンロードの成功確認
    const failure = await download.failure();
    if (failure) {
      console.log(`Download failed: ${failure}`);
      return { success: false, download };
    }
    
    return { success: true, download };
  } catch (error) {
    console.log('Download failed:', (error as Error).message);
    return { success: false };
  }
}

/**
 * モーダルダイアログの安定した処理
 */
export async function handleModalDialog(
  page: Page,
  action: 'open' | 'close' | 'confirm' | 'cancel',
  options: {
    triggerSelectors?: string[];
    modalSelectors?: string[];
    actionSelectors?: string[];
    retryOptions?: Partial<RetryOptions>;
  } = {}
): Promise<boolean> {
  const {
    triggerSelectors = [],
    modalSelectors = ['[role="dialog"]', '.modal', '[data-testid="modal"]'],
    actionSelectors = [],
    retryOptions = {}
  } = options;
  
  switch (action) {
    case 'open':
      if (triggerSelectors.length === 0) {
        console.log('No trigger selectors provided for modal open');
        return false;
      }
      
      const opened = await stableClick(page, triggerSelectors, retryOptions);
      if (!opened) {
        return false;
      }
      
      // モーダルの表示確認
      const modalVisible = await stableExpectVisible(page, modalSelectors, retryOptions);
      return modalVisible;
      
    case 'close':
    case 'cancel':
      const closeSelectors = actionSelectors.length > 0 ? actionSelectors : [
        '[data-testid="close-button"]',
        '[data-testid="cancel-button"]',
        'button:has-text("閉じる")',
        'button:has-text("キャンセル")',
        '.modal-close'
      ];
      
      const closed = await stableClick(page, closeSelectors, retryOptions);
      if (closed) {
        // モーダルが閉じることを確認
        await page.waitForTimeout(500);
        const modalResult = await findElementWithFallback(page, modalSelectors, { maxRetries: 1, retryDelay: 200, timeout: 2000 });
        return !modalResult;
      }
      return false;
      
    case 'confirm':
      const confirmSelectors = actionSelectors.length > 0 ? actionSelectors : [
        '[data-testid="confirm-button"]',
        'button:has-text("確認")',
        'button:has-text("はい")',
        'button:has-text("実行")',
        'button[type="submit"]'
      ];
      
      return await stableClick(page, confirmSelectors, retryOptions);
      
    default:
      console.log(`Unknown modal action: ${action}`);
      return false;
  }
}

/**
 * テーブルまたはリストアイテムの安定した操作
 */
export async function stableListOperation(
  page: Page,
  operation: 'count' | 'click' | 'getText',
  options: {
    listSelectors?: string[];
    itemSelectors?: string[];
    itemIndex?: number;
    retryOptions?: Partial<RetryOptions>;
  } = {}
): Promise<any> {
  const {
    listSelectors = ['[data-testid="list"]', '.list', 'table', 'ul'],
    itemSelectors = ['[data-testid="list-item"]', '[data-testid="item"]', 'tr', 'li'],
    itemIndex = 0,
    retryOptions = {}
  } = options;
  
  // リストの存在確認
  const listResult = await findElementWithFallback(page, listSelectors, retryOptions);
  if (!listResult) {
    console.log('List not found');
    return null;
  }
  
  // アイテムの取得
  const items = page.locator(itemSelectors.join(', '));
  
  switch (operation) {
    case 'count':
      try {
        return await items.count();
      } catch {
        return 0;
      }
      
    case 'click':
      try {
        const item = items.nth(itemIndex);
        if (await item.count() > 0) {
          await item.click();
          return true;
        }
        return false;
      } catch {
        return false;
      }
      
    case 'getText':
      try {
        const item = items.nth(itemIndex);
        if (await item.count() > 0) {
          return await item.textContent();
        }
        return null;
      } catch {
        return null;
      }
      
    default:
      console.log(`Unknown list operation: ${operation}`);
      return null;
  }
}