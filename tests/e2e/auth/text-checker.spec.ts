import { test, expect } from '@playwright/test';

/**
 * テキストチェッカー機能テスト（認証済み）
 * 
 * 目的:
 * - 薬機法チェック機能の基本動作確認
 * - UIログインなしでの高速テスト実行
 * - チェック結果の表示確認
 * - リアルタイム進捗の動作確認
 */

test.describe('テキストチェッカー（認証済み）', () => {
  test.beforeEach(async ({ page }) => {
    // storageStateにより認証済み状態で開始
    await page.goto('/checker');
    await page.waitForLoadState('networkidle');
  });

  test('テキストチェッカーインターフェースの表示', async ({ page }) => {
    // 基本UI要素の確認
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.getByRole('button', { name: /チェック開始|分析開始/ })).toBeVisible();
    
    // ページタイトルの確認
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('文字数カウント機能', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.fill('テストテキスト');
    
    // 文字数カウンターの表示確認
    const characterCount = page.locator('text=/[0-9]+/');
    await expect(characterCount).toBeVisible();
    
    // 正確な文字数の確認
    const countText = await characterCount.textContent();
    expect(countText).toContain('7'); // "テストテキスト"は7文字
  });

  test('チェックボタンの状態制御', async ({ page }) => {
    const textarea = page.locator('textarea');
    const checkButton = page.getByRole('button', { name: /チェック開始|分析開始/ });

    // 初期状態ではボタンが無効
    await expect(checkButton).toBeDisabled();

    // テキスト入力後にボタンが有効化
    await textarea.fill('がんが治る奇跡のサプリメント');
    await expect(checkButton).toBeEnabled();

    // テキストクリア後に再度無効化
    await textarea.clear();
    await expect(checkButton).toBeDisabled();
  });

  test('基本的なテキストチェック処理', async ({ page }) => {
    const textarea = page.locator('textarea');
    const checkButton = page.getByRole('button', { name: /チェック開始|分析開始/ });
    
    // 違反の可能性があるテキストを入力
    await textarea.fill('がんが治る奇跡のサプリメント！血圧が下がる効果があります。');
    await checkButton.click();

    // 処理中の状態確認
    await expect(checkButton).toBeDisabled({ timeout: 5000 });
    
    // 処理中インジケーターの確認
    const processingIndicators = [
      page.locator('text=/チェック中|処理中|分析中/'),
      page.locator('.animate-spin'),
      page.locator('[data-testid="loading"]')
    ];
    
    let processingFound = false;
    for (const indicator of processingIndicators) {
      if (await indicator.isVisible({ timeout: 2000 }).catch(() => false)) {
        processingFound = true;
        break;
      }
    }
    
    expect(processingFound).toBe(true);
  });

  test('チェック結果の表示確認', async ({ page }) => {
    const textarea = page.locator('textarea');
    const checkButton = page.getByRole('button', { name: /チェック開始|分析開始/ });
    
    // 明確な違反テキストを使用
    await textarea.fill('がんが治る');
    await checkButton.click();

    // 結果表示まで待機（最大30秒）
    const resultSection = page.locator('[data-testid="check-result"], .check-result, .violations');
    await expect(resultSection).toBeVisible({ timeout: 30000 });

    // 結果の基本構造確認
    const hasViolations = await page.locator('text=/違反|問題|注意/')
      .isVisible({ timeout: 5000 }).catch(() => false);
    const hasClean = await page.locator('text=/問題なし|適切|OK/')
      .isVisible({ timeout: 5000 }).catch(() => false);

    // どちらかの結果が表示されていること
    expect(hasViolations || hasClean).toBe(true);
  });

  test('複数回のチェック実行', async ({ page }) => {
    const textarea = page.locator('textarea');
    const checkButton = page.getByRole('button', { name: /チェック開始|分析開始/ });

    // 1回目のチェック
    await textarea.fill('健康維持に役立つ食品です');
    await checkButton.click();
    
    // 結果表示まで待機
    await page.waitForSelector('[data-testid="check-result"], .check-result, .violations', 
      { timeout: 30000 });
    
    // 2回目のチェック準備
    await textarea.clear();
    await textarea.fill('がんが治る薬');
    
    // ボタンが再度有効化されることを確認
    await expect(checkButton).toBeEnabled();
    
    // 2回目のチェック実行
    await checkButton.click();
    
    // 処理開始の確認
    await expect(checkButton).toBeDisabled({ timeout: 5000 });
  });

  test('長文テキストのチェック', async ({ page }) => {
    const textarea = page.locator('textarea');
    const checkButton = page.getByRole('button', { name: /チェック開始|分析開始/ });

    // 長文テキストの準備
    const longText = Array(10).fill('健康維持に役立つ食品です。').join(' ') + 
                    ' がんが治る効果があります。' +
                    Array(10).fill(' 栄養補給に最適です。').join('');

    await textarea.fill(longText);
    
    // 文字数の確認
    const characterCount = page.locator('text=/[0-9]+/');
    const countText = await characterCount.textContent();
    const count = parseInt(countText?.match(/\d+/)?.[0] || '0');
    expect(count).toBeGreaterThan(100);

    // チェック実行
    await checkButton.click();
    
    // 長文処理の開始確認
    await expect(checkButton).toBeDisabled({ timeout: 5000 });
  });

  test('エラーハンドリング - 空テキスト', async ({ page }) => {
    const textarea = page.locator('textarea');
    const checkButton = page.getByRole('button', { name: /チェック開始|分析開始/ });

    // 空の状態でボタンが無効であることを確認
    await expect(checkButton).toBeDisabled();
    
    // 空白のみのテキストでテスト
    await textarea.fill('   \n\n   ');
    
    // 空白のみの場合もボタンが無効であることを確認
    await expect(checkButton).toBeDisabled();
  });

  test('テキストエリアの基本操作', async ({ page }) => {
    const textarea = page.locator('textarea');

    // プレースホルダーの確認
    const placeholder = await textarea.getAttribute('placeholder');
    expect(placeholder).toBeTruthy();

    // テキスト入力と編集
    await textarea.fill('最初のテキスト');
    await expect(textarea).toHaveValue('最初のテキスト');

    // テキストの追加
    await textarea.fill('最初のテキスト\n追加のテキスト');
    await expect(textarea).toHaveValue('最初のテキスト\n追加のテキスト');

    // テキストのクリア
    await textarea.clear();
    await expect(textarea).toHaveValue('');
  });
});