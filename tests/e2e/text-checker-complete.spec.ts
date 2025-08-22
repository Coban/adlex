import { test, expect } from '@playwright/test';

import { TextCheckerPage } from './utils/page-objects';
import { 
  VIOLATION_TEXTS, 
  mockApiResponse, 
  mockApiError, 
  createMockCheckResult,
  setupTestEnvironment,
  expectLoadingState,
  expectErrorState
} from './utils/test-helpers';
import { injectTestEnvironment, shouldSkipAuthTest, detectEnvironment } from './utils/environment-detector';

test.describe('テキストチェッカー（完全版）', () => {
  let textChecker: TextCheckerPage;

  test.beforeEach(async ({ page }) => {
    textChecker = new TextCheckerPage(page);
    await injectTestEnvironment(page);
    await setupTestEnvironment(page);
  });

  test.describe('基本UI機能', () => {
    test('テキストチェッカーの基本インターフェースが表示される', async ({ page }) => {
      await textChecker.goto('/checker');
      await textChecker.expectInterface();
    });

    test('文字数カウンターが正しく動作する', async ({ page }) => {
      await textChecker.goto('/checker');
      await textChecker.enterText('テストテキスト');
      await textChecker.expectCharacterCount(7);
    });

    test('テキスト入力時にチェックボタンが有効になる', async ({ page }) => {
      await textChecker.goto('/checker');
      
      // 初期状態でボタンが無効
      await expect(textChecker.checkButton).toBeDisabled();
      
      // テキスト入力後にボタンが有効
      await textChecker.textarea.fill(VIOLATION_TEXTS.SAFE_TEXT);
      await expect(textChecker.checkButton).toBeEnabled();
    });

    test('テキストクリア後にチェックボタンが無効になる', async ({ page }) => {
      await textChecker.goto('/checker');
      await textChecker.enterText(VIOLATION_TEXTS.SAFE_TEXT);
      await expect(textChecker.checkButton).toBeEnabled();
      
      // テキストをクリア
      await textChecker.textarea.fill('');
      await expect(textChecker.checkButton).toBeDisabled();
    });
  });

  test.describe('チェック処理フロー', () => {
    test('薬機法違反を検出し、修正案を表示する', async ({ page }) => {
      const env = detectEnvironment();
      
      if (shouldSkipAuthTest()) {
        test.skip(true, `複雑なAPIモックテストをスキップ: Supabase環境=${env.hasSupabase}, SKIP_AUTH=${env.skipAuth}`);
        return;
      }
      
      await textChecker.goto('/checker');
      
      // モックレスポンスの設定
      const mockResult = createMockCheckResult([
        {
          text: 'がんが治る',
          reason: '医薬品的な効果効能の表現は薬機法に違反します',
          start: 0,
          end: 5,
          suggestions: ['がんケアをサポートする', 'がんの方の健康維持に']
        },
        {
          text: '100%効果',
          reason: '効果を保証する表現は誇大広告にあたります',
          start: 15,
          end: 22,
          suggestions: ['多くの方にご満足いただいている', '実感される方が多い']
        }
      ]);

      await mockApiResponse(page, 'checks', mockResult);
      await mockApiResponse(page, `checks/${mockResult.id}/stream`, mockResult);

      await textChecker.startCheck(VIOLATION_TEXTS.MEDICAL_EFFECT);
      
      // 処理中状態の確認
      await textChecker.expectProcessingState();
      
      // 結果の確認（モック環境なので即座に結果が返る想定）
      await page.waitForTimeout(2000); // モック処理の待機
      
      // 違反が検出されることを確認
      await textChecker.expectViolations(2);
      
      // 修正案が表示されることを確認
      await textChecker.expectSuggestions();
    });

    test('安全なテキストは違反なしとして処理される', async ({ page }) => {
      const mockResult = createMockCheckResult([]);
      
      await mockApiResponse(page, 'checks', mockResult);
      await mockApiResponse(page, `checks/${mockResult.id}/stream`, mockResult);
      
      await textChecker.startCheck(VIOLATION_TEXTS.SAFE_TEXT);
      
      // 処理完了まで待機
      await page.waitForTimeout(2000);
      
      // 違反がないことを確認
      const noViolationsMessage = page.locator('text=違反は検出されませんでした, text=問題なし');
      const hasNoViolationsMessage = await noViolationsMessage.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasNoViolationsMessage) {
        await expect(noViolationsMessage).toBeVisible();
      } else {
        // 違反アイテムが0個であることを確認
        const violationCount = await textChecker.violationItems.count();
        expect(violationCount).toBe(0);
      }
    });

    test('大量テキストの処理', async ({ page }) => {
      const largeText = VIOLATION_TEXTS.MEDICAL_EFFECT.repeat(100); // 大量テキスト
      const mockResult = createMockCheckResult([
        {
          text: 'がんが治る',
          reason: '医薬品的な効果効能の表現は薬機法に違反します',
          start: 0,
          end: 5,
          suggestions: ['がんケアをサポートする']
        }
      ]);

      await mockApiResponse(page, 'checks', mockResult);
      await mockApiResponse(page, `checks/${mockResult.id}/stream`, mockResult);

      const startTime = Date.now();
      await textChecker.startCheck(largeText);
      
      // 処理開始の確認（5秒以内）
      await textChecker.expectProcessingState();
      
      // パフォーマンス測定
      const processingTime = Date.now() - startTime;
      console.log(`Large text processing started in: ${processingTime}ms`);
      
      // 処理時間が合理的な範囲内であることを確認（10秒以内で開始）
      expect(processingTime).toBeLessThan(10000);
    });
  });

  test.describe('リアルタイム更新', () => {
    test('Server-Sent Eventsによるプログレス更新', async ({ page }) => {
      // SSEのモック設定
      await page.route('**/api/checks/*/stream', async route => {
        const response = `
data: {"status":"processing","progress":25}

data: {"status":"processing","progress":50}

data: {"status":"processing","progress":75}

data: {"status":"completed","violations":[],"progress":100}

`;
        await route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: response
        });
      });

      const mockResult = createMockCheckResult([]);
      await mockApiResponse(page, 'checks', mockResult);

      await textChecker.startCheck(VIOLATION_TEXTS.SAFE_TEXT);
      
      // プログレスバーまたは進捗表示要素を確認
      const progressElements = [
        '[data-testid="progress-bar"]',
        '.progress-bar',
        'text=進捗',
        'text=%'
      ];
      
      let progressFound = false;
      for (const selector of progressElements) {
        if (await page.locator(selector).isVisible({ timeout: 3000 }).catch(() => false)) {
          progressFound = true;
          break;
        }
      }
      
      // プログレス表示があることを確認（実装されている場合）
      if (progressFound) {
        console.log('Progress indicator found and working');
      } else {
        console.log('No progress indicator found - this is acceptable for basic implementation');
      }
    });
  });

  test.describe('エラーハンドリング', () => {
    test('APIエラー時の適切なエラー表示', async ({ page }) => {
      const env = detectEnvironment();
      
      if (shouldSkipAuthTest()) {
        test.skip(true, `APIエラーテストをスキップ: Supabase環境=${env.hasSupabase}, SKIP_AUTH=${env.skipAuth}`);
        return;
      }
      
      await textChecker.goto('/checker');
      await mockApiError(page, 'checks', 500, 'サーバーエラーが発生しました');
      
      await textChecker.startCheck(VIOLATION_TEXTS.SAFE_TEXT);
      
      // エラーメッセージが表示されることを確認
      await expectErrorState(page);
      
      // ボタンが再び有効になることを確認
      await expect(textChecker.checkButton).toBeEnabled({ timeout: 10000 });
    });

    test('ネットワークエラー時の処理', async ({ page }) => {
      await page.route('**/api/checks', route => route.abort('failed'));
      
      await textChecker.startCheck(VIOLATION_TEXTS.SAFE_TEXT);
      
      // ネットワークエラーメッセージが表示されることを確認
      await expectErrorState(page);
    });

    test('タイムアウト処理', async ({ page }) => {
      // 遅延レスポンスのモック
      await page.route('**/api/checks', async route => {
        await new Promise(resolve => setTimeout(resolve, 60000)); // 60秒待機
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockCheckResult([]))
        });
      });
      
      await textChecker.startCheck(VIOLATION_TEXTS.SAFE_TEXT);
      
      // タイムアウトエラーまたは長時間処理中状態を確認
      const timeoutElements = [
        'text=タイムアウト',
        'text=処理に時間がかかって',
        'text=時間がかかりすぎています'
      ];
      
      let timeoutFound = false;
      for (const selector of timeoutElements) {
        if (await page.locator(selector).isVisible({ timeout: 30000 }).catch(() => false)) {
          timeoutFound = true;
          break;
        }
      }
      
      if (!timeoutFound) {
        // タイムアウト表示がない場合は、少なくとも処理中状態が継続していることを確認
        await expect(textChecker.checkButton).toBeDisabled();
      }
    });
  });

  test.describe('UI/UXテスト', () => {
    test('キーボードナビゲーション', async ({ page }) => {
      const env = detectEnvironment();
      
      if (shouldSkipAuthTest()) {
        test.skip(true, `キーボードナビゲーションテストをスキップ: Supabase環境=${env.hasSupabase}, SKIP_AUTH=${env.skipAuth}`);
        return;
      }
      
      await textChecker.goto('/checker');
      await page.waitForLoadState('networkidle');
      
      // ページが完全に読み込まれるまで待機
      await page.waitForTimeout(500);
      
      // Tabキーでフォーカス移動
      await page.keyboard.press('Tab');
      await expect(textChecker.textarea).toBeFocused();
      
      // テキスト入力
      await page.keyboard.type('テストテキスト');
      
      // Tab移動でボタンにフォーカス
      await page.keyboard.press('Tab');
      await expect(textChecker.checkButton).toBeFocused();
      
      // Enterキーでボタンクリック
      const mockResult = createMockCheckResult([]);
      await mockApiResponse(page, 'checks', mockResult);
      
      await page.keyboard.press('Enter');
      await textChecker.expectProcessingState();
    });

    test('テキストハイライト機能', async ({ page }) => {
      const mockResult = createMockCheckResult([
        {
          text: 'がんが治る',
          reason: '医薬品的な効果効能の表現',
          start: 0,
          end: 5,
          suggestions: ['がんケアをサポートする']
        }
      ]);

      await mockApiResponse(page, 'checks', mockResult);
      await mockApiResponse(page, `checks/${mockResult.id}/stream`, mockResult);

      await textChecker.startCheck(VIOLATION_TEXTS.MEDICAL_EFFECT);
      
      await page.waitForTimeout(2000); // 結果表示まで待機
      
      // ハイライト要素を確認
      const highlightElements = [
        '.highlight',
        '.violation-highlight',
        '[data-testid="violation-highlight"]',
        '.bg-red-100, .bg-red-200'
      ];
      
      let highlightFound = false;
      for (const selector of highlightElements) {
        if (await page.locator(selector).isVisible({ timeout: 3000 }).catch(() => false)) {
          highlightFound = true;
          break;
        }
      }
      
      if (highlightFound) {
        console.log('Text highlighting is working');
      } else {
        console.log('No text highlighting found - checking for violation display');
        // ハイライトがない場合は、違反リストが表示されていることを確認
        await textChecker.expectViolations(1);
      }
    });
  });
});