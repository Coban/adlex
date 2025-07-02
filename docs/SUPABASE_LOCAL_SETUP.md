# Supabase ローカル開発環境

このプロジェクトは、Supabaseのローカル開発環境を使用してセットアップされています。

## 必要な環境

- Docker Desktop
- Node.js 18+
- Supabase CLI

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Supabaseローカル環境の起動

```bash
npm run supabase:start
```

または

```bash
supabase start
```

### 3. TypeScript型の生成

```bash
npm run supabase:types
```

## 利用可能なスクリプト

- `npm run supabase:start` - Supabaseローカル環境を起動
- `npm run supabase:stop` - Supabaseローカル環境を停止
- `npm run supabase:reset` - データベースをリセット
- `npm run supabase:status` - Supabaseサービスの状態を確認
- `npm run supabase:types` - TypeScript型を生成
- `npm run db:reset` - データベースをリセットして型を再生成

## ローカル環境URL

Supabaseローカル環境が起動すると、以下のURLでアクセスできます：

- **Supabase Studio**: http://127.0.0.1:54323
- **API**: http://127.0.0.1:54321
- **Database**: postgresql://postgres:postgres@127.0.0.1:54322/postgres

## 環境変数

`.env.local`ファイルにローカル開発用の環境変数が設定されています：

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

## データベース

初期スキーマは `supabase/migrations/20250616144502_initial_schema.sql` で定義されています。

### テーブル構成

- `organizations` - 組織情報
- `users` - ユーザー情報（Supabase Authと連携）
- `dictionaries` - 辞書エントリ
- `checks` - テキストチェック結果
- `violations` - 違反検出結果

### 機能

- Row Level Security (RLS) が有効
- vector検索（OpenAI embeddings）
- 類似テキスト検索（pg_trgm）
- 自動タイムスタンプ更新

## 開発フロー

1. Supabaseローカル環境を起動
2. Next.js開発サーバーを起動（`npm run dev`）
3. http://127.0.0.1:54323 でSupabase Studioにアクセス
4. データベースの変更は `supabase migration new` でマイグレーション作成
5. 型の変更後は `npm run supabase:types` で型を再生成

## トラブルシューティング

### Dockerコンテナが起動しない場合

```bash
docker system prune
supabase stop
supabase start
```

### データベースをリセットしたい場合

```bash
npm run db:reset
```

### 型が古い場合

```bash
npm run supabase:types
```
