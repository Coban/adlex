# Vitest テストスイート改善タスク

## 📋 **概要**

AdLex Vitestテストスイートの品質向上と保守性強化のための段階的改善計画

**現在の状況**:
- ✅ 91個の単体テスト
- ✅ 23個の統合テスト  
- ✅ 包括的なモッキング戦略
- ✅ Clean Architecture対応構造

**目標**: 企業レベルのテスト品質をさらに向上させ、開発効率を最大化

---

## 🚀 **短期改善タスク (1週間以内)**

### T001: テストヘルパー関数の統合・共通化

**優先度**: 🔴 高
**工数**: 4-6時間
**担当者**: 開発チーム

#### 📝 詳細タスク
- [ ] `tests/helpers/index.ts` 作成
- [ ] 認証関連ヘルパー (`auth-helpers.ts`) 実装
- [ ] コンポーネントテストヘルパー (`component-helpers.ts`) 実装
- [ ] API テストヘルパー (`api-helpers.ts`) 実装
- [ ] 既存テストファイルでのヘルパー使用への移行

#### 🎯 成果物
```typescript
// tests/helpers/auth-helpers.ts
export const renderWithAuth = (component: ReactElement, user?: User) => {
  const mockUser = user || createMockUser()
  return render(
    <AuthProvider value={{ user: mockUser }}>{component}</AuthProvider>
  )
}

export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'user',
  organization_id: 'test-org-id',
  ...overrides
})

// tests/helpers/component-helpers.ts
export const renderWithProviders = (
  component: ReactElement,
  { user, router }: { user?: User; router?: Partial<NextRouter> } = {}
) => {
  const mockRouter = { push: vi.fn(), ...router }
  return render(
    <AuthProvider value={{ user }}>
      <RouterContext.Provider value={mockRouter}>
        {component}
      </RouterContext.Provider>
    </AuthProvider>
  )
}
```

#### 🏆 受入条件
- [ ] 既存テストが全て通ること
- [ ] 新しいヘルパーを使用したテストのリファクタリング完了
- [ ] ヘルパー関数の型定義が完全であること

---

### T002: 共通モックオブジェクトの外部化

**優先度**: 🔴 高  
**工数**: 3-4時間
**担当者**: 開発チーム

#### 📝 詳細タスク
- [ ] `tests/mocks/fixtures.ts` 作成
- [ ] ユーザー・組織・チェック結果のモックデータ定義
- [ ] 既存テストでの重複モック削除
- [ ] 型安全なファクトリー関数実装

#### 🎯 成果物
```typescript
// tests/mocks/fixtures.ts
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'user' as const,
  organization_id: 'test-org-id',
  created_at: '2024-01-01T00:00:00Z'
}

export const mockOrganization = {
  id: 'test-org-id', 
  name: 'Test Organization',
  plan: 'basic' as const,
  monthly_check_limit: 1000
}

export const mockCheckResult = {
  id: 'test-check-id',
  status: 'completed' as const,
  text: 'テスト用テキスト',
  violations: [],
  user_id: 'test-user-id'
}

// ファクトリー関数
export const createMockCheck = (overrides: Partial<CheckResult> = {}) => ({
  ...mockCheckResult,
  ...overrides
})
```

---

### T003: テストカバレッジレポートの改善

**優先度**: 🟡 中
**工数**: 2-3時間
**担当者**: 開発チーム

#### 📝 詳細タスク
- [ ] Vitestカバレッジ設定の最適化
- [ ] HTML カバレッジレポート生成設定
- [ ] CI/CD でのカバレッジ閾値設定
- [ ] カバレッジバッジの README 追加

#### 🎯 成果物
```typescript
// vitest.config.ts 更新
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
})
```

---

## 🎯 **中期改善タスク (1ヶ月以内)**

### T004: スナップショットテストの導入

**優先度**: 🟡 中
**工数**: 6-8時間
**担当者**: フロントエンド担当

#### 📝 詳細タスク
- [ ] 主要UIコンポーネントのスナップショットテスト追加
- [ ] Storybook連携スナップショットテスト検討
- [ ] CI/CDでのスナップショット更新ワークフロー設定
- [ ] Visual Regression Testing ツール評価

#### 🎯 対象コンポーネント
- [ ] `TextChecker` コンポーネント
- [ ] `CheckHistoryList` コンポーネント
- [ ] `GlobalNavigation` コンポーネント
- [ ] `DashboardStats` コンポーネント
- [ ] フォームコンポーネント群 (Button, Input, Select等)

---

### T005: パフォーマンステストの実装

**優先度**: 🟡 中
**工数**: 8-10時間
**担当者**: バックエンド担当

#### 📝 詳細タスク
- [ ] API エンドポイントのパフォーマンステスト実装
- [ ] データベースクエリのパフォーマンス測定
- [ ] メモリ使用量テストの追加
- [ ] ベンチマーク結果の可視化

#### 🎯 成果物
```typescript
// tests/performance/api-performance.test.ts
describe('API Performance Tests', () => {
  it('should process check request within 2 seconds', async () => {
    const start = performance.now()
    const response = await request(app)
      .post('/api/checks')
      .send({ text: 'パフォーマンステスト用テキスト' })
    const end = performance.now()
    
    expect(response.status).toBe(200)
    expect(end - start).toBeLessThan(2000)
  })
})
```

---

### T006: テストデータファクトリの実装

**優先度**: 🟡 中
**工数**: 5-6時間
**担当者**: 開発チーム

#### 📝 詳細タスク
- [ ] Factory Pattern実装 (`tests/factories/`)
- [ ] 関連性のあるテストデータ自動生成
- [ ] シード機能との統合
- [ ] 型安全なファクトリー関数群作成

#### 🎯 成果物
```typescript
// tests/factories/UserFactory.ts
export class UserFactory {
  static create(overrides: Partial<User> = {}): User {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      role: 'user',
      organization_id: OrganizationFactory.create().id,
      created_at: faker.date.past().toISOString(),
      ...overrides
    }
  }
  
  static createAdmin(overrides: Partial<User> = {}): User {
    return this.create({ role: 'admin', ...overrides })
  }
}
```

---

## 🔬 **長期改善タスク (3ヶ月以内)**

### T007: Contract Testing の導入

**優先度**: 🟢 低
**工数**: 12-16時間
**担当者**: 開発チーム + QA

#### 📝 詳細タスク
- [ ] Pact.js 導入検討・評価
- [ ] フロントエンド・バックエンド間のContract定義
- [ ] Consumer/Provider テスト実装
- [ ] CI/CD でのContract検証自動化

#### 🎯 期待効果
- API仕様変更時の早期検出
- フロントエンド・バックエンドの独立開発促進
- 統合テストの信頼性向上

---

### T008: Property-based Testing の検討

**優先度**: 🟢 低
**工数**: 8-12時間
**担当者**: 上級開発者

#### 📝 詳細タスク
- [ ] fast-check ライブラリ評価
- [ ] ビジネスロジックの Property-based テスト実装
- [ ] バリデーション関数の網羅的テスト
- [ ] Edge Case 自動発見の仕組み構築

#### 🎯 対象領域
- [ ] 薬機法違反検出ロジック
- [ ] テキスト処理・正規化関数
- [ ] 数値計算・統計処理
- [ ] バリデーション関数

---

### T009: Mutation Testing の導入

**優先度**: 🟢 低
**工数**: 10-14時間
**担当者**: 品質責任者

#### 📝 詳細タスク
- [ ] Stryker Mutator 導入・設定
- [ ] 重要なビジネスロジックのMutation Score測定
- [ ] テスト品質の定量的評価
- [ ] 継続的品質改善プロセス確立

---

## 📊 **進捗管理・KPI**

### 🎯 成功指標

| 指標 | 現在値 | 短期目標 | 中期目標 | 長期目標 |
|------|--------|----------|----------|----------|
| **テストカバレッジ** | 未測定 | 80%+ | 85%+ | 90%+ |
| **テスト実行時間** | 未測定 | <30秒 | <25秒 | <20秒 |
| **テスト保守性スコア** | 3/5 | 4/5 | 4.5/5 | 5/5 |
| **重複コード削減** | - | 30%減 | 50%減 | 70%減 |

### 📅 マイルストーン

- **Week 1**: T001-T003 完了
- **Week 4**: T004-T006 完了  
- **Month 3**: T007-T009 完了
- **継続**: 品質指標の定期レビュー

### 🔄 定期レビュー

- **毎週**: 短期タスク進捗確認
- **毎月**: 中長期タスク計画見直し
- **四半期**: 全体戦略・KPI評価

---

## 🛠️ **実装ガイドライン**

### 📋 タスク実行前チェックリスト

- [ ] 既存テストが全て通ることを確認
- [ ] ブランチ作成 (`feature/vitest-improvement-T00X`)
- [ ] 変更範囲の影響分析実施

### 🧪 品質保証

- [ ] 新しいテストヘルパーの動作確認
- [ ] パフォーマンス影響評価
- [ ] コードレビュー実施
- [ ] ドキュメント更新

### 📚 参考資料

- [Vitest Best Practices](https://vitest.dev/guide/best-practices.html)
- [Testing Library Guides](https://testing-library.com/docs/)
- [MSW Documentation](https://mswjs.io/docs/)
- [Clean Architecture Testing](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

---

**作成日**: 2025年8月22日  
**更新日**: -  
**ステータス**: 計画中

**次回レビュー予定**: 2025年8月29日