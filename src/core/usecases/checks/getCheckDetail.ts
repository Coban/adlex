import { RepositoryContainer } from '@/core/ports'

export interface GetCheckDetailInput {
  checkId: number
  currentUserId: string
}

export type GetCheckDetailResult = {
  success: true
  data: {
    check: {
      id: number
      originalText: string
      modifiedText: string | null
      status: 'pending' | 'processing' | 'completed' | 'failed' | null
      inputType: 'text' | 'image' | null
      imageUrl: string | null
      extractedText: string | null
      ocrStatus: string | null
      ocrMetadata: Record<string, unknown> | null
      createdAt: string | null
      completedAt: string | null
      userEmail: string | null | undefined
      violations: Array<{
        id: number
        startPos: number | null | undefined
        endPos: number | null | undefined
        reason: string | null | undefined
        dictionaryPhrase: string | null | undefined
        dictionaryCategory: string | null | undefined
      }>
    }
  }
} | {
  success: false
  error: string
  code: 'AUTHENTICATION_ERROR' | 'AUTHORIZATION_ERROR' | 'NOT_FOUND_ERROR' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR'
}

export class GetCheckDetailUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: GetCheckDetailInput): Promise<GetCheckDetailResult> {
    try {
      const { checkId, currentUserId } = input

      // checkIdバリデーション
      if (isNaN(checkId) || checkId <= 0) {
        return {
          success: false,
          error: 'Invalid check ID',
          code: 'VALIDATION_ERROR'
        }
      }

      // ユーザーデータと組織情報を取得
      const userData = await this.repositories.users.findById(currentUserId)
      if (!userData?.organization_id) {
        return {
          success: false,
          error: 'User not found or not in organization',
          code: 'AUTHENTICATION_ERROR'
        }
      }

      // チェック詳細と違反情報を取得
      const check = await this.repositories.checks.findByIdWithDetailedViolations(
        checkId, 
        userData.organization_id
      )
      
      if (!check) {
        return {
          success: false,
          error: 'Check not found',
          code: 'NOT_FOUND_ERROR'
        }
      }

      // アクセス権限チェック
      if (userData.role === 'user' && check.user_id !== userData.id) {
        return {
          success: false,
          error: 'Forbidden',
          code: 'AUTHORIZATION_ERROR'
        }
      }

      // レスポンス形式に変換
      const formattedCheck = {
        id: check.id,
        originalText: check.original_text,
        modifiedText: check.modified_text,
        status: check.status,
        inputType: check.input_type,
        imageUrl: check.image_url,
        extractedText: check.extracted_text,
        ocrStatus: check.ocr_status,
        ocrMetadata: check.ocr_metadata,
        createdAt: check.created_at,
        completedAt: check.completed_at,
        userEmail: check.users?.email,
        violations: check.violations?.map(violation => ({
          id: violation.id,
          startPos: violation.start_pos,
          endPos: violation.end_pos,
          reason: violation.reason,
          dictionaryPhrase: violation.dictionaries?.phrase,
          dictionaryCategory: violation.dictionaries?.category
        })) ?? []
      }

      return {
        success: true,
        data: { check: formattedCheck }
      } as GetCheckDetailResult

    } catch (error) {
      console.error('Get check detail usecase error:', error)
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }
    }
  }
}