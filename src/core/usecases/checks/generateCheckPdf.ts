import { RepositoryContainer } from '@/core/ports'

export interface GenerateCheckPdfInput {
  checkId: number
  currentUserId: string
}

export interface CheckWithDetails {
  id: number
  original_text: string | null
  modified_text: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed' | null
  created_at: string | null
  completed_at: string | null
  user_id: string
  organization_id: number
  input_type: 'text' | 'image' | null
  image_url: string | null
  extracted_text: string | null
  users?: { email?: string | null } | null
  violations?: Array<{
    id: number
    start_pos: number
    end_pos: number
    reason: string
    dictionaries?: { phrase?: string | null; category?: 'NG' | 'ALLOW' | null } | null
  }> | null
}

export type GenerateCheckPdfResult = {
  success: true
  data: {
    check: CheckWithDetails
    filename: string
  }
} | {
  success: false
  error: string
  code: 'AUTHENTICATION_ERROR' | 'AUTHORIZATION_ERROR' | 'NOT_FOUND_ERROR' | 'BAD_REQUEST_ERROR' | 'INTERNAL_ERROR'
}

export class GenerateCheckPdfUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: GenerateCheckPdfInput): Promise<GenerateCheckPdfResult> {
    try {
      const { checkId, currentUserId } = input

      // checkId バリデーション
      if (isNaN(checkId) || checkId <= 0) {
        return {
          success: false,
          error: '不正なチェックIDです',
          code: 'BAD_REQUEST_ERROR'
        }
      }

      // ユーザー認証・認可チェック
      const userData = await this.repositories.users.findById(currentUserId)
      if (!userData?.organization_id) {
        return {
          success: false,
          error: 'ユーザーが見つかりません',
          code: 'NOT_FOUND_ERROR'
        }
      }

      // チェック詳細取得（違反含む）
      const check = await this.repositories.checks.findByIdWithDetailedViolations(checkId, userData.organization_id)
      if (!check) {
        return {
          success: false,
          error: 'チェックが見つかりません',
          code: 'NOT_FOUND_ERROR'
        }
      }

      // アクセス権限チェック
      if (userData.role === 'user' && check.user_id !== userData.id) {
        return {
          success: false,
          error: 'このチェックへのアクセス権限がありません',
          code: 'AUTHORIZATION_ERROR'
        }
      }

      const filename = `check_${check.id}.pdf`

      return {
        success: true,
        data: {
          check: check as CheckWithDetails,
          filename
        }
      }

    } catch (error) {
      console.error('Generate check PDF usecase error:', error)
      return {
        success: false,
        error: 'サーバーエラーが発生しました',
        code: 'INTERNAL_ERROR'
      }
    }
  }
}