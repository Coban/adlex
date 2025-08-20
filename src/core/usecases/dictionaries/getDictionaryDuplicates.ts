import { RepositoryContainer } from '@/core/ports'

export interface GetDictionaryDuplicatesInput {
  currentUserId: string
}

export interface DuplicateGroup {
  phrase: string
  items: Array<{
    id: number
    phrase: string
    category: 'NG' | 'ALLOW'
    notes: string | null
    created_at: string
  }>
}

export type GetDictionaryDuplicatesResult = {
  success: true
  data: {
    duplicates: DuplicateGroup[]
  }
} | {
  success: false
  error: string
  code: 'AUTHENTICATION_ERROR' | 'AUTHORIZATION_ERROR' | 'NOT_FOUND_ERROR' | 'INTERNAL_ERROR'
}

export class GetDictionaryDuplicatesUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: GetDictionaryDuplicatesInput): Promise<GetDictionaryDuplicatesResult> {
    try {
      const { currentUserId } = input

      // ユーザー認証・認可チェック
      const userProfile = await this.repositories.users.findById(currentUserId)
      if (!userProfile?.organization_id) {
        return {
          success: false,
          error: 'ユーザープロファイルが見つかりません',
          code: 'NOT_FOUND_ERROR'
        }
      }

      if (userProfile.role !== 'admin') {
        return {
          success: false,
          error: '管理者権限が必要です',
          code: 'AUTHORIZATION_ERROR'
        }
      }

      // 組織の辞書項目を取得（phrase順でソート）
      const dictionaryItems = await this.repositories.dictionaries.findByOrganizationId(
        userProfile.organization_id,
        {
          orderBy: [{ field: 'phrase', direction: 'asc' }]
        }
      )

      // 同一phraseの重複検出
      const phraseGroups = new Map<string, typeof dictionaryItems>()
      for (const item of dictionaryItems) {
        const normalizedPhrase = (item.phrase ?? '').trim()
        if (!phraseGroups.has(normalizedPhrase)) {
          phraseGroups.set(normalizedPhrase, [])
        }
        phraseGroups.get(normalizedPhrase)!.push(item)
      }

      // 重複のみ抽出
      const duplicates = Array.from(phraseGroups.entries())
        .filter(([, items]) => items.length > 1)
        .map(([phrase, items]) => ({
          phrase,
          items: items.map(item => ({
            id: item.id,
            phrase: item.phrase ?? '',
            category: item.category,
            notes: item.notes,
            created_at: item.created_at ?? ''
          }))
        }))

      return {
        success: true,
        data: { duplicates }
      }

    } catch (error) {
      console.error('Get dictionary duplicates usecase error:', error)
      return {
        success: false,
        error: 'サーバーエラーが発生しました',
        code: 'INTERNAL_ERROR'
      }
    }
  }
}