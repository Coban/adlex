import { AuthenticationError, ValidationError, AuthorizationError } from '@/core/domain/errors'
import { RepositoryContainer } from '@/core/ports'

/**
 * 辞書一括更新のユースケース入力
 */
export interface BulkUpdateDictionariesInput {
  currentUserId: string
  updates: Array<{
    id: number
    patch: {
      phrase?: string
      category?: 'NG' | 'ALLOW'
      notes?: string | null
    }
  }>
}

/**
 * 辞書一括更新のユースケース出力
 */
export interface BulkUpdateDictionariesOutput {
  success: number
  failure: number
  message: string
}

/**
 * 辞書一括更新のユースケース結果
 */
export type BulkUpdateDictionariesResult = 
  | { success: true; data: BulkUpdateDictionariesOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * 辞書一括更新ユースケース
 */
export class BulkUpdateDictionariesUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: BulkUpdateDictionariesInput): Promise<BulkUpdateDictionariesResult> {
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

      // 管理者権限チェック
      if (currentUser.role !== 'admin') {
        return {
          success: false,
          error: { code: 'AUTHORIZATION_ERROR', message: '管理者権限が必要です' }
        }
      }

      // 一括更新の実行
      let successCount = 0
      let failureCount = 0

      for (const update of input.updates) {
        try {
          // 組織に属する辞書アイテムかを検証
          const existingItem = await this.repositories.dictionaries.findByIdAndOrganization(
            update.id, 
            currentUser.organization_id
          )
          
          if (!existingItem) {
            failureCount++
            continue
          }

          // 更新データの準備
          const updateData = {
            ...update.patch,
            updated_at: new Date().toISOString()
          }

          // 更新実行
          const updatedItem = await this.repositories.dictionaries.update(update.id, updateData)
          if (updatedItem) {
            successCount++
          } else {
            failureCount++
          }
        } catch (error) {
          console.error(`Error updating dictionary item ${update.id}:`, error)
          failureCount++
        }
      }

      return {
        success: true,
        data: {
          success: successCount,
          failure: failureCount,
          message: `${successCount}件の更新が成功し、${failureCount}件が失敗しました`
        }
      }

    } catch (error) {
      console.error('Bulk update dictionaries usecase error:', error)
      
      if (error instanceof AuthenticationError || error instanceof ValidationError || error instanceof AuthorizationError) {
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
  private validateInput(input: BulkUpdateDictionariesInput): string | null {
    if (!input.currentUserId || typeof input.currentUserId !== 'string') {
      return 'ユーザーIDが無効です'
    }

    if (!input.updates || !Array.isArray(input.updates) || input.updates.length === 0) {
      return '更新対象が必要です'
    }

    for (const update of input.updates) {
      if (!update.id || typeof update.id !== 'number' || update.id <= 0) {
        return '無効な辞書IDが含まれています'
      }

      if (!update.patch || typeof update.patch !== 'object') {
        return '更新データが無効です'
      }

      if (update.patch.phrase !== undefined && (!update.patch.phrase || update.patch.phrase.trim().length === 0)) {
        return 'フレーズは1文字以上である必要があります'
      }

      if (update.patch.category !== undefined && !['NG', 'ALLOW'].includes(update.patch.category)) {
        return 'カテゴリは "NG" または "ALLOW" である必要があります'
      }
    }

    return null
  }
}