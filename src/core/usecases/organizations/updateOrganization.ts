import { AuthenticationError, AuthorizationError, ValidationError } from '@/core/domain/errors'
import { RepositoryContainer } from '@/core/ports'

/**
 * 組織更新のユースケース入力
 */
export interface UpdateOrganizationInput {
  currentUserId: string
  organizationId: string
  updates: {
    name?: string
    plan?: 'trial' | 'basic'
    max_users?: number
    max_checks_per_month?: number
  }
}

/**
 * 組織更新のユースケース出力
 */
export interface UpdateOrganizationOutput {
  id: string
  name: string
  plan: string
  max_users: number
  max_checks_per_month: number
  message: string
}

/**
 * 組織更新のユースケース結果
 */
export type UpdateOrganizationResult = 
  | { success: true; data: UpdateOrganizationOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * 組織更新ユースケース
 */
export class UpdateOrganizationUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: UpdateOrganizationInput): Promise<UpdateOrganizationResult> {
    try {
      // 入力バリデーション
      const validationError = this.validateInput(input)
      if (validationError) {
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: validationError }
        }
      }

      // 現在のユーザーを取得
      const currentUser = await this.repositories.users.findById(input.currentUserId)
      if (!currentUser) {
        return {
          success: false,
          error: { code: 'AUTHENTICATION_ERROR', message: 'ユーザーが見つかりません' }
        }
      }

      if (!currentUser.organization_id) {
        return {
          success: false,
          error: { code: 'AUTHENTICATION_ERROR', message: 'ユーザーが組織に所属していません' }
        }
      }

      // 管理者権限チェック
      if (currentUser.role !== 'admin') {
        return {
          success: false,
          error: { code: 'AUTHORIZATION_ERROR', message: '管理者権限が必要です' }
        }
      }

      // 組織IDを数値に変換
      const organizationId = parseInt(input.organizationId, 10)
      if (isNaN(organizationId)) {
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '組織IDが無効です' }
        }
      }

      // 対象組織の存在確認
      const organization = await this.repositories.organizations.findById(organizationId)
      if (!organization) {
        return {
          success: false,
          error: { code: 'NOT_FOUND_ERROR', message: '組織が見つかりません' }
        }
      }

      // ユーザーが対象組織に所属しているか確認
      if (organization.id !== currentUser.organization_id) {
        return {
          success: false,
          error: { code: 'AUTHORIZATION_ERROR', message: 'この組織を更新する権限がありません' }
        }
      }

      // 更新実行
      const updatedOrganization = await this.repositories.organizations.update(
        organizationId,
        input.updates
      )

      if (!updatedOrganization) {
        return {
          success: false,
          error: { code: 'REPOSITORY_ERROR', message: '組織の更新に失敗しました' }
        }
      }

      return {
        success: true,
        data: {
          id: updatedOrganization.id.toString(),
          name: updatedOrganization.name,
          plan: updatedOrganization.plan ?? 'trial',
          max_users: updatedOrganization.max_checks ?? 500,
          max_checks_per_month: updatedOrganization.max_checks ?? 500,
          message: '組織情報を更新しました'
        }
      }

    } catch (error) {
      console.error('Update organization usecase error:', error)
      
      if (error instanceof AuthenticationError || error instanceof AuthorizationError || error instanceof ValidationError) {
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
  private validateInput(input: UpdateOrganizationInput): string | null {
    if (!input.currentUserId || typeof input.currentUserId !== 'string') {
      return 'ユーザーIDが無効です'
    }

    if (!input.organizationId || typeof input.organizationId !== 'string') {
      return '組織IDが無効です'
    }

    if (!input.updates || typeof input.updates !== 'object') {
      return '更新データが無効です'
    }

    // 少なくとも1つの更新フィールドが必要
    const hasUpdates = input.updates.name !== undefined ||
                      input.updates.plan !== undefined ||
                      input.updates.max_users !== undefined ||
                      input.updates.max_checks_per_month !== undefined

    if (!hasUpdates) {
      return '更新するフィールドを指定してください'
    }

    if (input.updates.name !== undefined) {
      if (typeof input.updates.name !== 'string' || input.updates.name.trim().length === 0) {
        return '組織名は1文字以上である必要があります'
      }
      if (input.updates.name.length > 100) {
        return '組織名は100文字以下である必要があります'
      }
    }

    if (input.updates.plan !== undefined) {
      if (!['trial', 'basic'].includes(input.updates.plan)) {
        return 'プランは "trial" または "basic" である必要があります'
      }
    }

    if (input.updates.max_users !== undefined) {
      if (typeof input.updates.max_users !== 'number' || 
          !Number.isInteger(input.updates.max_users) || 
          input.updates.max_users <= 0) {
        return '最大ユーザー数は正の整数である必要があります'
      }
    }

    if (input.updates.max_checks_per_month !== undefined) {
      if (typeof input.updates.max_checks_per_month !== 'number' || 
          !Number.isInteger(input.updates.max_checks_per_month) || 
          input.updates.max_checks_per_month <= 0) {
        return '月間最大チェック数は正の整数である必要があります'
      }
    }

    return null
  }
}