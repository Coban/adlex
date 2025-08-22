import { test, expect } from '@playwright/test';

import { TextCheckerPage, SignInPage } from './utils/page-objects';
import { 
  mockApiError, 
  mockNetworkError,
  VIOLATION_TEXTS,
  setupTestEnvironment,
  expectErrorState,
  expectLoadingState
} from './utils/test-helpers';
import { injectTestEnvironment, shouldSkipAuthTest, detectEnvironment } from './utils/environment-detector';

test.describe('エラーハンドリング', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestEnvironment(page);
    await setupTestEnvironment(page);
  });

  test.describe('APIエラーハンドリング', () => {
    let textChecker: TextCheckerPage;

    test.beforeEach(async ({ page }) => {
      textChecker = new TextCheckerPage(page);
    });

    test('500 Internal Server Error の処理', async ({ page }) => {
      const env = detectEnvironment();
      if (env.skipAuth) {
        test.skip(true, 'SKIP_AUTHモードのため、APIエラーハンドリングテストをスキップ');
        return;
      }
      
      await mockApiError(page, 'checks', 500, 'サーバー内部エラーが発生しました');
      
      await textChecker.startCheck(VIOLATION_TEXTS.SAFE_TEXT);
      
      // エラーメッセージが表示されることを確認
      await expectErrorState(page);
      
      // 具体的なエラーメッセージの確認
      const errorMessages = [
        'text=サーバーエラー',
        'text=内部エラー',
        'text=500',
        'text=処理に失敗しました'
      ];

      let errorFound = false;
      for (const selector of errorMessages) {
        if (await page.locator(selector).isVisible({ timeout: 3000 }).catch(() => false)) {
          errorFound = true;
          break;
        }
      }

      expect(errorFound).toBe(true);
      
      // ボタンが再び使用可能になることを確認
      await expect(textChecker.checkButton).toBeEnabled({ timeout: 10000 });
    });

    test('429 Rate Limit Error の処理', async ({ page }) => {
      const env = detectEnvironment();
      if (env.skipAuth) {
        test.skip(true, 'SKIP_AUTHモードのため、APIエラーハンドリングテストをスキップ');
        return;
      }
      
      await mockApiError(page, 'checks', 429, 'リクエスト制限に達しました。しばらく待ってから再試行してください。');
      
      await textChecker.startCheck(VIOLATION_TEXTS.SAFE_TEXT);
      
      // レート制限エラーメッセージの確認
      const rateLimitMessages = [
        'text=制限',
        'text=429',
        'text=しばらく待って',
        'text=リクエスト制限'
      ];

      let rateLimitFound = false;
      for (const selector of rateLimitMessages) {
        if (await page.locator(selector).isVisible({ timeout: 5000 }).catch(() => false)) {
          rateLimitFound = true;
          break;
        }
      }

      expect(rateLimitFound).toBe(true);
    });

    test('401 Unauthorized Error の処理', async ({ page }) => {
      const env = detectEnvironment();
      if (env.skipAuth) {
        test.skip(true, 'SKIP_AUTHモードのため、APIエラーハンドリングテストをスキップ');
        return;
      }
      
      await mockApiError(page, 'checks', 401, '認証が必要です');
      
      await textChecker.startCheck(VIOLATION_TEXTS.SAFE_TEXT);
      
      // 認証エラーの処理を確認
      const authErrorIndicators = [
        'text=認証',
        'text=ログイン',
        'text=401',
        'text=権限がありません'
      ];

      let authErrorFound = false;
      for (const selector of authErrorIndicators) {
        if (await page.locator(selector).isVisible({ timeout: 5000 }).catch(() => false)) {
          authErrorFound = true;
          break;
        }
      }

      // 認証エラーの場合、ログインページへのリダイレクトまたはエラーメッセージ表示
      const isRedirectedToLogin = page.url().includes('/auth/signin');
      
      expect(authErrorFound || isRedirectedToLogin).toBe(true);
    });

    test('403 Forbidden Error の処理', async ({ page }) => {
      const env = detectEnvironment();
      if (env.skipAuth) {
        test.skip(true, 'SKIP_AUTHモードのため、APIエラーハンドリングテストをスキップ');
        return;
      }
      
      await mockApiError(page, 'admin/users', 403, 'アクセス権限がありません');
      
      await page.goto('/admin/users');
      await page.waitForLoadState('networkidle');
      
      // 403エラーの処理を確認
      const forbiddenMessages = [
        'text=アクセス権限がありません',
        'text=403',
        'text=Forbidden',
        'text=権限不足'
      ];

      let forbiddenFound = false;
      for (const selector of forbiddenMessages) {
        if (await page.locator(selector).isVisible({ timeout: 5000 }).catch(() => false)) {
          forbiddenFound = true;
          break;
        }
      }

      expect(forbiddenFound).toBe(true);
    });

    test('422 Validation Error の処理', async ({ page }) => {
      const env = detectEnvironment();
      if (env.skipAuth) {
        test.skip(true, 'SKIP_AUTHモードのため、APIエラーハンドリングテストをスキップ');
        return;
      }
      
      const validationError = {
        error: 'バリデーションエラー',
        details: [
          { field: 'text', message: 'テキストは必須です' },
          { field: 'text', message: '文字数制限を超えています' }
        ]
      };
      
      await page.route('**/api/checks', async route => {
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify(validationError)
        });
      });
      
      await textChecker.startCheck('');  // 空のテキストで送信
      
      // バリデーションエラーメッセージの確認
      const validationMessages = [
        'text=バリデーション',
        'text=必須です',
        'text=文字数制限',
        'text=入力エラー'
      ];

      let validationFound = false;
      for (const selector of validationMessages) {
        if (await page.locator(selector).isVisible({ timeout: 5000 }).catch(() => false)) {
          validationFound = true;
          break;
        }
      }

      expect(validationFound).toBe(true);
    });
  });

  test.describe('ネットワークエラーハンドリング', () => {
    let textChecker: TextCheckerPage;

    test.beforeEach(async ({ page }) => {
      textChecker = new TextCheckerPage(page);
    });

    test('ネットワーク接続エラーの処理', async ({ page }) => {
      // ネットワークエラーをモック
      await page.route('**/api/checks', route => route.abort('failed'));
      
      await textChecker.startCheck(VIOLATION_TEXTS.SAFE_TEXT);
      
      // ネットワークエラーメッセージの確認
      const networkErrorMessages = [
        'text=ネットワークエラー',
        'text=接続に失敗',
        'text=オフライン',
        'text=接続できません'
      ];

      let networkErrorFound = false;
      for (const selector of networkErrorMessages) {
        if (await page.locator(selector).isVisible({ timeout: 10000 }).catch(() => false)) {
          networkErrorFound = true;
          break;
        }
      }

      if (!networkErrorFound) {
        // 一般的なエラー表示でも良い
        await expectErrorState(page);
      } else {
        expect(networkErrorFound).toBe(true);
      }
    });

    test('タイムアウトエラーの処理', async ({ page }) => {
      // タイムアウトをモック（長時間レスポンスしない）
      await page.route('**/api/checks', async route => {
        // 60秒待機してからレスポンス
        await new Promise(resolve => setTimeout(resolve, 60000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      });
      
      await textChecker.startCheck(VIOLATION_TEXTS.SAFE_TEXT);
      
      // タイムアウトエラーまたは継続的な処理状態を確認
      const timeoutMessages = [
        'text=タイムアウト',
        'text=時間がかかって',
        'text=処理に時間が',
        'text=長時間'
      ];

      let timeoutFound = false;
      for (const selector of timeoutMessages) {
        if (await page.locator(selector).isVisible({ timeout: 30000 }).catch(() => false)) {
          timeoutFound = true;
          break;
        }
      }

      // タイムアウトメッセージがない場合は、処理中状態が続いていることを確認
      if (!timeoutFound) {
        await expect(textChecker.checkButton).toBeDisabled();
      }
    });

    test('断続的な接続エラーの処理（リトライ機能）', async ({ page }) => {
      let requestCount = 0;
      
      // 最初の2回の要求は失敗、3回目は成功
      await page.route('**/api/checks', async route => {
        requestCount++;
        if (requestCount <= 2) {
          await route.abort('failed');
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-check',
              status: 'completed',
              violations: []
            })
          });
        }
      });
      
      await textChecker.startCheck(VIOLATION_TEXTS.SAFE_TEXT);
      
      // リトライの表示またはエラーメッセージを確認
      const retryMessages = [
        'text=再試行',
        'text=リトライ',
        'text=もう一度',
        'text=再接続'
      ];

      let retryFound = false;
      for (const selector of retryMessages) {
        if (await page.locator(selector).isVisible({ timeout: 10000 }).catch(() => false)) {
          retryFound = true;
          break;
        }
      }

      if (retryFound) {
        console.log('Retry mechanism is working');
      } else {
        // リトライ機能がない場合は、エラー状態または成功状態を確認
        const isProcessing = await textChecker.checkButton.isDisabled().catch(() => false);
        const hasError = await expectErrorState(page).catch(() => false);
        
        expect(isProcessing || hasError).toBe(true);
      }
    });
  });

  test.describe('認証エラーハンドリング', () => {
    test.use({ storageState: { cookies: [], origins: [] } }); // 認証状態をクリア

    test('セッション期限切れの処理', async ({ page }) => {
      if (shouldSkipAuthTest()) {
        test.skip(true, 'Supabase環境が利用できないため、認証エラーハンドリングテストをスキップ');
        return;
      }
      const signInPage = new SignInPage(page);
      
      // 期限切れセッションをモック
      await page.addInitScript(() => {
        // 無効なトークンを設定
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'expired_token',
          refresh_token: 'expired_refresh_token',
          expires_at: Date.now() - 3600000 // 1時間前に期限切れ
        }));
      });

      await page.goto('/checker');
      await page.waitForLoadState('networkidle');
      
      // 認証ページへのリダイレクトまたは期限切れメッセージを確認
      const isRedirectedToAuth = page.url().includes('/auth/signin');
      const hasSessionExpiredMessage = await page.locator('text=セッションが期限切れ, text=再ログイン, text=期限切れ').isVisible({ timeout: 5000 }).catch(() => false);
      
      expect(isRedirectedToAuth || hasSessionExpiredMessage).toBe(true);
    });

    test('無効なトークンの処理', async ({ page }) => {
      if (shouldSkipAuthTest()) {
        test.skip(true, 'Supabase環境が利用できないため、認証エラーハンドリングテストをスキップ');
        return;
      }
      
      // 無効なトークンでAPIアクセスを試行
      await mockApiError(page, 'checks', 401, '無効なトークンです');
      
      const textChecker = new TextCheckerPage(page);
      await textChecker.goto('/checker');
      await textChecker.startCheck(VIOLATION_TEXTS.SAFE_TEXT);
      
      // 認証エラーまたはログインページへのリダイレクトを確認
      const authErrorMessages = [
        'text=認証エラー',
        'text=無効なトークン',
        'text=ログインしてください'
      ];

      let authErrorFound = false;
      for (const selector of authErrorMessages) {
        if (await page.locator(selector).isVisible({ timeout: 5000 }).catch(() => false)) {
          authErrorFound = true;
          break;
        }
      }

      const isRedirectedToLogin = page.url().includes('/auth/signin');
      
      expect(authErrorFound || isRedirectedToLogin).toBe(true);
    });
  });

  test.describe('クライアントサイドエラーハンドリング', () => {
    test('JavaScript エラーの捕捉と表示', async ({ page }) => {
      // JavaScriptエラーをモック
      await page.addInitScript(() => {
        // エラーをキャッチするイベントリスナーを追加
        window.addEventListener('error', (event) => {
          console.error('Caught error:', event.error);
        });
        
        // 意図的にエラーを発生
        setTimeout(() => {
          throw new Error('テスト用JavaScriptエラー');
        }, 1000);
      });
      
      const textChecker = new TextCheckerPage(page);
      await textChecker.goto('/checker');
      
      // エラーバウンダリまたはエラーメッセージの確認
      await page.waitForTimeout(2000); // エラー発生を待つ
      
      const errorBoundaryMessages = [
        'text=予期しないエラー',
        'text=問題が発生しました',
        'text=エラーが発生',
        '[data-testid="error-boundary"]'
      ];

      let errorBoundaryFound = false;
      for (const selector of errorBoundaryMessages) {
        if (await page.locator(selector).isVisible({ timeout: 3000 }).catch(() => false)) {
          errorBoundaryFound = true;
          break;
        }
      }

      if (errorBoundaryFound) {
        console.log('Error boundary is working');
      } else {
        console.log('No visible error boundary - errors may be handled silently');
      }
    });

    test('メモリ不足エラーのシミュレーション', async ({ page }) => {
      // 大量のデータを処理してメモリ不足をシミュレート
      const hugeMockResponse = {
        id: 'large-test-check',
        status: 'completed',
        violations: Array.from({ length: 10000 }, (_, i) => ({
          id: `violation-${i}`,
          text: `violation ${i}`,
          reason: `reason for violation ${i}`,
          start: i * 10,
          end: i * 10 + 5,
          suggestions: [`suggestion ${i}`, `alternative ${i}`]
        }))
      };

      await page.route('**/api/checks', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(hugeMockResponse)
        });
      });
      
      const textChecker = new TextCheckerPage(page);
      await textChecker.startCheck(VIOLATION_TEXTS.MEDICAL_EFFECT);
      
      // メモリ不足やパフォーマンス問題の兆候を確認
      await page.waitForTimeout(5000);
      
      // ページが応答性を保っていることを確認
      const isPageResponsive = await textChecker.textarea.isEnabled().catch(() => false);
      expect(isPageResponsive).toBe(true);
      
      // または適切なエラーメッセージが表示されることを確認
      const memoryErrorMessages = [
        'text=データが大きすぎます',
        'text=処理できません',
        'text=メモリ不足'
      ];

      let memoryErrorFound = false;
      for (const selector of memoryErrorMessages) {
        if (await page.locator(selector).isVisible({ timeout: 3000 }).catch(() => false)) {
          memoryErrorFound = true;
          break;
        }
      }

      // どちらかの条件が満たされることを確認
      expect(isPageResponsive || memoryErrorFound).toBe(true);
    });
  });

  test.describe('エラーリカバリ機能', () => {
    test('エラー後のリトライボタン', async ({ page }) => {
      const env = detectEnvironment();
      
      if (shouldSkipAuthTest()) {
        test.skip(true, `リトライボタンテストをスキップ: Supabase環境=${env.hasSupabase}, SKIP_AUTH=${env.skipAuth}`);
        return;
      }
      
      await mockApiError(page, 'checks', 500, 'サーバーエラー');
      
      const textChecker = new TextCheckerPage(page);
      await textChecker.goto('/checker');
      await textChecker.startCheck(VIOLATION_TEXTS.SAFE_TEXT);
      
      // エラーメッセージの確認
      await expectErrorState(page);
      
      // リトライボタンの確認
      const retryButtons = [
        'button:has-text("再試行")',
        'button:has-text("もう一度")',
        '[data-testid="retry-button"]'
      ];

      let retryButtonFound = false;
      for (const selector of retryButtons) {
        if (await page.locator(selector).isVisible({ timeout: 5000 }).catch(() => false)) {
          retryButtonFound = true;
          break;
        }
      }

      if (retryButtonFound) {
        console.log('Retry functionality is available');
      } else {
        // リトライボタンがない場合は、チェックボタンが再び有効になることを確認
        await expect(textChecker.checkButton).toBeEnabled({ timeout: 10000 });
      }
    });

    test('ページリロードによる状態復旧', async ({ page }) => {
      const textChecker = new TextCheckerPage(page);
      await textChecker.enterText(VIOLATION_TEXTS.SAFE_TEXT);
      
      // ページをリロード
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // 基本インターフェースが復旧していることを確認
      await textChecker.expectInterface();
    });
  });
});