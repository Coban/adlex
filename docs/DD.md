# 詳細設計書 - RiskMill

最終更新: 2025-06-11

## 1. 概要

`RiskMill` は薬機法チェックと自動リライトを提供する SaaS です。要件定義書 `REQUIREMENTS_DEFINITION.md` に基づき、Next.js と Supabase を用いた Web アプリとして実装されています。本ドキュメントでは現在の実装を踏まえた詳細設計を記載します。

## 2. システム構成

- **フロントエンド**: Next.js 15 (App Router) + TypeScript
- **スタイリング**: Tailwind CSS、shadcn/ui
- **バックエンド**: Next.js API Routes
- **データベース**: Supabase Postgres (pgvector / pg_trgm 拡張)
- **認証**: Supabase Auth
- **AI 連携**: OpenAI GPT-4o、開発環境では LM Studio も利用可
- **リアルタイム通信**: Server-Sent Events (SSE)

## 3. データベース設計

データモデルは要件定義書の ER 図および `database/init.sql` に基づきます。主なテーブルは以下の通りです。

| テーブル | 主なカラム | 用途 |
|----------|-----------|------|
| `organizations` | `id`, `name`, `plan`, `max_checks`, `used_checks` | 契約組織を管理 |
| `users` | `id`, `email`, `organization_id`, `role` | Supabase Auth と連動したユーザー情報 |
| `dictionaries` | `id`, `organization_id`, `phrase`, `category`, `vector` | NG/ALLOW 表現辞書 |
| `checks` | `id`, `user_id`, `organization_id`, `original_text`, `modified_text`, `status` | チェック履歴 |
| `violations` | `id`, `check_id`, `start_pos`, `end_pos`, `reason`, `dictionary_id` | 違反詳細 |

各テーブルには `updated_at` 自動更新トリガーが設定され、RLS ポリシーで組織単位のアクセス制御を行います【F:database/init.sql†L1-L160】【F:database/init.sql†L160-L320】。

## 4. チェック処理フロー

1. クライアントから `/api/checks` へ POST（認証必須）。
2. サーバーで `checks` レコードを作成し、ステータスを `pending` で保存。
3. 非同期に `processCheck()` を実行。
   - 辞書を pgvector 類似度で絞り込み。
   - OpenAI API（または LM Studio）へプロンプトを送り、function calling またはプレーンテキスト応答から `{modified, violations[]}` を取得。
   - `violations` テーブルへ挿入し、`checks` を `completed` に更新。
   - `organizations.used_checks` をインクリメント。
4. `/api/checks/[id]/stream` から SSE で進捗・完了データを配信。
5. クライアントの `TextChecker` コンポーネントが SSE を購読し、結果を表示。

実装は `src/app/api/checks/route.ts` および `src/app/api/checks/[id]/stream/route.ts` で確認できます【F:src/app/api/checks/route.ts†L1-L176】【F:src/app/api/checks/[id]/stream/route.ts†L1-L95】。

## 5. フロントエンド構成

- `src/app/` 以下に Next.js App Router のルートを配置。
- `components/TextChecker.tsx` がテキスト入力・結果表示の主要 UI を提供します【F:src/components/TextChecker.tsx†L1-L104】【F:src/components/TextChecker.tsx†L320-L639】。
- `contexts/AuthContext.tsx` で Supabase Auth の状態を管理し、`useAuth` フックから利用します。
- 辞書管理ページやユーザー招待ページなど管理者向け UI も実装済みです。

## 6. API 一覧（抜粋）

| メソッド | パス | 用途 |
|----------|------|------|
| `POST` | `/api/checks` | チェックリクエストを作成し処理を開始 |
| `GET` | `/api/checks/[id]/stream` | SSE による進捗・結果取得 |
| `GET/POST` | `/api/dictionaries` | 辞書の取得・登録 |
| `POST` | `/api/dictionaries/embeddings/refresh` | embedding 再生成 |

## 7. セキュリティ・認可

- Supabase RLS を用いて、ユーザーは自組織のデータのみ閲覧・更新可能。
- API では `supabase.auth.getUser()` を利用し、未認証リクエストは 401 を返却。
- `users.role` により管理者権限を判定し、辞書管理・ユーザー招待等の操作を制限します。

## 8. 今後の拡張ポイント

`docs/TODO.md` に示されている通り、以下の機能が未実装または改善予定です。

- CSV インポート/エクスポートや PDF レポート生成
- 履歴一覧や課金・決済連携
- セマンティック照合の精度向上、非同期ジョブ処理の最適化

要件定義書で示された性能要件（平均応答 ≤ 5s）や課金機能などは今後の課題として残っています。

---

以上が現時点の詳細設計です。実装変更に合わせて本ドキュメントも更新してください。
