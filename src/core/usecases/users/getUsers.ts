import { AuthenticationError, ValidationError, AuthorizationError } from '@/core/domain/errors'
import { RepositoryContainer } from '@/core/ports'

/**
 * ユーザー一覧取得のユースケース入力
 */
export interface GetUsersInput {
  currentUserId: string
  search?: string
  role?: 'admin' | 'user' | 'ALL'
  organizationId?: number
}

/**
 * ユーザー一覧取得のユースケース出力
 */
export interface GetUsersOutput {
  users: Array<{
    id: string
    email: string
    displayName: string | null
    role: 'admin' | 'user'
    organizationId: number
    createdAt: string
    updatedAt: string
  }>
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/**
 * ユーザー一覧取得のユースケース結果
 */
export type GetUsersResult = 
  | { success: true; data: GetUsersOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * ユーザー一覧取得ユースケース
 */
export class GetUsersUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: GetUsersInput): Promise<GetUsersResult> {
    try {
      // 入力バリデーション
      const validationError = this.validateInput(input)
      if (validationError) {
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: validationError }
        }
      }

      // 現在のユーザーを取得して権限確認
      const currentUser = await this.repositories.users.findById(input.currentUserId)
      if (!currentUser) {
        return {
          success: false,
          error: { code: 'AUTHENTICATION_ERROR', message: 'ユーザーが見つかりません' }
        }
      }

      // 管理者権限確認
      if (currentUser.role !== 'admin') {
        return {
          success: false,
          error: { code: 'AUTHORIZATION_ERROR', message: '管理者権限が必要です' }
        }
      }

      const organizationId = input.organizationId ?? currentUser.organization_id
      if (!organizationId) {
        return {
          success: false,
          error: { code: 'AUTHORIZATION_ERROR', message: 'ユーザーが組織に属していません' }
        }
      }

      // 組織のアクセス権限確認
      if (currentUser.organization_id !== organizationId) {
        return {
          success: false,
          error: { code: 'AUTHORIZATION_ERROR', message: '組織へのアクセス権限がありません' }
        }
      }

      // ユーザー検索実行
      const users = await this.repositories.users.findByOrganizationId(organizationId)

      // フィルタリング
      let filteredUsers = users

      if (input.search) {
        filteredUsers = users.filter(user => 
          user.email?.toLowerCase().includes(input.search!.toLowerCase())
        )
      }

      if (input.role && input.role !== 'ALL') {
        filteredUsers = filteredUsers.filter(user => user.role === input.role)
      }

      // レスポンス形式に変換
      const formattedUsers = filteredUsers.map(user => ({
        id: user.id,
        email: user.email ?? '',
        displayName: null, // display_name field doesn't exist in database
        role: user.role as 'admin' | 'user',
        organizationId: user.organization_id!,
        createdAt: user.created_at ?? '',
        updatedAt: user.updated_at ?? ''
      }))

      // ページネーション情報（簡易版）
      const pagination = {
        page: 1,
        limit: filteredUsers.length,
        total: filteredUsers.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      }

      return {
        success: true,
        data: {
          users: formattedUsers,
          pagination
        }
      }

    } catch (error) {
      console.error('Get users usecase error:', error)
      
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
  private validateInput(input: GetUsersInput): string | null {
    if (!input.currentUserId || typeof input.currentUserId !== 'string') {
      return 'ユーザーIDが無効です'
    }

    if (input.organizationId && typeof input.organizationId !== 'number') {
      return '組織IDが無効です'
    }

    if (input.search && typeof input.search !== 'string') {
      return '検索語が無効です'
    }

    if (input.role && !['admin', 'user', 'ALL'].includes(input.role)) {
      return 'ロールが無効です'
    }

    return null
  }
}