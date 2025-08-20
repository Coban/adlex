import { AuthenticationError, ValidationError } from '@/core/domain/errors'
import { RepositoryContainer } from '@/core/ports'

/**
 * 画像アップロードのユースケース入力
 */
export interface UploadImageInput {
  currentUserId: string
  file: File
}

/**
 * 画像アップロードのユースケース出力
 */
export interface UploadImageOutput {
  signedUrl: string
}

/**
 * 画像アップロードのユースケース結果
 */
export type UploadImageResult = 
  | { success: true; data: UploadImageOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * 画像アップロードユースケース
 */
export class UploadImageUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: UploadImageInput): Promise<UploadImageResult> {
    try {
      // 入力バリデーション
      const validationError = this.validateInput(input)
      if (validationError) {
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: validationError }
        }
      }

      // 現在のユーザーを取得
      const currentUser = await this.repositories.users.findById(input.currentUserId)
      if (!currentUser) {
        return {
          success: false,
          error: { code: 'AUTHENTICATION_ERROR', message: 'ユーザーが見つかりません' }
        }
      }

      if (!currentUser.organization_id) {
        return {
          success: false,
          error: { code: 'AUTHENTICATION_ERROR', message: 'ユーザーが組織に所属していません' }
        }
      }

      // ファイルのバリデーション
      const fileValidationError = this.validateFile(input.file)
      if (fileValidationError) {
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: fileValidationError }
        }
      }

      // ファイルパスの生成
      const filePath = this.generateFilePath(currentUser.organization_id, input.file)

      // ファイルのアップロード（ストレージリポジトリ経由）
      const arrayBuffer = await input.file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      const uploadResult = await this.repositories.storage.uploadFile(
        'uploads',
        filePath,
        uint8Array,
        { 
          contentType: input.file.type, 
          upsert: false 
        }
      )

      if (uploadResult.error) {
        console.error('Upload error:', uploadResult.error)
        return {
          success: false,
          error: { code: 'REPOSITORY_ERROR', message: 'ファイルのアップロードに失敗しました' }
        }
      }

      // 署名付きURLの生成（1時間有効）
      const signedUrlResult = await this.repositories.storage.createSignedUrl(
        'uploads',
        filePath,
        60 * 60 // 1時間
      )

      if (signedUrlResult.error || !signedUrlResult.data?.signedUrl) {
        console.error('Signed URL error:', signedUrlResult.error)
        return {
          success: false,
          error: { code: 'REPOSITORY_ERROR', message: '署名付きURLの生成に失敗しました' }
        }
      }

      return {
        success: true,
        data: {
          signedUrl: signedUrlResult.data.signedUrl
        }
      }

    } catch (error) {
      console.error('Upload image usecase error:', error)
      
      if (error instanceof AuthenticationError || error instanceof ValidationError) {
        return {
          success: false,
          error: { code: error.code, message: error.message }
        }
      }

      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '内部エラーが発生しました' }
      }
    }
  }

  /**
   * 入力値のバリデーション
   */
  private validateInput(input: UploadImageInput): string | null {
    if (!input.currentUserId || typeof input.currentUserId !== 'string') {
      return 'ユーザーIDが無効です'
    }

    if (!input.file || !(input.file instanceof File)) {
      return 'ファイルが必要です'
    }

    return null
  }

  /**
   * ファイルのバリデーション
   */
  private validateFile(file: File): string | null {
    // サポートされているファイルタイプ
    const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!acceptedTypes.includes(file.type)) {
      return 'サポートされていないファイルタイプです（JPEG、PNG、WebPのみ）'
    }

    // ファイルサイズの制限（10MB）
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return 'ファイルサイズが大きすぎます（最大10MBまで）'
    }

    return null
  }

  /**
   * ファイルパスの生成
   * パス形式: org/{orgId}/{yyyy}/{mm}/{dd}/{timestamp}-{random}.ext
   */
  private generateFilePath(organizationId: number, file: File): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const timestamp = now.getTime()
    const random = Math.random().toString(36).slice(2, 8)
    
    // ファイル拡張子の決定
    let extension = 'jpg'
    if (file.type === 'image/png') {
      extension = 'png'
    } else if (file.type === 'image/webp') {
      extension = 'webp'
    }

    return `org/${organizationId}/${year}/${month}/${day}/${timestamp}-${random}.${extension}`
  }
}