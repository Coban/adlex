import { RepositoryContainer } from '@/core/ports'

export interface DeleteDictionaryInput {
  dictionaryId: number
  currentUserId: string
}

export type DeleteDictionaryResult = {
  success: true
  data: {
    message: string
  }
} | {
  success: false
  error: string
  code: 'AUTHENTICATION_ERROR' | 'AUTHORIZATION_ERROR' | 'NOT_FOUND_ERROR' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR'
}

export class DeleteDictionaryUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: DeleteDictionaryInput): Promise<DeleteDictionaryResult> {
    try {
      const { dictionaryId, currentUserId } = input

      // dictionaryIdバリデーション
      if (isNaN(dictionaryId) || dictionaryId <= 0) {
        return {
          success: false,
          error: '無効なIDです',
          code: 'VALIDATION_ERROR'
        }
      }

      // ユーザープロファイルと組織情報を取得
      const userProfile = await this.repositories.users.findById(currentUserId)
      if (!userProfile?.organization_id) {
        return {
          success: false,
          error: 'ユーザープロファイルが見つかりません',
          code: 'AUTHENTICATION_ERROR'
        }
      }

      // 管理者権限チェック
      if (userProfile.role !== 'admin') {
        return {
          success: false,
          error: '管理者権限が必要です',
          code: 'AUTHORIZATION_ERROR'
        }
      }

      // 辞書項目が組織に属しているか確認
      const existingDictionary = await this.repositories.dictionaries.findByIdAndOrganization(
        dictionaryId, 
        userProfile.organization_id
      )
      
      if (!existingDictionary) {
        return {
          success: false,
          error: '辞書項目が見つかりません',
          code: 'NOT_FOUND_ERROR'
        }
      }

      // 削除実行
      const success = await this.repositories.dictionaries.delete(dictionaryId)
      if (!success) {
        return {
          success: false,
          error: '辞書項目の削除に失敗しました',
          code: 'INTERNAL_ERROR'
        }
      }

      return {
        success: true,
        data: {
          message: '辞書項目を削除しました'
        }
      }

    } catch (error) {
      console.error('Delete dictionary usecase error:', error)
      return {
        success: false,
        error: 'サーバーエラーが発生しました',
        code: 'INTERNAL_ERROR'
      }
    }
  }
}