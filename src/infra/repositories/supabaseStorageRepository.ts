import { SupabaseClient } from '@supabase/supabase-js'

import { 
  StorageRepository, 
  UploadResult, 
  SignedUrlResult, 
  DeleteResult, 
  PublicUrlResult, 
  UploadOptions,
  StorageResult
} from '@/core/ports/storage'
import { Database } from '@/types/database.types'

/**
 * Supabaseストレージリポジトリ実装
 */
export class SupabaseStorageRepository implements StorageRepository {
  constructor(private client: SupabaseClient<Database>) {}

  /**
   * ファイルをアップロード
   */
  async uploadFile(
    bucket: string, 
    path: string, 
    file: Uint8Array, 
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .upload(path, file, {
          contentType: options.contentType,
          upsert: options.upsert ?? false,
          duplex: options.duplex
        })

      if (error) {
        return { data: null, error }
      }

      return { 
        data: { path: data.path }, 
        error: null 
      }
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error : new Error('Unknown upload error') 
      }
    }
  }

  /**
   * 署名付きURLを作成
   */
  async createSignedUrl(
    bucket: string, 
    path: string, 
    expiresIn: number
  ): Promise<SignedUrlResult> {
    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn)

      if (error) {
        return { data: null, error }
      }

      if (!data?.signedUrl) {
        return { 
          data: null, 
          error: new Error('署名付きURLの生成に失敗しました') 
        }
      }

      return { 
        data: { signedUrl: data.signedUrl }, 
        error: null 
      }
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error : new Error('Unknown signed URL error') 
      }
    }
  }

  /**
   * ファイルを削除
   */
  async deleteFile(bucket: string, path: string): Promise<DeleteResult> {
    try {
      const { error } = await this.client.storage
        .from(bucket)
        .remove([path])

      if (error) {
        return { data: null, error }
      }

      return { 
        data: { message: 'ファイルを正常に削除しました' }, 
        error: null 
      }
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error : new Error('Unknown delete error') 
      }
    }
  }

  /**
   * 公開URLを取得
   */
  getPublicUrl(bucket: string, path: string): PublicUrlResult {
    const { data } = this.client.storage
      .from(bucket)
      .getPublicUrl(path)

    return { data: { publicUrl: data.publicUrl } }
  }

  /**
   * ファイル一覧を取得
   */
  async listFiles(
    bucket: string, 
    path?: string, 
    options: { limit?: number; offset?: number } = {}
  ): Promise<StorageResult<{ name: string; id: string; updated_at: string; created_at: string; last_accessed_at: string; metadata: Record<string, unknown> }[]>> {
    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .list(path, {
          limit: options.limit,
          offset: options.offset
        })

      if (error) {
        return { data: null, error }
      }

      return { data: data || [], error: null }
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error : new Error('Unknown list error') 
      }
    }
  }
}