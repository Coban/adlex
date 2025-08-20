import { AuthenticationError, ValidationError } from '@/core/domain/errors'
import { RepositoryContainer } from '@/core/ports'

/**
 * 辞書一覧取得のユースケース入力
 */
export interface GetDictionariesInput {
  userId: string
  organizationId?: number
  search?: string
  category?: 'NG' | 'ALLOW' | 'ALL'
}

/**
 * 辞書一覧取得のユースケース出力
 */
export interface GetDictionariesOutput {
  dictionaries: Array<{
    id: number
    phrase: string
    category: string
    notes: string | null
    createdAt: string
    updatedAt: string | null
  }>
  total: number
}

/**
 * 辞書一覧取得のユースケース結果
 */
export type GetDictionariesResult = 
  | { success: true; data: GetDictionariesOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * 辞書一覧取得ユースケース
 */
export class GetDictionariesUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: GetDictionariesInput): Promise<GetDictionariesResult> {
    try {
      // 入力バリデーション
      const validationError = this.validateInput(input)
      if (validationError) {
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: validationError }
        }
      }

      // ユーザー存在確認と組織ID取得
      const user = await this.repositories.users.findById(input.userId)
      if (!user) {
        return {
          success: false,
          error: { code: 'AUTHENTICATION_ERROR', message: 'ユーザーが見つかりません' }
        }
      }

      const organizationId = input.organizationId ?? user.organization_id
      if (!organizationId) {
        return {
          success: false,
          error: { code: 'AUTHORIZATION_ERROR', message: 'ユーザーが組織に属していません' }
        }
      }

      if (user.organization_id !== organizationId) {
        return {
          success: false,
          error: { code: 'AUTHORIZATION_ERROR', message: '組織へのアクセス権限がありません' }
        }
      }

      // 辞書検索実行
      const dictionaries = await this.repositories.dictionaries.searchDictionaries({
        organizationId,
        search: input.search,
        category: input.category
      })

      // レスポンス形式に変換
      const formattedDictionaries = dictionaries.map(dict => ({
        id: dict.id,
        phrase: dict.phrase,
        category: dict.category,
        notes: dict.notes,
        createdAt: dict.created_at ?? '',
        updatedAt: dict.updated_at
      }))

      return {
        success: true,
        data: {
          dictionaries: formattedDictionaries,
          total: dictionaries.length
        }
      }

    } catch (error) {
      console.error('Get dictionaries usecase error:', error)
      
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
  private validateInput(input: GetDictionariesInput): string | null {
    if (!input.userId || typeof input.userId !== 'string') {
      return 'ユーザーIDが無効です'
    }

    if (input.organizationId && typeof input.organizationId !== 'number') {
      return '組織IDが無効です'
    }

    if (input.search && typeof input.search !== 'string') {
      return '検索語が無効です'
    }

    if (input.category && !['NG', 'ALLOW', 'ALL'].includes(input.category)) {
      return 'カテゴリが無効です'
    }

    return null
  }
}