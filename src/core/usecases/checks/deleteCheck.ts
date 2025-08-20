import { RepositoryContainer } from '@/core/ports'

export interface DeleteCheckInput {
  checkId: number
  currentUserId: string
}

export type DeleteCheckResult = {
  success: true
  data: {
    message: string
  }
} | {
  success: false
  error: string
  code: 'AUTHENTICATION_ERROR' | 'AUTHORIZATION_ERROR' | 'NOT_FOUND_ERROR' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR'
}

export class DeleteCheckUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: DeleteCheckInput): Promise<DeleteCheckResult> {
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

      // チェックを取得して所有権と存在を確認
      const check = await this.repositories.checks.findById(checkId)
      if (!check || check.organization_id !== userData.organization_id || check.deleted_at) {
        return {
          success: false,
          error: 'Check not found',
          code: 'NOT_FOUND_ERROR'
        }
      }

      // アクセス権限チェック - ユーザーは自分のチェックのみ削除可、管理者は全て削除可
      if (userData.role === 'user' && check.user_id !== userData.id) {
        return {
          success: false,
          error: 'Forbidden',
          code: 'AUTHORIZATION_ERROR'
        }
      }

      // 論理削除の実行
      const deletedCheck = await this.repositories.checks.logicalDelete(checkId)
      if (!deletedCheck) {
        return {
          success: false,
          error: 'Failed to delete check',
          code: 'INTERNAL_ERROR'
        }
      }

      return {
        success: true,
        data: {
          message: 'Check deleted successfully'
        }
      }

    } catch (error) {
      console.error('Delete check usecase error:', error)
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }
    }
  }
}