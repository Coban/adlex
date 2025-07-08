# 薬機法チェック & リライト SaaS ― 要件定義書  
最終更新: 2025-06-11

---

## 1. 目的
EC 事業者やインフルエンサーが公開前の日本語文章を入力すると、薬機法（医薬品医療機器等法）に抵触する表現を検知し、安全な表現へ自動リライトできる Web サービス（SaaS）を提供する。  
- 行政指導・炎上リスクの低減  
- 文章作成〜レビュー〜公開までのワークフロー効率化  
- スモールスタートで固定費を最小化し、利用量連動で拡張

---

## 2. 想定ユーザー
| 区分 | 役割 | 主な操作 |
|------|------|---------|
| **組織管理者** | マーケ責任者 / 編集長 | ユーザー招待・課金管理・独自 NG 表現辞書管理・チェック実行 |
| **組織ユーザー** | ライター | テキスト入力・チェック実行・履歴閲覧 |

組織単位で契約し、1 組織に複数ユーザーが所属。

---

## 3. 提供形態
| フェーズ | 内容 |
|----------|------|
| **MVP (2025-09)** | Next.js 15（App Router, TypeScript）+ Vercel Hobby/Pro によるレスポンシブ Web SaaS |
| 将来 | Tauri デスクトップアプリ（Next.js UI のラッピング） |

---

## 4. 機能要件

### 4.1 テキスト入力
- 日本語のみ、最大 **10,000 文字／1 回**  
- 直接テキストエリアへ貼り付け（MVP）  
- 将来：ファイルアップロード（Word, Markdown 他）、URL クロール

### 4.2 薬機法チェック
1. **プリフィルタ**  
   - `pg_trgm` 類似度 ≥ **0.3** の辞書レコードを抽出（⩽ 1,000 件想定）  
2. **セマンティック照合**  
   - 入力文（文単位でスプリット）を embedding 化し、`vector` 距離 < **0.25** のレコードのみ抽出  
3. **LLM 呼び出し**  
   - **system**: 共通ルールを固定文で埋め込み  
   - **user**: 原文  
   - **tools**: `{"dictionary":[{phrase,category}]}` — *ステップ2で絞った 100 件程度*  
4. **function-call** で `{modified, violations[]}` JSON を取得  
5. 処理は非同期ジョブ化 ─ 平均応答 ≤ **5 s**

### 4.3 結果表示
- 原文と修正文を 2 カラム並列表示  
- 違反箇所をハイライト（色＋下線）  
- 差分ビュー切替（inline / side-by-side）

### 4.4 組織辞書管理
| 方法 | MVP | 将来 |
|------|-----|------|
| 管理 UI（1 件編集） | 〇 | 〇 |
| CSV インポート / エクスポート | 〇 | 〇 |
| API 登録 | – | △ 要望時追加 |

#### ストレージ

| カラム            | 型                  | 備考                       |
|------------------|---------------------|----------------------------|
| id               | bigint PK          |                            |
| organization_id  | bigint FK          |                            |
| phrase           | text               | 原表現                     |
| category         | enum('NG','ALLOW') | NG=違反候補, ALLOW=許可語 |
| notes            | text               | 管理者メモ                |
| vector           | vector(384)        | **pgvector** embedding     |
| created_at       | timestamp          |                            |
| updated_at       | timestamp          |                            |

- **pg_trgm** 拡張＋`GIN`インデックスで高速な文字列類似検索  
- **pgvector** 拡張＋`ivfflat`インデックスでセマンティック検索  
- 新規登録・更新時は Edge Function で embedding を自動生成し `vector` へ保存  
  - 失敗時は非同期リトライ（Upstash QStash キュー）

#### API 追加

- `POST /api/dictionaries/embeddings/refresh`  
  - 管理者が手動で再埋め込みをトリガー

### 4.5 履歴管理
- 原文 + 結果を **永続保存**  
- ユーザーは自分の履歴を削除可能（論理削除）  
- 管理者は組織全体を検索・削除可

### 4.6 組織 & 認証
- メール + パスワード (Supabase Auth)  
- ロール：`admin`, `user`  
- 管理者がユーザー招待・権限変更  
- 二段階認証：将来対応

### 4.7 通知・リアルタイム更新
- **Server-Sent Events (SSE)** による片方向ストリーム  
  - `/api/checks/{id}/stream` へ `EventSource` 接続  
  - サーバーが進捗・完了をプッシュ  
- クライアント→サーバー通信は通常 `fetch` を使用  
- 双方向リアルタイムが必要になった際は Supabase Realtime / Pusher などを追加導入

### 4.8 データエクスポート
- クリップボードコピー（原文／修正文／diff）  
- PDF レポート（ハイライト付き）ダウンロード（MVP）

### 4.9 課金 & 決済
| 項目 | 内容 |
|------|------|
| 無料トライアル | 30 日・1 組織 **200 チェック**まで |
| 基本料金 | **¥10,000 / 組織・月**（200 チェック込み） |
| 従量課金 | 超過 **¥60 / チェック** |
| 決済手段 | クレジットカード (Stripe または Pay.jp) / 銀行振込 |
| 請求 | 月次締め・翌月請求、日本円 |
| インボイス | PDF 請求書・領収書を自動発行しメール送付

---

## 5. 非機能要件

| 項目 | 要件 |
|------|------|
| 同時アクセス | ピーク 50 ユーザー |
| 性能 | 平均応答 ≤ 5 s／チェック |
| 月間処理量 | 10,000 チェック |
| 可用性 | 99.5 % / 月 |
| データ保護 | TLS1.2+, at-rest AES-256, 日本国内リージョン |
| バックアップ | DB スナップショット 1 回/日 + 7 日 PITR |
| ログ保持 | 90 日、自動ローテート |

---

## 6. インフラ構成（スモールスタート）

| レイヤ | サービス | 月額固定 | 備考 |
|--------|----------|---------|------|
| Web / API | **Vercel** Hobby ▶︎ Pro (US$20) | ¥0〜¥3,000 | Next.js App Router & Edge Functions |
| DB & Storage | **Supabase Free** ▶︎ Pro (US$25) | ¥0〜¥3,900 | Postgres 500 MB、Storage 1 GB |
| キュー & Pub/Sub | **Upstash** Redis & QStash (Free) | ¥0〜¥1,400 | Redis 25 MB, 10 GB egress |
| リアルタイム通知 | SSE (Edge Function) | — | WebSocket 不要 |
| LLM API | OpenAI GPT-4o | 従量 | ¥60 / チェック (モデル費用込み想定) |
| Vector DB | **Supabase Postgres (pgvector)** | **Pro** に含む | `vector` 型 + `ivfflat` |
| Embedding API | OpenAI `text-embedding-3-small` | 従量 | 1000 語 ≒ ¥2 |
| 監視 | Vercel Analytics + Supabase Logs | 無料 | 主要メトリクスのみ |

> 固定費：**¥0〜約 ¥8,300 / 月**（利用量に応じ段階的に課金）

---

## 7. LLM プロンプト設計

0. **前処理**: ステップ A+B で抽出した `dictionary` を JSON 添付  
1. **system**:  
   ```
   あなたは薬機法の専門家です。以下のルールに違反する表現を検出し...
   ```  
2. **user**: 原文  
3. **tools / function schema**:  
   ```json
   {
     "name": "apply_yakukiho_rules",
     "parameters": {
       "type": "object",
       "properties": {
         "modified": {"type":"string"},
         "violations": {
           "type":"array",
           "items": {
             "type":"object",
             "properties":{
               "start":{"type":"integer"},
               "end":{"type":"integer"},
               "reason":{"type":"string"},
               "dictionaryId":{"type":"integer"}
             },
             "required":["start","end","reason"]
           }
         }
       },
       "required":["modified","violations"]
     }
   }
 ```  
4. **assistant**: function call で JSON 返却

---

## 8. UI / UX

| 項目 | MVP |
|------|-----|
| フレームワーク | Next.js 15 + React Server Components |
| スタイル | Tailwind CSS + shadcn/ui |
| レスポンシブ | モバイル最小幅 375 px / PC 1280 px |
| 言語 | 日本語のみ（i18n 機構実装、将来多言語） |
| アクセシビリティ | WCAG 2.1 AA 相当 |

---

## 9. データモデル（簡易 ER）

~~~mermaid
erDiagram
    ORGANIZATIONS ||--o{ USERS : has
    ORGANIZATIONS ||--o{ DICTIONARIES : owns
    USERS ||--o{ CHECKS : submits
    CHECKS ||--|{ VIOLATIONS : contains
~~~

---

## 10. スケジュール

| マイルストーン | 期間 | 完了目標 |
|---------------|------|----------|
| 詳細設計・UI プロトタイプ | 2025-06〜07 | 07-末 |
| 実装 & 単体テスト | 2025-07〜08 | 08-末 |
| β テスト（招待制） | 2025-08 | 08-末 |
| 決済連携 & リリース準備 | 2025-08〜09 | 09-上旬 |
| **MVP リリース** | 2025-09 | 09-末 |

---

## 11. コスト試算（MVP）

| 項目 | 月額 | 備考 |
|------|------|------|
| 固定インフラ | ¥0〜¥8,300 | Vercel + Supabase + Upstash |
| LLM API 原価 | 10,000 checks × ¥60 ≒ **¥600,000** | 売上と比例 |
| Stripe 手数料 | 売上 10 万 → ¥3,500 | 3.6 % + ¥30 |
| **合計 (最大)** | **≈ ¥611,000** | ほぼ LLM 従量のみ |

※ チェック料金で LLM 原価を転嫁し、固定費は一桁万円以内に抑制。

---

## 12. リスクと対応

| リスク | 影響 | 対策 |
|--------|------|------|
| LLM 料金高騰 | 原価率上昇 | 小型日本語モデルで判定 → GPT-4o で修正 の二段階構成を検証 |
| Vercel Hobby 制限 | Cold-start & 帯域上限 | Pro へ自動アップグレード設定 |
| Supabase Free スリープ | 1 週間無操作で停止 | 毎晩 Cron Ping で防止 |
| 将来双方向リアルタイム要件 | SSE では不足 | Supabase Realtime 追加・Pusher 併用で拡張 |
| Embedding 再生成遅延 | 新語が即時検知されない | 更新トリガで Edge Function 非同期処理 + QStash リトライ |
| Similarity 閾値ミス | 過検出 / 見逃し | `trgm` & `vector` 閾値を AB テストで継続最適化 |
| GPT-4.1 料金変動 | コスト不安定 | 4o ↔ 4.1 を Usage-Based で自動切替 |

---
