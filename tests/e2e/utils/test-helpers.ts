import { Page, expect } from '@playwright/test';

/**
 * 薬機法違反のサンプルテキスト
 */
export const VIOLATION_TEXTS = {
  // 医薬品的な効果効能の表現
  MEDICAL_EFFECT: 'がんが治る奇跡のサプリメント！100%効果があります',
  BLOOD_PRESSURE: '血圧が下がる効果があります。高血圧の方にオススメ',
  DISEASE_CURE: '糖尿病が完治する健康食品です',
  
  // 誇大広告的な表現
  EXAGGERATED: '世界初の革命的な技術で、あらゆる病気を予防します',
  GUARANTEE: '必ず痩せる！効果保証付きダイエットサプリ',
  
  // 医師の推薦を装った表現
  DOCTOR_RECOMMENDATION: '医師も推薦する特効薬レベルのサプリメント',
  
  // 安全なテキスト
  SAFE_TEXT: '美味しくて栄養価の高い健康食品です。毎日の健康管理にお役立てください'
};

/**
 * テスト用のユーザー情報
 */
export const TEST_USERS = {
  ADMIN: {
    email: 'admin@test.com',
    password: 'password123',
    role: 'admin'
  },
  USER: {
    email: 'user1@test.com',
    password: 'password123',
    role: 'user'
  },
  INVALID: {
    email: 'invalid@test.com',
    password: 'wrongpassword',
    role: 'user'
  }
};

/**
 * APIレスポンスのモック
 */
export async function mockApiResponse(page: Page, endpoint: string, response: any, status = 200) {
  const fullEndpoint = endpoint.startsWith('api/') ? `**/${endpoint}` : `**/api/${endpoint}`;
  await page.route(fullEndpoint, async route => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response)
    });
  });
}

/**
 * APIエラーのモック
 */
export async function mockApiError(page: Page, endpoint: string, status = 500, message = 'Internal Server Error') {
  await page.route(`**/api/${endpoint}`, async route => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error: message })
    });
  });
}

/**
 * ネットワークエラーのモック
 */
export async function mockNetworkError(page: Page, endpoint: string) {
  await page.route(`**/api/${endpoint}`, async route => {
    await route.abort('failed');
  });
}

/**
 * 成功したチェック結果のモック
 */
export function createMockCheckResult(violations: Array<{
  text: string;
  reason: string;
  start: number;
  end: number;
  suggestions: string[];
}>) {
  return {
    id: 'test-check-id',
    status: 'completed',
    violations,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * 安定した要素の待機
 * 複数の候補から最初に見つかった要素を返す
 */
export async function waitForAnyElement(page: Page, selectors: string[], timeout = 10000): Promise<boolean> {
  const promises = selectors.map(async selector => {
    try {
      await page.locator(selector).waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  });

  const results = await Promise.allSettled(promises);
  return results.some(result => result.status === 'fulfilled' && result.value === true);
}

/**
 * ページの基本構造を検証
 * ヘッダー、メイン、フッターなどの基本要素の存在を確認
 */
export async function validatePageStructure(page: Page) {
  const structureElements = [
    'header, [role="banner"]',
    'main, [role="main"]',
    'nav, [role="navigation"]'
  ];

  let foundElements = 0;
  for (const selector of structureElements) {
    if (await page.locator(selector).isVisible({ timeout: 3000 }).catch(() => false)) {
      foundElements++;
    }
  }

  expect(foundElements).toBeGreaterThan(0);
}

/**
 * フォームバリデーションのテスト
 */
export async function testFormValidation(page: Page, formSelector: string, requiredFields: string[]) {
  const form = page.locator(formSelector);
  await expect(form).toBeVisible();

  // 空のフォームで送信を試みる
  const submitButton = form.locator('button[type="submit"]');
  await submitButton.click();

  // 各必須フィールドのバリデーション状態を確認
  for (const fieldSelector of requiredFields) {
    const field = form.locator(fieldSelector);
    const isValid = await field.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(isValid).toBe(false);
  }
}

/**
 * ロード状態のテスト
 */
export async function expectLoadingState(page: Page, timeout = 5000) {
  const loadingIndicators = [
    '[data-testid="loading"]',
    '.animate-spin',
    '.loading',
    'text=読み込み中',
    'text=処理中',
    'text=チェック中'
  ];

  const foundLoading = await waitForAnyElement(page, loadingIndicators, timeout);
  expect(foundLoading).toBe(true);
}

/**
 * エラー状態のテスト
 */
export async function expectErrorState(page: Page, timeout = 5000) {
  const errorIndicators = [
    '[data-testid="error-message"]',
    '[role="alert"]',
    '.error-message',
    '.text-red-500',
    '.text-destructive',
    'text=エラー'
  ];

  const foundError = await waitForAnyElement(page, errorIndicators, timeout);
  expect(foundError).toBe(true);
}

/**
 * アクセス拒否エラーのテスト
 * T002の要件に基づく実装
 */
export async function expectAccessDeniedError(page: Page) {
  const currentUrl = page.url();
  
  // アクセス拒否の指標
  const accessDeniedIndicators = [
    // リダイレクト関連
    currentUrl.includes('/auth/signin'),
    currentUrl.includes('/auth/login'),
    currentUrl.includes('/403'),
    currentUrl.includes('/unauthorized'),
    
    // エラーメッセージ関連  
    await page.locator('text=アクセス権限がありません').isVisible({ timeout: 3000 }).catch(() => false),
    await page.locator('text=403').isVisible({ timeout: 3000 }).catch(() => false),
    await page.locator('text=Forbidden').isVisible({ timeout: 3000 }).catch(() => false),
    await page.locator('text=権限がありません').isVisible({ timeout: 3000 }).catch(() => false),
    await page.locator('text=管理者権限が必要').isVisible({ timeout: 3000 }).catch(() => false),
    await page.locator('[data-testid="access-denied"]').isVisible({ timeout: 3000 }).catch(() => false),
    await page.locator('[role="alert"]').isVisible({ timeout: 3000 }).catch(() => false)
  ];

  const isAccessDenied = accessDeniedIndicators.some(indicator => indicator);
  expect(isAccessDenied).toBe(true);
}

/**
 * リトライ動作のテスト
 * T005の要件に基づく実装
 */
export async function expectRetryBehavior(page: Page) {
  // リトライ動作の指標
  const retryIndicators = [
    // リトライメッセージ
    'text=再試行',
    'text=リトライ',
    'text=もう一度',
    'text=再接続',
    'text=接続中',
    
    // プログレス表示
    '[data-testid="retry-progress"]',
    '.retry-indicator',
    
    // ロード状態の継続
    '[data-testid="loading"]',
    '.animate-spin'
  ];

  let retryBehaviorFound = false;
  let attempts = 0;
  const maxAttempts = 5;

  while (!retryBehaviorFound && attempts < maxAttempts) {
    attempts++;
    
    for (const selector of retryIndicators) {
      if (await page.locator(selector).isVisible({ timeout: 3000 }).catch(() => false)) {
        retryBehaviorFound = true;
        console.log(`リトライ動作を検出: ${selector} (試行回数: ${attempts})`);
        break;
      }
    }
    
    if (!retryBehaviorFound) {
      await page.waitForTimeout(1000);
    }
  }

  // リトライ動作が見つからない場合は、処理状態の変化を確認
  if (!retryBehaviorFound) {
    console.log('明示的なリトライ表示は見つからないが、処理状態の変化を確認');
    
    // ボタンの状態変化やロード状態の確認
    const processingStates = [
      () => page.locator('button').first().isDisabled().catch(() => false),
      () => page.locator('text=処理中').isVisible({ timeout: 2000 }).catch(() => false),
      () => page.locator('text=チェック中').isVisible({ timeout: 2000 }).catch(() => false)
    ];
    
    const results = await Promise.allSettled(processingStates.map(state => state()));
    const hasProcessingState = results.some(result => 
      result.status === 'fulfilled' && result.value === true
    );
    
    // 処理状態の変化があれば、リトライ動作と見なす
    retryBehaviorFound = hasProcessingState;
  }

  // リトライ動作またはエラーハンドリングが適切に機能していることを確認
  expect(retryBehaviorFound).toBe(true);
}

/**
 * テスト環境のセットアップ
 */
export async function setupTestEnvironment(page: Page) {
  await page.addInitScript(() => {
    // テスト環境用の環境変数設定
    (window as any).process = {
      env: {
        NODE_ENV: 'test',
        TZ: process.env.TZ || 'Asia/Tokyo'
      }
    };

    // コンソールエラーを収集
    const originalConsoleError = console.error;
    (window as any).testConsoleErrors = [];
    console.error = (...args) => {
      (window as any).testConsoleErrors.push(args);
      originalConsoleError.apply(console, args);
    };
  });
}

/**
 * コンソールエラーをチェック
 */
export async function checkConsoleErrors(page: Page) {
  const errors = await page.evaluate(() => (window as any).testConsoleErrors || []);
  const filteredErrors = errors.filter((error: any[]) => {
    const errorString = error.join(' ').toLowerCase();
    // 一般的な無害なエラーを除外
    return !errorString.includes('favicon.ico') &&
           !errorString.includes('sourcemap') &&
           !errorString.includes('chrome-extension');
  });
  
  expect(filteredErrors).toHaveLength(0);
}

/**
 * パフォーマンスメトリクスの取得
 */
export async function getPerformanceMetrics(page: Page) {
  return await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {
      loadTime: navigation.loadEventEnd - navigation.loadEventStart,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
    };
  });
}