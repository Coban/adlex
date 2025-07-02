# AdLex - 薬機法チェック & リライト SaaS

薬機法（医薬品医療機器等法）に抵触する表現を検知し、安全な表現へ自動リライトするWebサービスです。

## 機能

- **テキストチェック**: 最大10,000文字のテキストを薬機法に基づいてチェック
- **自動リライト**: OpenAI GPTを使用した安全な表現への自動修正
- **リアルタイム処理**: Server-Sent Eventsによるリアルタイム進捗表示
- **組織管理**: 複数ユーザーによる組織単位での利用
- **独自辞書**: 組織独自のNG/許可表現の管理
- **履歴管理**: チェック結果の保存と検索

## 技術スタック

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS, Radix UI
- **Backend**: Next.js API Routes, Supabase
- **Database**: PostgreSQL (pgvector, pg_trgm拡張)
- **AI**: OpenAI GPT-4o, text-embedding-3-small（ローカル開発時はLM Studio対応）
- **Authentication**: Supabase Auth
- **Deployment**: Vercel

## ローカル開発での AI設定

本プロジェクトは、ローカル開発時にOpenAI APIの代わりに**LM Studio**を使用することができます。
詳細な設定方法は[LM Studio使用ガイド](./LM_STUDIO_GUIDE.md)を参照してください。

### クイックスタート（LM Studio）

```bash
# LM Studioを有効化
echo "USE_LM_STUDIO=true" >> .env.local

# LM Studioの設定（例）
echo "LM_STUDIO_CHAT_MODEL=llama-3.1-8b" >> .env.local
echo "LM_STUDIO_EMBEDDING_MODEL=all-MiniLM-L6-v2" >> .env.local
```

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example`を`.env.local`にコピーして、必要な値を設定：

```bash
cp .env.example .env.local
```

必要な環境変数：
- `NEXT_PUBLIC_SUPABASE_URL`: SupabaseプロジェクトURL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase匿名キー
- `OPENAI_API_KEY`: OpenAI APIキー

### 3. データベースのセットアップ

Supabaseプロジェクトで以下のSQLを実行：

```bash
psql -h your-supabase-host -p 5432 -U postgres -d postgres -f database/init.sql
```

または、Supabase SQLエディターで`database/init.sql`の内容を実行

### 4. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアプリケーションにアクセス

## 使用方法

### 基本的な使い方

1. ユーザー登録・ログイン
2. 組織の作成または参加
3. テキストエリアにチェックしたいテキストを入力
4. 「チェック開始」ボタンをクリック
5. リアルタイムで処理状況を確認
6. 結果を確認・コピー・ダウンロード

### 辞書管理（管理者のみ）

- 組織独自のNG表現/許可表現を追加・編集
- CSVでの一括インポート/エクスポート
- セマンティック検索による類似表現の検出

## アーキテクチャ

### データベース設計

```
organizations (組織)
├── users (ユーザー)
├── dictionaries (辞書)
└── checks (チェック履歴)
    └── violations (違反詳細)
```

### チェック処理フロー

1. **プリフィルタ**: pg_trgm による文字列類似度検索 (閾値: 0.3)
2. **セマンティック照合**: pgvectorによるベクトル類似度検索 (閾値: 0.75)
3. **LLM処理**: OpenAI GPTによる最終判定とリライト
4. **結果保存**: 違反箇所と修正文の保存

### リアルタイム通信

- **Server-Sent Events (SSE)** による片方向ストリーム
- 処理進捗の リアルタイム更新
- 完了時の詳細結果送信

## 開発

### プロジェクト構造

```
src/
├── app/                 # Next.js App Router
│   ├── api/            # API Routes
│   └── globals.css     # グローバルスタイル
├── components/         # React コンポーネント
│   ├── ui/            # UI コンポーネント
│   └── TextChecker.tsx # メインチェック機能
├── hooks/             # カスタムフック
├── lib/               # ユーティリティ
│   └── supabase/      # Supabase クライアント
└── types/             # TypeScript 型定義
```

### 主要なAPIエンドポイント

- `POST /api/checks` - チェック開始
- `GET /api/checks/[id]/stream` - SSEストリーム
- `GET /api/dictionaries` - 辞書一覧
- `POST /api/dictionaries` - 辞書追加

### 型安全性

- 厳密なTypeScript設定
- Supabase Database型定義
- Zodによるバリデーション

## デプロイ

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/adlex)

### 必要な設定

1. Vercel環境変数の設定
2. Supabaseプロジェクトの作成
3. OpenAI APIキーの取得
4. データベーススキーマの実行

## ライセンス

MIT License

## サポート

- [Issues](https://github.com/yourusername/adlex/issues)
- [ドキュメント](https://github.com/yourusername/adlex/wiki)

## テストアカウント

開発・テスト用のアカウントが用意されています。

### シードデータの実行

```bash
# Supabaseを起動
npm run supabase:start

# テストアカウントを作成
npm run seed
```

### テスト用アカウント情報

| 種別 | メールアドレス | パスワード | 組織 | 権限 |
|------|---------------|------------|------|------|
| 管理者 | admin@test.com | password123 | テスト組織A | 管理者 |
| 管理者 | manager@test.com | password123 | テスト組織B | 管理者 |
| 一般ユーザー | user1@test.com | password123 | テスト組織A | 一般ユーザー |
| 一般ユーザー | user2@test.com | password123 | テスト組織B | 一般ユーザー |

### 招待テスト用データ

テスト用の招待トークンも用意されています：

- `newuser@test.com`用: `test-invitation-token-123`
- `newadmin@test.com`用: `test-invitation-token-456`

招待承認URLの例：
```
http://localhost:3000/auth/invitation?token=test-invitation-token-123
```

### 組織情報

- **テスト組織A**: トライアル期間中（使用済み: 3回/200回）
- **テスト組織B**: ベーシックプラン（使用済み: 1回/1000回）
- **サンプル薬局**: トライアル期間中（使用済み: 0回/200回）

各組織には以下のテストデータが含まれています：
- 薬機法関連の辞書エントリ
- チェック履歴サンプル
- 違反検出の例
