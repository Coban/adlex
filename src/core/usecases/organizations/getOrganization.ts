import { AuthenticationError, AuthorizationError } from '@/core/domain/errors'
import { RepositoryContainer } from '@/core/ports'

/**
 * 組織取得のユースケース入力
 */
export interface GetOrganizationInput {
  currentUserId: string
  organizationId: string
}

/**
 * 組織取得のユースケース出力
 */
export interface GetOrganizationOutput {
  id: string
  name: string
  plan: string
  max_users: number
  max_checks_per_month: number
  icon_url?: string | null
  logo_url?: string | null
  created_at: string
  updated_at?: string | null
}

/**
 * 組織取得のユースケース結果
 */
export type GetOrganizationResult = 
  | { success: true; data: GetOrganizationOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * 組織取得ユースケース
 */
export class GetOrganizationUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: GetOrganizationInput): Promise<GetOrganizationResult> {
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

      // 対象組織の取得
      const organization = await this.repositories.organizations.findById(input.organizationId)
      if (!organization) {
        return {
          success: false,
          error: { code: 'NOT_FOUND_ERROR', message: '組織が見つかりません' }
        }
      }

      // ユーザーが対象組織に所属しているか確認（管理者は自組織のみ参照可能）
      if (organization.id.toString() !== currentUser.organization_id.toString()) {
        return {
          success: false,
          error: { code: 'AUTHORIZATION_ERROR', message: 'この組織を参照する権限がありません' }
        }
      }

      return {
        success: true,
        data: {
          id: organization.id.toString(),
          name: organization.name,
          plan: organization.plan ?? 'trial',
          max_users: organization.max_checks ?? 10, // max_checksをmax_usersとして扱う（DBスキーマの不整合）
          max_checks_per_month: organization.max_checks ?? 1000,
          icon_url: organization.icon_url,
          logo_url: organization.logo_url,
          created_at: organization.created_at ?? new Date().toISOString(),
          updated_at: organization.updated_at
        }
      }

    } catch (error) {
      console.error('Get organization usecase error:', error)
      
      if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
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
  private validateInput(input: GetOrganizationInput): string | null {
    if (!input.currentUserId || typeof input.currentUserId !== 'string') {
      return 'ユーザーIDが無効です'
    }

    if (!input.organizationId || typeof input.organizationId !== 'string') {
      return '組織IDが無効です'
    }

    return null
  }
}