# LM Studio使用ガイド

このプロジェクトでは、OpenAI APIの代わりにローカルのLM Studioを使用することができます。

## 設定方法

### 1. 環境変数の設定

`.env.local`ファイルで以下の設定を行います：

```bash
# LM Studio Configuration (for local development)
USE_LM_STUDIO=true
LM_STUDIO_BASE_URL=http://localhost:1234/v1
LM_STUDIO_API_KEY=lm-studio
# 推奨：構造化出力対応モデル
LM_STUDIO_CHAT_MODEL=qwen/qwen2.5-14b-instruct
LM_STUDIO_EMBEDDING_MODEL=nomic-embed-text-v1.5
```

### 2. LM Studioの起動

1. LM Studioアプリケーションを起動
2. チャット用のモデル（例：Llama 3.3, Qwen など）をロード
3. Embedding用のモデル（例：all-MiniLM-L6-v2, nomic-embed-text など）をロード
4. ローカルサーバーを起動（通常はポート1234）

### 3. モデルの設定

#### チャットモデル
- 日本語対応の大規模言語モデルを推奨
- 薬機法チェックタスクには以下が適している：
  - Llama 3.3 70B（高性能）
  - Qwen2.5 32B（中性能）
  - Llama 3.1 8B（軽量）

#### Embeddingモデル
- 多言語対応のembeddingモデルを推奨
- 384次元のモデルを使用する場合：
  - all-MiniLM-L6-v2
  - nomic-embed-text-v1.5
- **重要**: データベースのvector列は384次元で設定されています

### 4. データベース設定の調整

LM Studioで異なる次元のembeddingモデルを使用する場合は、データベースのマイグレーションが必要です。

#### 768次元のモデルを使用する場合

```sql
-- 新しいマイグレーションファイルを作成
-- supabase/migrations/change_vector_dimension.sql

ALTER TABLE dictionaries ALTER COLUMN vector TYPE VECTOR(768);
```

#### 1536次元のモデルを使用する場合

```sql
ALTER TABLE dictionaries ALTER COLUMN vector TYPE VECTOR(1536);
```

マイグレーション実行：
```bash
supabase db reset
```

### 5. ai-client.tsの設定調整

`src/lib/ai-client.ts`の`getEmbeddingDimension()`関数で、使用するembeddingモデルの次元を正しく設定してください：

```typescript
export function getEmbeddingDimension(): number {
  if (USE_LM_STUDIO) {
    // 使用するLM Studioのembeddingモデルに合わせて調整
    return 384 // all-MiniLM-L6-v2の場合
    // return 768 // nomic-embed-text-v1.5の場合
    // return 1536 // OpenAI text-embedding-3-largeの場合
  } else {
    return 1536 // OpenAI text-embedding-3-small
  }
}
```

## 推奨構成

### 構造化出力対応モデル（推奨）

薬機法チェックでは正確な位置情報が重要です。以下のモデルは構造化出力に対応しており、より正確な結果が期待できます：

**高性能構成（32GB+ RAM）**
- チャット：`qwen/qwen2.5-32b-instruct` または `microsoft/phi-3.5-mini-instruct`
- Embedding：`nomic-embed-text-v1.5`（768次元）

**中性能構成（16GB RAM）**
- チャット：`qwen/qwen2.5-14b-instruct` または `microsoft/phi-3-mini-128k-instruct`
- Embedding：`nomic-embed-text-v1.5`（768次元）

**軽量構成（8GB RAM）**
- チャット：`microsoft/phi-3-mini-4k-instruct` または `microsoft/phi-3.5-mini-instruct`
- Embedding：`all-MiniLM-L6-v2`（384次元）

### 非推奨モデル

以下のモデルは構造化出力の精度が低く、位置情報が不正確になる可能性があります：
- `google/gemma-3-12b`（デフォルト）
- 7B未満のモデル全般

## 注意事項

1. **Embedding次元の一致**: データベースのvector列の次元と、LM Studioのembeddingモデルの次元を一致させる必要があります。

2. **日本語対応**: 薬機法チェックは日本語の文章を処理するため、日本語に対応したモデルを選択してください。

3. **構造化出力**: 薬機法チェックでは正確な位置情報が必要です。構造化出力に対応したモデルを使用してください。

4. **性能**: ローカルモデルはOpenAI GPT-4oと比較して性能が劣る場合があります。薬機法チェックの精度を維持するため、適切なモデル選択が重要です。

## トラブルシューティング

### LM Studioに接続できない
- LM Studioサーバーが起動しているか確認
- ポート番号（通常1234）が正しいか確認
- ファイアウォール設定を確認

### Embedding次元エラー
- データベースのvector列の次元を確認
- `getEmbeddingDimension()`の返り値を確認
- 必要に応じてデータベースマイグレーションを実行

### 位置情報が不正確
- 構造化出力対応モデルを使用しているか確認
- `google/gemma-3-12b`から推奨モデルに変更
- モデルのパラメータ数を確認（14B以上推奨）

### 日本語処理の問題
- 日本語対応モデルを使用しているか確認
- プロンプトのエンコーディングを確認