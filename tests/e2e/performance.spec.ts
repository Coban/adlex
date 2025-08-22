import { test, expect } from '@playwright/test';

import { TextCheckerPage } from './utils/page-objects';
import { 
  mockApiResponse,
  setupTestEnvironment
} from './utils/test-helpers';
import { 
  TestDataFactory
} from './utils/test-data-factory';
import { injectTestEnvironment } from './utils/environment-detector';

/**
 * T009: レスポンス時間テストの実装
 * API応答時間の測定機能、ページ読み込み時間の監視、パフォーマンス劣化の検出
 */
test.describe('パフォーマンステスト', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestEnvironment(page);
    await setupTestEnvironment(page);
  });

  test('テキストチェック処理のパフォーマンス', async ({ page }) => {
    const textChecker = new TextCheckerPage(page);
    
    // パフォーマンス測定用のモックレスポンス
    const mockResult = TestDataFactory.createMockCheckResult(2);
    await mockApiResponse(page, 'checks', mockResult);

    const startTime = Date.now();
    
    await textChecker.startCheck('テスト用テキスト');
    
    // チェック結果が表示されるまで待機（より柔軟な条件）
    const resultSelectors = [
      '[data-testid="check-result"]',
      '.result',
      '.violations',
      'text=チェック完了',
      'text=処理完了'
    ];
    
    let resultFound = false;
    for (const selector of resultSelectors) {
      if (await page.locator(selector).isVisible({ timeout: 10000 }).catch(() => false)) {
        resultFound = true;
        break;
      }
    }
    
    // 結果が見つからない場合は、ボタンが再度有効になることを確認
    if (!resultFound) {
      await expect(textChecker.checkButton).toBeEnabled({ timeout: 15000 });
    }
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log(`処理時間: ${processingTime}ms`);
    
    // パフォーマンス基準の確認（10秒以内）
    expect(processingTime).toBeLessThan(10000);
    
    // より厳しい基準（5秒以内）も設定可能
    if (processingTime > 5000) {
      console.warn(`Warning: Processing took ${processingTime}ms, which is longer than 5 seconds`);
    }
  });

  test('ページ読み込み時間の監視', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/checker');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    console.log(`ページ読み込み時間: ${loadTime}ms`);
    
    // ページ読み込み時間の基準（3秒以内）
    expect(loadTime).toBeLessThan(3000);
    
    // パフォーマンスメトリクスの取得
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
        largestContentfulPaint: performance.getEntriesByName('largest-contentful-paint')[0]?.startTime || 0
      };
    });
    
    console.log('詳細なパフォーマンスメトリクス:', metrics);
    
    // DOMコンテンツ読み込み時間（1秒以内）
    expect(metrics.domContentLoaded).toBeLessThan(1000);
    
    // First Contentful Paint（2秒以内）
    if (metrics.firstContentfulPaint > 0) {
      expect(metrics.firstContentfulPaint).toBeLessThan(2000);
    }
  });

  test('大量データ処理の安定性', async ({ page }) => {
    const textChecker = new TextCheckerPage(page);
    
    // 大量の違反データをモック
    const largeViolations = Array.from({ length: 100 }, (_, i) => 
      TestDataFactory.createMockViolation({
        start: i * 10,
        end: i * 10 + 5,
        text: `violation${i}`
      })
    );
    
    const largeMockResult = TestDataFactory.createMockCheckResult(0, {
      violations: largeViolations
    });
    
    await mockApiResponse(page, 'checks', largeMockResult);
    
    // 大量テキストを作成
    const largeText = TestDataFactory.createMockViolationText('medical').repeat(100);
    
    const startTime = Date.now();
    await textChecker.startCheck(largeText);
    
    // 処理完了を待機
    await page.waitForSelector('[data-testid="check-result"], .violations', { timeout: 30000 });
    const processingTime = Date.now() - startTime;
    
    console.log(`大量データ処理時間: ${processingTime}ms`);
    
    // メモリ使用量の確認
    const memoryUsage = await page.evaluate(() => {
      const memory = (performance as any).memory;
      return memory ? {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      } : null;
    });
    
    if (memoryUsage) {
      console.log('メモリ使用量:', memoryUsage);
      
      // メモリリークの確認（100MB以下）
      expect(memoryUsage.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024);
    }
    
    // 大量データでも妥当な処理時間内
    expect(processingTime).toBeLessThan(15000);
    
    // ページの応答性確認
    const isPageResponsive = await textChecker.textarea.isEnabled().catch(() => false);
    expect(isPageResponsive).toBe(true);
  });

  test('同時アクセス処理の性能', async ({ browser }) => {
    const contexts = await Promise.all(
      Array.from({ length: 3 }, () => browser.newContext())
    );
    
    const pages = await Promise.all(
      contexts.map(context => context.newPage())
    );
    
    // 各ページでテスト環境をセットアップ
    await Promise.all(pages.map(async (page) => {
      await injectTestEnvironment(page);
      await setupTestEnvironment(page);
      
      const mockResult = TestDataFactory.createMockCheckResult(1);
      await mockApiResponse(page, 'checks', mockResult);
    }));
    
    // 同時に処理を開始
    const startTime = Date.now();
    const textCheckers = pages.map(page => new TextCheckerPage(page));
    
    await Promise.all(textCheckers.map((checker, index) => 
      checker.startCheck(`テスト用テキスト${index}`)
    ));
    
    // 全ての処理完了を待機
    await Promise.all(pages.map(page => 
      page.waitForSelector('[data-testid="check-result"], .result', { timeout: 30000 })
    ));
    
    const totalTime = Date.now() - startTime;
    console.log(`同時処理時間: ${totalTime}ms`);
    
    // 同時処理でも妥当な時間内
    expect(totalTime).toBeLessThan(20000);
    
    // クリーンアップ
    await Promise.all(contexts.map(context => context.close()));
  });

  test('リソース読み込み効率の確認', async ({ page }) => {
    // ネットワーク要求を監視
    const networkRequests: Array<{ url: string; size: number; duration: number }> = [];
    
    page.on('response', async (response) => {
      const request = response.request();
      const size = (await response.body().catch(() => Buffer.alloc(0))).length;
      
      networkRequests.push({
        url: request.url(),
        size,
        duration: 0 // 実際の実装では response.timing() を使用
      });
    });
    
    await page.goto('/checker');
    await page.waitForLoadState('networkidle');
    
    // リソースサイズの確認
    const totalSize = networkRequests.reduce((sum, req) => sum + req.size, 0);
    console.log(`総リソースサイズ: ${Math.round(totalSize / 1024)}KB`);
    console.log(`リクエスト数: ${networkRequests.length}`);
    
    // パフォーマンスの基準
    expect(totalSize).toBeLessThan(5 * 1024 * 1024); // 5MB以下
    expect(networkRequests.length).toBeLessThan(50); // 50リクエスト以下
    
    // 不要な大きなリソースの検出
    const largeResources = networkRequests.filter(req => req.size > 500 * 1024); // 500KB超
    if (largeResources.length > 0) {
      console.warn('大きなリソース:', largeResources.map(r => ({ url: r.url, size: Math.round(r.size / 1024) + 'KB' })));
    }
  });

  test('レスポンシブ性能テスト', async ({ page }) => {
    // モバイルビューポートに設定
    await page.setViewportSize({ width: 375, height: 667 });
    
    const startTime = Date.now();
    await page.goto('/checker');
    await page.waitForLoadState('networkidle');
    
    const mobileLoadTime = Date.now() - startTime;
    console.log(`モバイルページ読み込み時間: ${mobileLoadTime}ms`);
    
    // モバイルでの読み込み時間基準
    expect(mobileLoadTime).toBeLessThan(4000);
    
    // タッチ操作の応答性テスト
    const textChecker = new TextCheckerPage(page);
    await textChecker.textarea.click();
    
    const inputStartTime = Date.now();
    await textChecker.textarea.type('テスト', { delay: 50 });
    const inputTime = Date.now() - inputStartTime;
    
    console.log(`入力応答時間: ${inputTime}ms`);
    expect(inputTime).toBeLessThan(1000);
  });
});