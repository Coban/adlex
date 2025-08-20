import { AuthenticationError, ValidationError, AuthorizationError } from '@/core/domain/errors'
import { RepositoryContainer } from '@/core/ports'

/**
 * ユーザー役割更新のユースケース入力
 */
export interface UpdateUserRoleInput {
  currentUserId: string
  targetUserId: string
  role: 'admin' | 'user'
}

/**
 * ユーザー役割更新のユースケース出力
 */
export interface UpdateUserRoleOutput {
  user: {
    id: string
    email: string
    role: 'admin' | 'user'
    updated_at: string | null
  }
  message: string
}

/**
 * ユーザー役割更新のユースケース結果
 */
export type UpdateUserRoleResult = 
  | { success: true; data: UpdateUserRoleOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * ユーザー役割更新ユースケース
 */
export class UpdateUserRoleUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: UpdateUserRoleInput): Promise<UpdateUserRoleResult> {
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

      // 管理者権限チェック
      if (currentUser.role !== 'admin') {
        return {
          success: false,
          error: { code: 'AUTHORIZATION_ERROR', message: '管理者権限が必要です' }
        }
      }

      // 自分自身の権限は変更できないチェック
      if (input.currentUserId === input.targetUserId) {
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '自分自身の権限は変更できません' }
        }
      }

      // 対象ユーザーの取得
      const targetUser = await this.repositories.users.findById(input.targetUserId)
      if (!targetUser) {
        return {
          success: false,
          error: { code: 'NOT_FOUND_ERROR', message: '対象ユーザーが見つかりません' }
        }
      }

      // 同じ組織のユーザーかチェック
      if (targetUser.organization_id !== currentUser.organization_id) {
        return {
          success: false,
          error: { code: 'AUTHORIZATION_ERROR', message: '同じ組織のユーザーのみ権限変更できます' }
        }
      }

      // ユーザーの権限を更新
      const updatedUser = await this.repositories.users.updateRole(input.targetUserId, input.role)
      if (!updatedUser) {
        return {
          success: false,
          error: { code: 'REPOSITORY_ERROR', message: 'ユーザー権限の変更に失敗しました' }
        }
      }

      return {
        success: true,
        data: {
          user: {
            id: updatedUser.id!,
            email: updatedUser.email!,
            role: updatedUser.role as 'admin' | 'user',
            updated_at: updatedUser.updated_at
          },
          message: 'ユーザー権限が更新されました'
        }
      }

    } catch (error) {
      console.error('Update user role usecase error:', error)
      
      if (error instanceof AuthenticationError || error instanceof ValidationError || error instanceof AuthorizationError) {
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
  private validateInput(input: UpdateUserRoleInput): string | null {
    if (!input.currentUserId || typeof input.currentUserId !== 'string') {
      return '現在のユーザーIDが無効です'
    }

    if (!input.targetUserId || typeof input.targetUserId !== 'string') {
      return '対象ユーザーIDが無効です'
    }

    if (!['admin', 'user'].includes(input.role)) {
      return '無効な役割です'
    }

    return null
  }
}