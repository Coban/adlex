# 画像アップロードAPI仕様

## 概要
薬機法チェック用画像をSupabase Storageにアップロードし、署名付きURLを返すセキュアなAPIです。

## エンドポイント
```
POST /api/images/upload
```

## 認証
- Supabase認証が必要
- ユーザーは組織に所属している必要があります

## リクエスト形式
- Content-Type: `multipart/form-data`
- パラメータ：
  - `image`: 画像ファイル（必須）

## サポートファイル形式
- JPEG (`image/jpeg`)
- PNG (`image/png`) 
- WebP (`image/webp`)

## ファイルサイズ制限
- 最大10MB

## レスポンス

### 成功時（200 OK）
```json
{
  "signedUrl": "https://example.supabase.co/storage/v1/object/sign/uploads/org/123/2025/01/20/1642680000000-abc123.jpg?token=..."
}
```

### エラー時
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "サポートされていないファイルタイプです（JPEG、PNG、WebPのみ）"
  }
}
```

## エラーコード
- `AUTHENTICATION_ERROR` (401): 認証エラー
- `VALIDATION_ERROR` (400): バリデーションエラー
- `REPOSITORY_ERROR` (500): ストレージエラー
- `INTERNAL_ERROR` (500): その他の内部エラー

## アーキテクチャ
Clean Architectureパターンを採用：
- **API Route**: `/src/app/api/images/upload/route.ts`
- **UseCase**: `/src/core/usecases/images/uploadImage.ts`
- **DTO**: `/src/core/dtos/images.ts`

## ファイル保存形式
```
uploads/org/{organizationId}/{yyyy}/{mm}/{dd}/{timestamp}-{random}.{ext}
```

例: `uploads/org/123/2025/01/20/1642680000000-abc123.jpg`

## 署名付きURL
- 有効期限: 1時間
- プライベートアクセス（認証必要）

## 使用技術
- Next.js 15 API Routes
- Supabase Storage
- TypeScript
- Zod（バリデーション）