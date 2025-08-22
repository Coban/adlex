import { Page, expect } from '@playwright/test';

/**
 * 認証エラーの種類
 * T003の要件に基づく実装
 */
export type AuthErrorType = 'unauthorized' | 'forbidden' | 'expired' | 'invalid_token';

/**
 * 認証エラータイプ別の期待される動作
 */
interface AuthErrorExpectation {
  redirectUrl?: string;
  errorMessage?: string;
  statusCode?: number;
  action?: 'redirect' | 'show_message' | 'logout' | 'token_refresh';
}

/**
 * 認証エラータイプ別の設定
 */
const AUTH_ERROR_CONFIGS: Record<AuthErrorType, AuthErrorExpectation> = {
  unauthorized: {
    redirectUrl: '/auth/signin',
    errorMessage: '認証が必要です',
    statusCode: 401,
    action: 'redirect'
  },
  forbidden: {
    errorMessage: 'アクセス権限がありません',
    statusCode: 403,
    action: 'show_message'
  },
  expired: {
    redirectUrl: '/auth/signin',
    errorMessage: 'セッションが期限切れです',
    statusCode: 401,
    action: 'logout'
  },
  invalid_token: {
    redirectUrl: '/auth/signin',
    errorMessage: '認証情報が無効です',
    statusCode: 401,
    action: 'token_refresh'
  }
};

/**
 * 認証エラータイプ別の検証を行う
 */
export async function expectAuthenticationError(
  page: Page, 
  expectedErrorType: AuthErrorType,
  timeout = 10000
): Promise<void> {
  const config = AUTH_ERROR_CONFIGS[expectedErrorType];
  const currentUrl = page.url();

  console.log(`認証エラー検証開始: ${expectedErrorType}`);
  console.log(`現在のURL: ${currentUrl}`);

  switch (expectedErrorType) {
    case 'unauthorized':
      await expectUnauthorizedError(page, config, timeout);
      break;
    case 'forbidden':
      await expectForbiddenError(page, config, timeout);
      break;
    case 'expired':
      await expectExpiredSessionError(page, config, timeout);
      break;
    case 'invalid_token':
      await expectInvalidTokenError(page, config, timeout);
      break;
  }
}

/**
 * 401 Unauthorized エラーの検証
 * ログインページリダイレクト確認
 */
async function expectUnauthorizedError(
  page: Page, 
  config: AuthErrorExpectation, 
  timeout: number
): Promise<void> {
  // リダイレクトまたはエラーメッセージの確認
  const indicators = [
    // URLリダイレクトの確認
    () => page.url().includes('/auth/signin'),
    () => page.url().includes('/auth/login'),
    
    // エラーメッセージの確認
    () => page.locator('text=認証が必要').isVisible({ timeout: 3000 }).catch(() => false),
    () => page.locator('text=ログインしてください').isVisible({ timeout: 3000 }).catch(() => false),
    () => page.locator('text=Unauthorized').isVisible({ timeout: 3000 }).catch(() => false),
    () => page.locator('[data-testid="unauthorized-error"]').isVisible({ timeout: 3000 }).catch(() => false),
    
    // ログインフォームの表示確認
    () => page.locator('#email, input[type="email"]').isVisible({ timeout: 3000 }).catch(() => false),
    () => page.locator('#password, input[type="password"]').isVisible({ timeout: 3000 }).catch(() => false)
  ];

  const results = await Promise.allSettled(indicators.map(indicator => indicator()));
  const hasValidIndicator = results.some(result => 
    result.status === 'fulfilled' && result.value === true
  );

  expect(hasValidIndicator).toBe(true);
}

/**
 * 403 Forbidden エラーの検証
 * アクセス拒否メッセージ表示確認
 */
async function expectForbiddenError(
  page: Page, 
  config: AuthErrorExpectation, 
  timeout: number
): Promise<void> {
  const forbiddenIndicators = [
    // エラーメッセージの確認
    page.locator('text=アクセス権限がありません').isVisible({ timeout }),
    page.locator('text=403').isVisible({ timeout }),
    page.locator('text=Forbidden').isVisible({ timeout }),
    page.locator('text=権限がありません').isVisible({ timeout }),
    page.locator('text=管理者権限が必要').isVisible({ timeout }),
    page.locator('[data-testid="forbidden-error"]').isVisible({ timeout }),
    page.locator('[data-testid="access-denied"]').isVisible({ timeout }),
    page.locator('[role="alert"]').isVisible({ timeout }).then(visible => {
      if (visible) {
        return page.locator('[role="alert"]').textContent().then(text => 
          text?.includes('権限') || text?.includes('403') || text?.includes('Forbidden')
        );
      }
      return false;
    })
  ];

  const results = await Promise.allSettled(forbiddenIndicators);
  const hasForbiddenIndicator = results.some(result => 
    result.status === 'fulfilled' && result.value === true
  );

  expect(hasForbiddenIndicator).toBe(true);
}

/**
 * セッション期限切れエラーの検証
 * 再ログイン促進メッセージ確認
 */
async function expectExpiredSessionError(
  page: Page, 
  config: AuthErrorExpectation, 
  timeout: number
): Promise<void> {
  const expiredIndicators = [
    // リダイレクトの確認
    () => page.url().includes('/auth/signin'),
    () => page.url().includes('/auth/login'),
    
    // 期限切れメッセージの確認
    () => page.locator('text=セッションが期限切れ').isVisible({ timeout: 3000 }).catch(() => false),
    () => page.locator('text=再度ログイン').isVisible({ timeout: 3000 }).catch(() => false),
    () => page.locator('text=ログインし直してください').isVisible({ timeout: 3000 }).catch(() => false),
    () => page.locator('text=Session expired').isVisible({ timeout: 3000 }).catch(() => false),
    () => page.locator('[data-testid="session-expired"]').isVisible({ timeout: 3000 }).catch(() => false),
    
    // 自動ログアウト確認（ローカルストレージのクリア）
    () => page.evaluate(() => {
      const authKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('supabase.auth.token') || key.startsWith('sb-')
      );
      return authKeys.length === 0; // トークンがクリアされている
    })
  ];

  const results = await Promise.allSettled(expiredIndicators.map(indicator => indicator()));
  const hasExpiredIndicator = results.some(result => 
    result.status === 'fulfilled' && result.value === true
  );

  expect(hasExpiredIndicator).toBe(true);
}

/**
 * 無効トークンエラーの検証
 * トークン更新またはログアウト確認
 */
async function expectInvalidTokenError(
  page: Page, 
  config: AuthErrorExpectation, 
  timeout: number
): Promise<void> {
  const invalidTokenIndicators = [
    // リダイレクトの確認
    () => page.url().includes('/auth/signin'),
    () => page.url().includes('/auth/login'),
    
    // 無効トークンメッセージの確認
    () => page.locator('text=認証情報が無効').isVisible({ timeout: 3000 }).catch(() => false),
    () => page.locator('text=Invalid token').isVisible({ timeout: 3000 }).catch(() => false),
    () => page.locator('text=トークンが無効').isVisible({ timeout: 3000 }).catch(() => false),
    () => page.locator('[data-testid="invalid-token"]').isVisible({ timeout: 3000 }).catch(() => false),
    
    // トークンリフレッシュの試行確認
    () => page.evaluate(() => {
      // リフレッシュトークンの使用確認
      const authData = localStorage.getItem('supabase.auth.token');
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          return !!parsed.refresh_token; // リフレッシュトークンが存在
        } catch {
          return false;
        }
      }
      return false;
    })
  ];

  const results = await Promise.allSettled(invalidTokenIndicators.map(indicator => indicator()));
  const hasInvalidTokenIndicator = results.some(result => 
    result.status === 'fulfilled' && result.value === true
  );

  expect(hasInvalidTokenIndicator).toBe(true);
}

/**
 * テスト用の認証エラー状態をセットアップ
 */
export async function setupAuthErrorState(
  page: Page, 
  errorType: AuthErrorType
): Promise<void> {
  switch (errorType) {
    case 'expired':
      // 期限切れトークンを設定
      await page.addInitScript(() => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'expired_token',
          expires_at: Date.now() / 1000 - 3600, // 1時間前に期限切れ
          user: { id: 'test-user', role: 'user' }
        }));
      });
      break;

    case 'invalid_token':
      // 無効なトークンを設定
      await page.addInitScript(() => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'invalid_malformed_token',
          expires_at: Date.now() / 1000 + 3600, // まだ有効だが形式が無効
          user: { id: 'test-user', role: 'user' }
        }));
      });
      break;

    case 'unauthorized':
      // 認証情報なしの状態
      await page.addInitScript(() => {
        // 全ての認証関連のデータをクリア
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('supabase.auth') || key.startsWith('sb-')) {
            localStorage.removeItem(key);
          }
        });
      });
      break;

    case 'forbidden':
      // 認証されているが権限不足の状態
      await page.addInitScript(() => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'valid_token_insufficient_permissions',
          expires_at: Date.now() / 1000 + 3600,
          user: { id: 'test-user', role: 'user' } // 一般ユーザー権限
        }));
      });
      break;
  }
}

/**
 * 認証エラーのデバッグ情報を出力
 */
export async function debugAuthError(page: Page, errorType: AuthErrorType): Promise<void> {
  console.log(`=== 認証エラーデバッグ (${errorType}) ===`);
  console.log('現在のURL:', page.url());
  
  const authData = await page.evaluate(() => {
    const authKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('supabase.auth') || key.startsWith('sb-')
    );
    return authKeys.map(key => ({
      key,
      value: localStorage.getItem(key)
    }));
  });
  
  console.log('認証データ:', authData);
  
  const visibleElements = await page.evaluate(() => {
    const selectors = [
      'text=エラー', 'text=権限', 'text=Unauthorized', 'text=Forbidden',
      '[role="alert"]', '[data-testid*="error"]'
    ];
    
    return selectors.map(selector => ({
      selector,
      visible: document.querySelector(selector) !== null
    }));
  });
  
  console.log('表示された要素:', visibleElements.filter(el => el.visible));
  console.log('=============================');
}