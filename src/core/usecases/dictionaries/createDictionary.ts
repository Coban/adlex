import { AuthenticationError, ValidationError } from '@/core/domain/errors'
import { RepositoryContainer } from '@/core/ports'

/**
 * 辞書作成のユースケース入力
 */
export interface CreateDictionaryInput {
  userId: string
  organizationId: number
  phrase: string
  category: 'NG' | 'ALLOW'
  reasoning?: string
}

/**
 * 辞書作成のユースケース出力
 */
export interface CreateDictionaryOutput {
  dictionaryId: number
  phrase: string
  category: string
  message: string
}

/**
 * 辞書作成のユースケース結果
 */
export type CreateDictionaryResult = 
  | { success: true; data: CreateDictionaryOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * 辞書作成ユースケース
 */
export class CreateDictionaryUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: CreateDictionaryInput): Promise<CreateDictionaryResult> {
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

      // 重複チェック（簡易実装 - 実際のfindByPhraseメソッドが必要）
      const existingEntries = await this.repositories.dictionaries.findByOrganizationId(
        input.organizationId
      )

      // 実際には phrase で絞り込み検索をする必要があります
      const duplicateEntry = existingEntries.find(entry => 
        entry.phrase.toLowerCase() === input.phrase.toLowerCase().trim()
      )
      
      if (duplicateEntry) {
        return {
          success: false,
          error: { code: 'CONFLICT_ERROR', message: 'この語句は既に登録されています' }
        }
      }

      // 辞書エントリ作成
      const newEntry = await this.repositories.dictionaries.create({
        organization_id: input.organizationId,
        phrase: input.phrase.trim(),
        category: input.category,
        notes: input.reasoning ?? null,
        created_at: new Date().toISOString()
      })

      if (!newEntry) {
        return {
          success: false,
          error: { code: 'REPOSITORY_ERROR', message: '辞書エントリの作成に失敗しました' }
        }
      }

      return {
        success: true,
        data: {
          dictionaryId: newEntry.id,
          phrase: newEntry.phrase,
          category: newEntry.category,
          message: '辞書エントリを作成しました'
        }
      }

    } catch (error) {
      console.error('Create dictionary usecase error:', error)
      
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
  private validateInput(input: CreateDictionaryInput): string | null {
    if (!input.userId || typeof input.userId !== 'string') {
      return 'ユーザーIDが無効です'
    }

    if (!input.organizationId || typeof input.organizationId !== 'number') {
      return '組織IDが無効です'
    }

    if (!input.phrase || typeof input.phrase !== 'string') {
      return '語句が無効です'
    }

    if (input.phrase.trim().length === 0) {
      return '語句は空にできません'
    }

    if (input.phrase.length > 200) {
      return '語句が長すぎます（最大200文字）'
    }

    if (!['NG', 'ALLOW'].includes(input.category)) {
      return 'カテゴリが無効です'
    }

    if (input.reasoning && input.reasoning.length > 1000) {
      return '理由が長すぎます（最大1000文字）'
    }

    return null
  }
}