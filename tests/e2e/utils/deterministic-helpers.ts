import { Page, expect, Locator } from '@playwright/test';

/**
 * 決定論的な要素待機システム
 * タイムアウトベースではなく、DOM状態の確実な変化を検知
 */

/**
 * 要素の確実な出現を待機（アニメーション完了まで）
 */
export async function waitForElementStable(
  page: Page, 
  selector: string, 
  options: { 
    timeout?: number;
    stabilityThreshold?: number; // 位置が安定する時間（ms）
  } = {}
): Promise<Locator> {
  const { timeout = 30000, stabilityThreshold = 1000 } = options;
  
  const element = page.locator(selector);
  
  // 要素の存在を確認
  await element.waitFor({ state: 'visible', timeout });
  
  // 要素の位置とサイズの安定化を待機
  let lastBoundingBox = await element.boundingBox();
  let stableStartTime = Date.now();
  
  while (Date.now() - stableStartTime < stabilityThreshold) {
    await page.waitForTimeout(50);
    const currentBoundingBox = await element.boundingBox();
    
    if (!lastBoundingBox || !currentBoundingBox) {
      stableStartTime = Date.now();
      continue;
    }
    
    // 位置またはサイズが変化した場合、安定化タイマーをリセット
    if (
      Math.abs(lastBoundingBox.x - currentBoundingBox.x) > 1 ||
      Math.abs(lastBoundingBox.y - currentBoundingBox.y) > 1 ||
      Math.abs(lastBoundingBox.width - currentBoundingBox.width) > 1 ||
      Math.abs(lastBoundingBox.height - currentBoundingBox.height) > 1
    ) {
      stableStartTime = Date.now();
    }
    
    lastBoundingBox = currentBoundingBox;
  }
  
  return element;
}

/**
 * API呼び出し完了の確実な待機
 * ネットワーク活動とDOM変更の両方を監視
 */
export async function waitForApiCallComplete(
  page: Page, 
  apiPath: string,
  options: { 
    timeout?: number;
    expectResponse?: boolean;
  } = {}
): Promise<void> {
  const { timeout = 30000, expectResponse = true } = options;
  
  let apiResponseReceived = false;
  
  // API呼び出しの監視
  const responsePromise = page.waitForResponse(response => {
    const url = response.url();
    const isTargetApi = url.includes(apiPath);
    if (isTargetApi) {
      apiResponseReceived = true;
    }
    return isTargetApi;
  }, { timeout });
  
  if (expectResponse) {
    await responsePromise;
  }
  
  // 追加の安定化待機（DOM更新完了まで）
  await page.waitForLoadState('networkidle', { timeout: 5000 });
  
  // JavaScriptの実行完了を確認
  await page.waitForFunction(
    () => {
      // React/Vue等のフレームワークの更新完了を確認
      return new Promise(resolve => {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => resolve(true));
        } else {
          setTimeout(() => resolve(true), 0);
        }
      });
    },
    undefined,
    { timeout: 5000 }
  );
}

/**
 * フォーム送信の完全処理待機
 */
export async function waitForFormSubmission(
  page: Page,
  formSelector: string,
  submitSelector: string,
  options: { 
    timeout?: number;
    expectedUrl?: string;
    expectedSelector?: string;
  } = {}
): Promise<void> {
  const { timeout = 30000, expectedUrl, expectedSelector } = options;
  
  const form = await waitForElementStable(page, formSelector);
  const submitButton = await waitForElementStable(page, submitSelector);
  
  // 送信前の状態を記録
  const initialUrl = page.url();
  
  // フォーム送信実行
  await submitButton.click();
  
  // 処理完了の確認
  if (expectedUrl) {
    await page.waitForURL(expectedUrl, { timeout });
  } else if (expectedSelector) {
    await waitForElementStable(page, expectedSelector, { timeout });
  } else {
    // デフォルト: ネットワーク活動の完了を待機
    await page.waitForLoadState('networkidle', { timeout });
  }
}

/**
 * エラー状態の確実な検証
 * 複数の指標を組み合わせて確実にエラー状態を検知
 */
export async function assertErrorState(
  page: Page,
  options: {
    timeout?: number;
    errorSelectors?: string[];
    errorTexts?: string[];
  } = {}
): Promise<void> {
  const { 
    timeout = 10000,
    errorSelectors = [
      '[data-testid="error-message"]',
      '[role="alert"]',
      '.error-message',
      '.text-red-500',
      '.text-destructive'
    ],
    errorTexts = ['エラー', 'Error', 'Failed', '失敗']
  } = options;
  
  let errorFound = false;
  const endTime = Date.now() + timeout;
  
  while (Date.now() < endTime && !errorFound) {
    // セレクタベースの検証
    for (const selector of errorSelectors) {
      try {
        const element = page.locator(selector);
        if (await element.isVisible({ timeout: 100 })) {
          errorFound = true;
          console.log(`エラー状態検出: セレクタ ${selector}`);
          break;
        }
      } catch (e) {
        // 要素が見つからない場合は継続
      }
    }
    
    // テキストベースの検証
    if (!errorFound) {
      for (const text of errorTexts) {
        try {
          const element = page.locator(`text=${text}`);
          if (await element.isVisible({ timeout: 100 })) {
            errorFound = true;
            console.log(`エラー状態検出: テキスト "${text}"`);
            break;
          }
        } catch (e) {
          // 要素が見つからない場合は継続
        }
      }
    }
    
    if (!errorFound) {
      await page.waitForTimeout(100);
    }
  }
  
  expect(errorFound).toBe(true);
}

/**
 * 成功状態の確実な検証
 */
export async function assertSuccessState(
  page: Page,
  options: {
    timeout?: number;
    successSelectors?: string[];
    successTexts?: string[];
  } = {}
): Promise<void> {
  const { 
    timeout = 10000,
    successSelectors = [
      '[data-testid="success-message"]',
      '.success-message',
      '.text-green-500',
      '.text-success'
    ],
    successTexts = ['成功', 'Success', '完了', 'Completed']
  } = options;
  
  let successFound = false;
  const endTime = Date.now() + timeout;
  
  while (Date.now() < endTime && !successFound) {
    // セレクタベースの検証
    for (const selector of successSelectors) {
      try {
        const element = page.locator(selector);
        if (await element.isVisible({ timeout: 100 })) {
          successFound = true;
          console.log(`成功状態検出: セレクタ ${selector}`);
          break;
        }
      } catch (e) {
        // 要素が見つからない場合は継続
      }
    }
    
    // テキストベースの検証
    if (!successFound) {
      for (const text of successTexts) {
        try {
          const element = page.locator(`text=${text}`);
          if (await element.isVisible({ timeout: 100 })) {
            successFound = true;
            console.log(`成功状態検出: テキスト "${text}"`);
            break;
          }
        } catch (e) {
          // 要素が見つからない場合は継続
        }
      }
    }
    
    if (!successFound) {
      await page.waitForTimeout(100);
    }
  }
  
  expect(successFound).toBe(true);
}

/**
 * ページの完全初期化待機
 * すべてのリソース、スクリプト、スタイルの読み込み完了を確実に待機
 */
export async function waitForPageFullyLoaded(
  page: Page,
  options: { 
    timeout?: number;
    checkSelectors?: string[];
  } = {}
): Promise<void> {
  const { timeout = 30000, checkSelectors = ['body'] } = options;
  
  // 基本的な読み込み完了を待機
  await page.waitForLoadState('networkidle', { timeout });
  await page.waitForLoadState('domcontentloaded', { timeout });
  
  // 重要な要素の出現を確認
  for (const selector of checkSelectors) {
    await waitForElementStable(page, selector, { timeout });
  }
  
  // JavaScript実行完了の確認
  await page.waitForFunction(() => {
    return document.readyState === 'complete' && 
           typeof window.requestIdleCallback !== 'undefined' ? 
           new Promise(resolve => window.requestIdleCallback(() => resolve(true))) :
           Promise.resolve(true);
  }, undefined, { timeout });
}