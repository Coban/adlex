/**
 * ストレージ操作の結果型
 */
export interface StorageResult<T = unknown> {
  data: T | null
  error: Error | null
}

/**
 * ファイルアップロードのオプション
 */
export interface UploadOptions {
  contentType?: string
  upsert?: boolean
  duplex?: 'half'
}

/**
 * ファイルアップロードの結果
 */
export type UploadResult = StorageResult<{ path: string }>

/**
 * 署名付きURL作成の結果
 */
export type SignedUrlResult = StorageResult<{ signedUrl: string }>

/**
 * ファイル削除の結果
 */
export type DeleteResult = StorageResult<{ message: string }>

/**
 * 公開URL取得の結果（同期操作）
 */
export interface PublicUrlResult {
  data: { publicUrl: string }
}

/**
 * ストレージリポジトリインターフェース
 * ファイルのアップロード、ダウンロード、削除などの操作を抽象化
 */
export interface StorageRepository {
  /**
   * ファイルをアップロード
   * @param bucket バケット名
   * @param path ファイルパス
   * @param file ファイルデータ
   * @param options アップロードオプション
   * @returns アップロード結果
   */
  uploadFile(
    bucket: string, 
    path: string, 
    file: Uint8Array, 
    options?: UploadOptions
  ): Promise<UploadResult>

  /**
   * 署名付きURLを作成（プライベートファイルアクセス用）
   * @param bucket バケット名
   * @param path ファイルパス
   * @param expiresIn 有効期限（秒）
   * @returns 署名付きURL結果
   */
  createSignedUrl(
    bucket: string, 
    path: string, 
    expiresIn: number
  ): Promise<SignedUrlResult>

  /**
   * ファイルを削除
   * @param bucket バケット名
   * @param path ファイルパス
   * @returns 削除結果
   */
  deleteFile(bucket: string, path: string): Promise<DeleteResult>

  /**
   * 公開URLを取得（パブリックファイル用）
   * @param bucket バケット名
   * @param path ファイルパス
   * @returns 公開URL結果
   */
  getPublicUrl(bucket: string, path: string): PublicUrlResult

  /**
   * ファイル一覧を取得
   * @param bucket バケット名
   * @param path フォルダパス（オプション）
   * @param options 検索オプション
   * @returns ファイル一覧結果
   */
  listFiles?(
    bucket: string, 
    path?: string, 
    options?: { limit?: number; offset?: number }
  ): Promise<StorageResult<{ name: string; id: string; updated_at: string; created_at: string; last_accessed_at: string; metadata: Record<string, unknown> }[]>>
}