import { AuthenticationError, ValidationError } from '@/core/domain/errors'
import { RepositoryContainer } from '@/core/ports'
import { queueManager } from '@/lib/queue-manager'

/**
 * チェック作成のユースケース入力
 */
export interface CreateCheckInput {
  userId: string
  organizationId: number
  originalText: string
  inputType: 'text' | 'image'
  fileName?: string
}

/**
 * チェック作成のユースケース出力
 */
export interface CreateCheckOutput {
  checkId: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  message?: string
}

/**
 * チェック作成のユースケース結果
 */
export type CreateCheckResult = 
  | { success: true; data: CreateCheckOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * チェック作成ユースケース
 * テキストまたは画像の薬機法チェックを作成し、処理キューに追加する
 */
export class CreateCheckUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: CreateCheckInput): Promise<CreateCheckResult> {
    try {
      // 入力バリデーション
      const validationError = this.validateInput(input)
      if (validationError) {
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: validationError }
        }
      }

      // ユーザー存在確認と権限チェック
      const user = await this.repositories.users.findById(input.userId)
      if (!user) {
        return {
          success: false,
          error: { code: 'AUTHENTICATION_ERROR', message: 'ユーザーが見つかりません' }
        }
      }

      if (user.organization_id !== input.organizationId) {
        return {
          success: false,
          error: { code: 'AUTHORIZATION_ERROR', message: '組織へのアクセス権限がありません' }
        }
      }

      // チェックレコード作成
      const newCheck = await this.repositories.checks.create({
        user_id: input.userId,
        organization_id: input.organizationId,
        original_text: input.originalText,
        input_type: input.inputType,
        status: 'pending',
        created_at: new Date().toISOString()
      })

      if (!newCheck) {
        return {
          success: false,
          error: { code: 'REPOSITORY_ERROR', message: 'チェックレコードの作成に失敗しました' }
        }
      }

      // キューに処理を追加
      try {
        await queueManager.addToQueue(
          newCheck.id,
          input.originalText,
          input.organizationId,
          'normal',
          input.inputType
        )
      } catch {
        // キューエラーの場合、チェックレコードは作成済みなので状態を更新
        await this.repositories.checks.update(newCheck.id, { 
          status: 'failed',
          error_message: 'キュー追加に失敗しました'
        })
        
        return {
          success: false,
          error: { code: 'QUEUE_ERROR', message: '処理キューへの追加に失敗しました' }
        }
      }

      return {
        success: true,
        data: {
          checkId: newCheck.id,
          status: newCheck.status as 'pending',
          message: 'チェック処理をキューに追加しました'
        }
      }

    } catch (error) {
      console.error('Create check usecase error:', error)
      
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
  private validateInput(input: CreateCheckInput): string | null {
    if (!input.userId || typeof input.userId !== 'string') {
      return 'ユーザーIDが無効です'
    }

    if (!input.organizationId || typeof input.organizationId !== 'number') {
      return '組織IDが無効です'
    }

    if (!input.originalText || typeof input.originalText !== 'string') {
      return 'テキストが無効です'
    }

    if (input.originalText.length > 10000) {
      return 'テキストが長すぎます（最大10,000文字）'
    }

    if (!['text', 'image'].includes(input.inputType)) {
      return '入力タイプが無効です'
    }

    if (input.fileName && typeof input.fileName !== 'string') {
      return 'ファイル名が無効です'
    }

    return null
  }
}