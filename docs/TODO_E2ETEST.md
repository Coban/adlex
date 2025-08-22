# E2Eテスト改善タスクリスト

## 📊 概要

このドキュメントは、AdLex E2Eテストスイートの改善点を細かいタスクに分割したものです。各タスクは優先度、担当者、期限、依存関係を明確に定義しています。

## 🎯 全体目標

- **認証テストの信頼性向上**: 管理画面での権限チェックを厳密化
- **エラーハンドリングの強化**: エラータイプ別の適切な処理確認
- **テスト保守性の向上**: より堅牢で保守しやすいテスト構造の実現

---

## 🔒 認証・権限テストの改善

### T001: 認証状態検証機能の強化

**優先度**: 🔴 High  
**期限**: 1-2日  
**依存**: なし  

#### タスク詳細
- [ ] `verifyAuthenticationState()` 関数の実装
  - [ ] セッション有効期限の確認機能
  - [ ] ユーザーロール情報の取得機能
  - [ ] トークンの有効性検証機能
- [ ] `tests/e2e/utils/auth-verifier.ts` ファイル作成
- [ ] TypeScript型定義の追加

#### 実装内容
```typescript
// tests/e2e/utils/auth-verifier.ts
export interface AuthState {
  isAuthenticated: boolean;
  userRole: string | null;
  sessionValid: boolean;
  expiresAt: number | null;
  tokenType: 'access' | 'refresh' | null;
}

export async function verifyAuthenticationState(page: Page): Promise<AuthState>
```

#### 受入条件
- [ ] セッション情報を正確に取得できる
- [ ] 期限切れトークンを検出できる
- [ ] ユーザーロールを正しく判定できる

---

### T002: 管理画面権限チェックの厳密化

**優先度**: 🔴 High  
**期限**: 2-3日  
**依存**: T001  

#### タスク詳細
- [ ] 管理者権限の明示的確認テストを追加
- [ ] 一般ユーザーでの管理画面アクセス拒否テスト
- [ ] 権限不足時のエラー表示確認

#### 対象ファイル
- `tests/e2e/admin-management-complete.spec.ts`
- `tests/e2e/utils/test-helpers.ts`

#### 実装内容
```typescript
test('管理者権限でのみアクセス可能な機能', async ({ page }) => {
  // Step 1: 管理者として認証
  const authState = await verifyAuthenticationState(page);
  expect(authState.userRole).toBe('admin');
  
  // Step 2: 管理画面アクセス確認
  await page.goto('/admin/users');
  await expect(page.locator('[data-testid="admin-content"]')).toBeVisible();
  
  // Step 3: 管理者専用機能の確認
  await expect(page.locator('[data-testid="user-invite-button"]')).toBeVisible();
});

test('一般ユーザーの管理画面アクセス拒否', async ({ page }) => {
  // Step 1: 一般ユーザーとして認証
  const authState = await verifyAuthenticationState(page);
  expect(authState.userRole).toBe('user');
  
  // Step 2: 管理画面アクセス試行
  await page.goto('/admin/users');
  
  // Step 3: アクセス拒否の確認
  await expectAccessDeniedError(page);
});
```

#### 受入条件
- [ ] 管理者権限でのみ管理画面にアクセスできる
- [ ] 一般ユーザーのアクセス時に適切なエラーが表示される
- [ ] 権限チェックが確実に動作する

---

### T003: 認証エラータイプ別検証機能

**優先度**: 🟡 Medium  
**期限**: 3-4日  
**依存**: T001  

#### タスク詳細
- [ ] `expectAuthenticationError()` 関数の実装
- [ ] エラータイプ別セレクター定義
- [ ] エラー表示パターンの網羅的テスト

#### 実装内容
```typescript
// tests/e2e/utils/auth-error-verifier.ts
type AuthErrorType = 'unauthorized' | 'forbidden' | 'expired' | 'invalid_token';

export async function expectAuthenticationError(
  page: Page, 
  expectedErrorType: AuthErrorType
): Promise<void> {
  // エラータイプ別の検証ロジック
}
```

#### 対象エラーパターン
- [ ] 401 Unauthorized: ログインページリダイレクト確認
- [ ] 403 Forbidden: アクセス拒否メッセージ表示確認
- [ ] セッション期限切れ: 再ログイン促進メッセージ確認
- [ ] 無効トークン: トークン更新またはログアウト確認

#### 受入条件
- [ ] 各エラータイプで適切な処理が実行される
- [ ] エラーメッセージが正しく表示される
- [ ] リダイレクト処理が正常に動作する

---

## 🛡️ エラーハンドリングテストの強化

### T004: セッション管理エラーの詳細テスト

**優先度**: 🟡 Medium  
**期限**: 2-3日  
**依存**: T003  

#### タスク詳細
- [ ] セッション期限切れシナリオの追加
- [ ] トークン無効化処理のテスト
- [ ] 自動ログアウト機能の確認

#### 実装内容
```typescript
test('セッション期限切れ時の自動ログアウト', async ({ page }) => {
  // 期限切れトークンを設定
  await page.addInitScript(() => {
    localStorage.setItem('supabase.auth.token', JSON.stringify({
      access_token: 'expired_token',
      expires_at: Date.now() - 3600000 // 1時間前に期限切れ
    }));
  });
  
  await page.goto('/checker');
  
  // 自動ログアウト確認
  await expectAuthenticationError(page, 'expired');
});
```

#### 受入条件
- [ ] 期限切れ時に適切なメッセージが表示される
- [ ] 自動的にログインページにリダイレクトされる
- [ ] セッション情報が適切にクリアされる

---

### T005: ネットワークエラー処理の改善

**優先度**: 🟡 Medium  
**期限**: 3-4日  
**依存**: なし  

#### タスク詳細
- [ ] リトライ機能の詳細テスト
- [ ] オフライン状態の処理確認
- [ ] 部分的な接続失敗の処理テスト

#### 実装内容
```typescript
test('段階的リトライ機能の確認', async ({ page }) => {
  let requestCount = 0;
  
  await page.route('**/api/checks', async route => {
    requestCount++;
    if (requestCount <= 2) {
      await route.abort('failed');
    } else {
      // 3回目で成功
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true })
      });
    }
  });
  
  // リトライ処理の確認
  await textChecker.startCheck('テスト');
  await expectRetryBehavior(page);
});
```

#### 受入条件
- [ ] 設定された回数だけリトライが実行される
- [ ] リトライ中の状態が適切に表示される
- [ ] 最終的に成功または失敗が正しく処理される

---

## 🏗️ テスト構造・保守性の改善

### T006: ページオブジェクトモデルの拡張

**優先度**: 🟢 Low  
**期限**: 1週間  
**依存**: なし  

#### タスク詳細
- [ ] 管理画面用ページオブジェクトの追加
- [ ] 共通アクション（ログイン、ナビゲーション）の統一
- [ ] エラー状態確認メソッドの標準化

#### 新規作成ファイル
- `tests/e2e/utils/admin-page-objects.ts`
- `tests/e2e/utils/error-state-verifiers.ts`

#### 実装内容
```typescript
// tests/e2e/utils/admin-page-objects.ts
export class AdminUsersPage extends BasePage {
  readonly userListTable: Locator;
  readonly inviteButton: Locator;
  readonly searchInput: Locator;
  
  async expectAdminInterface() {
    await expect(this.userListTable).toBeVisible();
    await expect(this.inviteButton).toBeVisible();
  }
  
  async searchUser(email: string) {
    await this.searchInput.fill(email);
    await this.page.waitForTimeout(1000);
  }
}
```

#### 受入条件
- [ ] 管理画面の全ての主要操作がページオブジェクトで表現される
- [ ] テストコードの重複が削減される
- [ ] メンテナンスが容易な構造になる

---

### T007: テストデータ管理の改善

**優先度**: 🟢 Low  
**期限**: 1週間  
**依存**: なし  

#### タスク詳細
- [ ] テストユーザーデータのセットアップ自動化
- [ ] テスト用辞書データの標準化
- [ ] モックデータジェネレータの作成

#### 実装内容
```typescript
// tests/e2e/utils/test-data-factory.ts
export class TestDataFactory {
  static createMockUser(role: 'admin' | 'user' = 'user') {
    return {
      email: `test-${role}-${Date.now()}@example.com`,
      password: 'password123',
      role
    };
  }
  
  static createMockViolationText(type: 'medical' | 'exaggerated' | 'safe') {
    const templates = {
      medical: 'がんが治る効果があります',
      exaggerated: '100%効果保証',
      safe: '健康的な食品です'
    };
    return templates[type];
  }
}
```

#### 受入条件
- [ ] テストデータの作成が統一される
- [ ] テスト間でのデータ競合が回避される
- [ ] リアルなテストシナリオが実現される

---

### T008: 設定ファイルの最適化

**優先度**: 🟢 Low  
**期限**: 3-4日  
**依存**: なし  

#### タスク詳細
- [ ] `playwright.config.ts`のタイムアウト設定最適化
- [ ] 環境別設定の分離
- [ ] CI/CD環境での実行最適化

#### 実装内容
```typescript
// playwright.config.ts の改善案
export default defineConfig({
  // 環境別設定の分離
  projects: [
    {
      name: 'chromium-auth',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['**/admin-*.spec.ts', '**/auth-*.spec.ts'],
      dependencies: ['auth-setup']
    },
    {
      name: 'chromium-no-auth',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['**/text-checker-*.spec.ts', '**/essential-*.spec.ts']
    }
  ]
});
```

#### 受入条件
- [ ] 認証が必要なテストと不要なテストが適切に分離される
- [ ] CI環境での実行時間が短縮される
- [ ] 設定の管理が簡素化される

---

## 📈 パフォーマンステストの追加

### T009: レスポンス時間テストの実装

**優先度**: 🟢 Low  
**期限**: 1週間  
**依存**: なし  

#### タスク詳細
- [ ] API応答時間の測定機能
- [ ] ページ読み込み時間の監視
- [ ] パフォーマンス劣化の検出

#### 実装内容
```typescript
// tests/e2e/performance.spec.ts
test('テキストチェック処理のパフォーマンス', async ({ page }) => {
  const startTime = Date.now();
  
  await textChecker.startCheck('テスト用テキスト');
  await page.waitForSelector('[data-testid="check-result"]');
  
  const endTime = Date.now();
  const processingTime = endTime - startTime;
  
  // パフォーマンス基準の確認
  expect(processingTime).toBeLessThan(10000); // 10秒以内
});
```

#### 受入条件
- [ ] 主要操作の応答時間が基準以内である
- [ ] パフォーマンス劣化を自動検出できる
- [ ] CI環境でパフォーマンステストが実行される

---

### T010: 大量データ処理テスト

**優先度**: 🟢 Low  
**期限**: 1週間  
**依存**: T009  

#### タスク詳細
- [ ] 大量テキスト処理の安定性確認
- [ ] メモリ使用量の監視
- [ ] 同時処理の制限テスト

#### 実装内容
```typescript
test('大量テキスト処理の安定性', async ({ page }) => {
  const largeText = 'テスト'.repeat(10000); // 大量テキスト
  
  await textChecker.startCheck(largeText);
  
  // メモリ使用量の確認
  const memoryUsage = await page.evaluate(() => {
    return (performance as any).memory?.usedJSHeapSize;
  });
  
  // メモリリークの確認
  expect(memoryUsage).toBeLessThan(100 * 1024 * 1024); // 100MB以下
});
```

#### 受入条件
- [ ] 大量データでもアプリケーションが安定動作する
- [ ] メモリリークが発生しない
- [ ] 適切なエラーハンドリングが実行される

---

## 🔄 CI/CD統合の改善

### T011: テスト実行の最適化

**優先度**: 🟡 Medium  
**期限**: 1週間  
**依存**: T008  

#### タスク詳細
- [ ] 並列実行の最適化
- [ ] テスト失敗時の詳細レポート
- [ ] 失敗テストの自動再実行

#### 実装内容
```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        browser: [chromium, firefox, webkit]
        shard: [1/3, 2/3, 3/3]
    steps:
      - name: Run E2E Tests
        run: npx playwright test --shard=${{ matrix.shard }}
```

#### 受入条件
- [ ] CI環境でのテスト実行時間が短縮される
- [ ] 失敗時の詳細情報が取得できる
- [ ] フレーク性のあるテストが特定される

---

### T012: テストレポートの改善

**優先度**: 🟢 Low  
**期限**: 3-4日  
**依存**: T011  

#### タスク詳細
- [ ] 視覚的なテストレポートの生成
- [ ] 失敗スクリーンショットの自動保存
- [ ] テスト実行履歴の管理

#### 実装内容
```typescript
// playwright.config.ts
export default defineConfig({
  reporter: [
    ['html', { open: 'never', outputFolder: 'test-reports/html' }],
    ['json', { outputFile: 'test-reports/results.json' }],
    ['junit', { outputFile: 'test-reports/junit.xml' }]
  ],
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure'
  }
});
```

#### 受入条件
- [ ] 複数形式のテストレポートが生成される
- [ ] 失敗時のデバッグ情報が充実する
- [ ] テスト結果の履歴管理ができる

---

## 📋 実装優先順位と工数見積もり

| タスクID | 優先度 | 工数（人日） | 依存関係 | 担当推奨 |
|---------|-------|------------|---------|---------|
| T001 | 🔴 High | 1.5 | なし | フロントエンド |
| T002 | 🔴 High | 2.0 | T001 | フロントエンド |
| T003 | 🟡 Medium | 2.5 | T001 | フロントエンド |
| T004 | 🟡 Medium | 1.5 | T003 | フロントエンド |
| T005 | 🟡 Medium | 2.0 | なし | フロントエンド |
| T006 | 🟢 Low | 3.0 | なし | QA/テスト |
| T007 | 🟢 Low | 2.0 | なし | QA/テスト |
| T008 | 🟢 Low | 1.0 | なし | DevOps |
| T009 | 🟢 Low | 2.5 | なし | QA/テスト |
| T010 | 🟢 Low | 1.5 | T009 | QA/テスト |
| T011 | 🟡 Medium | 2.0 | T008 | DevOps |
| T012 | 🟢 Low | 1.0 | T011 | DevOps |

**総工数**: 21人日  
**優先度別**:
- 🔴 High: 3.5人日
- 🟡 Medium: 8.0人日  
- 🟢 Low: 9.5人日

---

## 🎯 マイルストーン

### Phase 1: 認証・セキュリティ強化（1週間）
- T001, T002, T003の完了
- 認証テストの信頼性向上

### Phase 2: エラーハンドリング改善（1週間）  
- T004, T005の完了
- 包括的なエラー処理の実現

### Phase 3: 構造改善・最適化（2週間）
- T006, T007, T008, T011の完了
- テストの保守性・実行効率向上

### Phase 4: 品質向上・監視強化（1週間）
- T009, T010, T012の完了
- パフォーマンス・品質監視の実現

---

## ✅ 完了チェックリスト

各タスク完了時に以下を確認：

- [ ] 機能要件が満たされている
- [ ] テストが正常に実行される
- [ ] ドキュメントが更新されている
- [ ] コードレビューが完了している
- [ ] CI/CDパイプラインが正常動作する

---

## 📝 注意事項

1. **環境依存の考慮**: SKIP_AUTH設定での動作確認を忘れずに実施
2. **後方互換性**: 既存テストが壊れないよう注意深く実装
3. **パフォーマンス**: テスト実行時間の増大を最小限に抑制
4. **メンテナンス性**: 将来の変更に対応しやすい設計を心がける

---

**作成日**: 2025年8月22日  
**最終更新**: 2025年8月22日  
**次回レビュー予定**: 各Phase完了時