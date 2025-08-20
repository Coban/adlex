import { RepositoryContainer } from '@/core/ports'

export interface UpdateDictionaryInput {
  dictionaryId: number
  currentUserId: string
  phrase: string
  category: 'NG' | 'ALLOW'
  notes?: string
}

export type UpdateDictionaryResult = {
  success: true
  data: {
    id: number
    phrase: string
    category: string
    notes?: string | null
    message: string
  }
} | {
  success: false
  error: string
  code: 'AUTHENTICATION_ERROR' | 'AUTHORIZATION_ERROR' | 'NOT_FOUND_ERROR' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR'
}

export class UpdateDictionaryUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: UpdateDictionaryInput): Promise<UpdateDictionaryResult> {
    try {
      const { dictionaryId, currentUserId, phrase, category, notes } = input

      // dictionaryIdバリデーション
      if (isNaN(dictionaryId) || dictionaryId <= 0) {
        return {
          success: false,
          error: '無効なIDです',
          code: 'VALIDATION_ERROR'
        }
      }

      // フレーズバリデーション
      if (!phrase?.trim()) {
        return {
          success: false,
          error: 'フレーズは必須です',
          code: 'VALIDATION_ERROR'
        }
      }

      // カテゴリバリデーション
      if (!['NG', 'ALLOW'].includes(category)) {
        return {
          success: false,
          error: '無効なカテゴリです',
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

      // 埋め込みベクトル付き更新
      await this.repositories.dictionaries.updateWithEmbedding(
        dictionaryId,
        userProfile.organization_id,
        {
          phrase,
          category,
          notes
        }
      )

      // レスポンスを期待される形式に変換
      return {
        success: true,
        data: {
          id: dictionaryId,
          phrase,
          category,
          notes,
          message: '辞書項目を更新しました'
        }
      }

    } catch (error) {
      console.error('Update dictionary usecase error:', error)
      return {
        success: false,
        error: 'サーバーエラーが発生しました',
        code: 'INTERNAL_ERROR'
      }
    }
  }
}