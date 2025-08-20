import { RepositoryContainer } from '@/core/ports'

export interface GetDictionaryInput {
  dictionaryId: number
  currentUserId: string
}

export type GetDictionaryResult = {
  success: true
  data: {
    dictionary: {
      id: number
      phrase: string
      category: string
      notes?: string | null
      organization_id: number
      created_at?: string | null
      updated_at?: string | null
    }
  }
} | {
  success: false
  error: string
  code: 'AUTHENTICATION_ERROR' | 'AUTHORIZATION_ERROR' | 'NOT_FOUND_ERROR' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR'
}

export class GetDictionaryUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: GetDictionaryInput): Promise<GetDictionaryResult> {
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

      // 辞書項目を取得（組織による制限付き）
      const dictionary = await this.repositories.dictionaries.findByIdAndOrganization(
        dictionaryId, 
        userProfile.organization_id
      )
      
      if (!dictionary) {
        return {
          success: false,
          error: '辞書項目が見つかりません',
          code: 'NOT_FOUND_ERROR'
        }
      }

      return {
        success: true,
        data: { dictionary }
      }

    } catch (error) {
      console.error('Get dictionary usecase error:', error)
      return {
        success: false,
        error: 'サーバーエラーが発生しました',
        code: 'INTERNAL_ERROR'
      }
    }
  }
}