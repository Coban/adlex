import { RepositoryContainer } from '@/core/ports'

export interface CancelCheckInput {
  checkId: number
  currentUserId: string
}

export type CancelCheckResult = {
  success: true
  data: {
    checkId: number
    message: string
  }
} | {
  success: false
  error: string
  code: 'AUTHENTICATION_ERROR' | 'AUTHORIZATION_ERROR' | 'NOT_FOUND_ERROR' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR'
}

export class CancelCheckUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: CancelCheckInput): Promise<CancelCheckResult> {
    try {
      const { checkId, currentUserId } = input

      // checkIdバリデーション
      if (isNaN(checkId) || checkId <= 0) {
        return {
          success: false,
          error: '不正なチェックIDです',
          code: 'VALIDATION_ERROR'
        }
      }

      // チェックデータを取得
      const checkData = await this.repositories.checks.findById(checkId)
      if (!checkData) {
        return {
          success: false,
          error: 'チェックが見つかりません',
          code: 'NOT_FOUND_ERROR'
        }
      }

      // ユーザーの権限確認
      const userProfile = await this.repositories.users.findById(currentUserId)
      if (!userProfile) {
        return {
          success: false,
          error: 'ユーザーが見つかりません',
          code: 'AUTHENTICATION_ERROR'
        }
      }

      // アクセス権限チェック
      const hasAccess = 
        userProfile.role === 'admin' ||
        (userProfile.role === 'user' && checkData.user_id === currentUserId)
      
      const sameOrg = userProfile.organization_id === checkData.organization_id

      if (!hasAccess || !sameOrg) {
        return {
          success: false,
          error: 'このチェックをキャンセルする権限がありません',
          code: 'AUTHORIZATION_ERROR'
        }
      }

      // キャンセル可能な状態かチェック
      if (checkData.status !== 'pending' && checkData.status !== 'processing') {
        return {
          success: false,
          error: `キャンセルできません。現在のステータス: ${checkData.status}`,
          code: 'VALIDATION_ERROR'
        }
      }

      // チェックをキャンセル（failedステータスに更新）
      const updatedCheck = await this.repositories.checks.update(checkId, {
        status: 'failed',
        error_message: 'ユーザーによってキャンセルされました',
        completed_at: new Date().toISOString()
      })

      if (!updatedCheck) {
        return {
          success: false,
          error: 'チェックのキャンセルに失敗しました',
          code: 'INTERNAL_ERROR'
        }
      }

      return {
        success: true,
        data: {
          checkId,
          message: 'チェックが正常にキャンセルされました'
        }
      }

    } catch (error) {
      console.error('Cancel check usecase error:', error)
      return {
        success: false,
        error: 'サーバーエラーが発生しました',
        code: 'INTERNAL_ERROR'
      }
    }
  }
}