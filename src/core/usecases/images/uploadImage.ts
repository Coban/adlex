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
  | { success: false; error: { code: string; message: string; details?: unknown } }

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
      let arrayBuffer: ArrayBuffer
      let uint8Array: Uint8Array
      
      try {
        arrayBuffer = await input.file.arrayBuffer()
        uint8Array = new Uint8Array(arrayBuffer)
      } catch (error) {
        console.error('ファイル読み込みエラー:', { error, fileName: input.file.name, fileSize: input.file.size })
        return {
          success: false,
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'ファイルの読み込みに失敗しました',
            details: { fileName: input.file.name, fileSize: input.file.size }
          }
        }
      }

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
        console.error('アップロードエラー:', { 
          error: uploadResult.error, 
          filePath, 
          organizationId: currentUser.organization_id,
          fileSize: input.file.size,
          contentType: input.file.type
        })
        return {
          success: false,
          error: { 
            code: 'REPOSITORY_ERROR', 
            message: 'ファイルのアップロードに失敗しました',
            details: { 
              filePath, 
              errorType: uploadResult.error.name ?? 'UnknownError',
              fileSize: input.file.size 
            }
          }
        }
      }

      // 署名付きURLの生成（1時間有効）
      const signedUrlResult = await this.repositories.storage.createSignedUrl(
        'uploads',
        filePath,
        60 * 60 // 1時間
      )

      if (signedUrlResult.error || !signedUrlResult.data?.signedUrl) {
        console.error('署名付きURL生成エラー:', { 
          error: signedUrlResult.error, 
          filePath, 
          organizationId: currentUser.organization_id,
          hasData: !!signedUrlResult.data,
          signedUrlValue: signedUrlResult.data?.signedUrl
        })
        
        // アップロードしたファイルのクリーンアップを試行（ベストエフォート）
        try {
          await this.repositories.storage.deleteFile('uploads', filePath)
          console.info('署名付きURL生成失敗後のファイルクリーンアップ完了:', filePath)
        } catch (cleanupError) {
          console.warn('ファイルクリーンアップに失敗:', { cleanupError, filePath })
        }
        
        return {
          success: false,
          error: { 
            code: 'REPOSITORY_ERROR', 
            message: '署名付きURLの生成に失敗しました',
            details: { 
              filePath,
              errorType: signedUrlResult.error?.name ?? 'UnknownError',
              hasData: !!signedUrlResult.data
            }
          }
        }
      }

      return {
        success: true,
        data: {
          signedUrl: signedUrlResult.data.signedUrl
        }
      }

    } catch (error) {
      console.error('Upload image usecase 予期しないエラー:', { 
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorName: error instanceof Error ? error.name : 'Unknown',
        userId: input.currentUserId,
        fileName: input.file?.name,
        fileSize: input.file?.size,
        contentType: input.file?.type
      })
      
      if (error instanceof AuthenticationError || error instanceof ValidationError) {
        return {
          success: false,
          error: { 
            code: error.code, 
            message: error.message,
            details: { 
              errorType: error.name,
              userId: input.currentUserId 
            }
          }
        }
      }

      return {
        success: false,
        error: { 
          code: 'INTERNAL_ERROR', 
          message: '内部エラーが発生しました',
          details: {
            errorType: error instanceof Error ? error.name : 'UnknownError',
            userId: input.currentUserId,
            hasFile: !!input.file
          }
        }
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