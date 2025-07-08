# テスト実装ガイド - AdLex

AdLexプロジェクトの自動テスト環境の実装が完了しました。このドキュメントでは、テストの実行方法と各テストファイルの詳細について説明します。

## 🧪 テスト構成

### ユニットテスト
- **フレームワーク**: Vitest + React Testing Library
- **モック**: MSW (Mock Service Worker)
- **カバレッジ**: Istanbul (c8)

### E2Eテスト
- **フレームワーク**: Playwright
- **ブラウザ**: Chromium, Firefox, WebKit
- **デバイス**: Desktop & Mobile

## 📁 ファイル構成

```
├── vitest.config.ts              # Vitest設定
├── playwright.config.ts          # Playwright設定
├── src/
│   ├── test/
│   │   ├── setup.ts              # テストセットアップ
│   │   └── mocks/
│   │       ├── server.ts         # MSWサーバー設定
│   │       └── handlers.ts       # APIモックハンドラー
│   ├── lib/__tests__/
│   │   └── utils.test.ts         # ユーティリティテスト
│   ├── components/__tests__/
│   │   └── ui/button.test.tsx    # Buttonコンポーネントテスト
│   └── app/api/dictionaries/__tests__/
│       └── route.test.ts         # API ルートテスト
└── e2e/
    ├── auth.spec.ts              # 認証E2Eテスト
    └── text-checker.spec.ts      # メイン機能E2Eテスト
```

## 🚀 テスト実行コマンド

### ユニットテスト

```bash
# 全てのユニットテストを実行
npm run test

# ウォッチモードで実行
npm run test:watch

# UIモードで実行
npm run test:ui

# カバレッジ付きで実行
npm run test:coverage
```

### E2Eテスト

```bash
# 全てのE2Eテストを実行
npm run test:e2e

# UIモードで実行（ブラウザ表示）
npm run test:e2e:ui

# ヘッドモードで実行（ブラウザ表示）
npm run test:e2e:headed

# 全てのテストを実行
npm run test:all
```

## 🔧 事前準備

### 1. Supabaseローカル環境の起動

```bash
npm run supabase:start
```

### 2. テストデータの作成

```bash
npm run seed
```

### 3. 開発サーバーの起動（E2Eテスト用）

```bash
npm run dev
```

## 📝 実装されたテストケース

### ユニットテスト

#### `src/lib/__tests__/utils.test.ts`
- **cn関数**: クラス名のマージ機能
- **formatDate関数**: 日本語日付フォーマット

#### `src/components/__tests__/ui/button.test.tsx`
- ボタンレンダリング
- クリックイベント処理
- バリアント・サイズ適用
- disabled状態
- asChild機能

#### `src/app/api/dictionaries/__tests__/route.test.ts`
- GET API（辞書一覧取得）
- POST API（辞書項目作成）
- 認証・認可チェック
- バリデーション

### E2Eテスト

#### `e2e/auth.spec.ts`
- ログイン・ログアウト
- 組織アカウント作成
- 認証エラーハンドリング

#### `e2e/text-checker.spec.ts`
- テキスト入力・文字数制限
- チェック機能実行
- 結果表示・履歴管理
- 違反詳細表示

## 🎯 テストのベストプラクティス

### 1. ユニットテスト
- **単一責任**: 1つのテストは1つの機能のみテスト
- **独立性**: テスト間で依存関係を作らない
- **データ分離**: モックデータを使用してDBに依存しない

### 2. E2Eテスト
- **ユーザー視点**: 実際のユーザー操作をシミュレート
- **重要なフロー**: メイン機能に集中
- **適切な待機**: 非同期処理に対する適切なタイムアウト

### 3. モック戦略
- **外部API**: OpenAI APIなどの外部サービス
- **Supabase**: 認証・データベース操作
- **ブラウザAPI**: matchMedia、ResizeObserverなど

## 🐛 トラブルシューティング

### テスト実行エラー

```bash
# 依存関係の再インストール
npm ci

# Playwrightブラウザの再インストール
npx playwright install

# テストキャッシュのクリア
npm run test -- --clearCache
```

### E2Eテストのデバッグ

```bash
# デバッグモードで実行
npm run test:e2e:headed

# 特定のテストのみ実行
npx playwright test auth.spec.ts

# トレース機能を使用
npx playwright test --trace on
```

## 📊 カバレッジ目標

- **総合カバレッジ**: 80%以上
- **関数カバレッジ**: 85%以上
- **ブランチカバレッジ**: 75%以上

現在のカバレッジ状況は `npm run test:coverage` で確認できます。

## 🔄 CI/CD統合

### GitHub Actions例

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

## 📈 今後の拡張予定

- **Visual Regression Testing**: UI変更の検知
- **Performance Testing**: 負荷・パフォーマンステスト
- **Accessibility Testing**: アクセシビリティチェック
- **API Contract Testing**: OpenAPI仕様との整合性

---

**作成日**: 2025-01-25  
**テスト実装**: Vitest + Playwright  
**カバレッジ**: 基本機能の主要部分をカバー