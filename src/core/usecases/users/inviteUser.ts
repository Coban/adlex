import { AuthenticationError, ValidationError, ConflictError } from '@/core/domain/errors'
import { RepositoryContainer } from '@/core/ports'

/**
 * ユーザー招待のユースケース入力
 */
export interface InviteUserInput {
  currentUserId: string
  email: string
  role: 'admin' | 'user'
}

/**
 * ユーザー招待のユースケース出力
 */
export interface InviteUserOutput {
  invitationId: number
  email: string
  role: string
  message: string
}

/**
 * ユーザー招待のユースケース結果
 */
export type InviteUserResult = 
  | { success: true; data: InviteUserOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * ユーザー招待ユースケース
 * 組織への新しいユーザーを招待する
 */
export class InviteUserUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: InviteUserInput): Promise<InviteUserResult> {
    try {
      // 入力バリデーション
      const validationError = this.validateInput(input)
      if (validationError) {
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: validationError }
        }
      }

      // 現在のユーザーの権限確認
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
          error: { code: 'AUTHORIZATION_ERROR', message: 'ユーザーが組織に属していません' }
        }
      }

      if (currentUser.role !== 'admin') {
        return {
          success: false,
          error: { code: 'AUTHORIZATION_ERROR', message: '管理者権限が必要です' }
        }
      }

      // 既存ユーザー確認
      const existingUser = await this.repositories.users.findByEmail(input.email)
      if (existingUser) {
        return {
          success: false,
          error: { code: 'CONFLICT_ERROR', message: 'このメールアドレスは既に登録されています' }
        }
      }

      // 既存の招待確認
      const activeInvitation = await this.repositories.userInvitations.findActiveInvitationByEmail(
        input.email,
        currentUser.organization_id
      )

      if (activeInvitation) {
        return {
          success: false,
          error: { code: 'CONFLICT_ERROR', message: 'このメールアドレスには既にアクティブな招待が送信されています' }
        }
      }

      // 招待作成
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7) // 7日後に期限切れ

      const invitation = await this.repositories.userInvitations.create({
        organization_id: currentUser.organization_id,
        email: input.email,
        role: input.role,
        invited_by: input.currentUserId,
        expires_at: expiresAt.toISOString(),
        token: crypto.randomUUID(),
        created_at: new Date().toISOString()
      })

      if (!invitation) {
        return {
          success: false,
          error: { code: 'REPOSITORY_ERROR', message: '招待の作成に失敗しました' }
        }
      }

      // TODO: メール送信処理を追加
      // await emailService.sendInvitation(invitation)

      return {
        success: true,
        data: {
          invitationId: invitation.id,
          email: invitation.email,
          role: invitation.role ?? 'user',
          message: '招待メールを送信しました'
        }
      }

    } catch (error) {
      console.error('Invite user usecase error:', error)
      
      if (error instanceof AuthenticationError || error instanceof ValidationError || error instanceof ConflictError) {
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
  private validateInput(input: InviteUserInput): string | null {
    if (!input.currentUserId || typeof input.currentUserId !== 'string') {
      return 'ユーザーIDが無効です'
    }

    if (!input.email || typeof input.email !== 'string') {
      return 'メールアドレスが無効です'
    }

    // 簡単なメールアドレス形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(input.email)) {
      return 'メールアドレスの形式が正しくありません'
    }

    if (!['admin', 'user'].includes(input.role)) {
      return 'ロールが無効です'
    }

    return null
  }
}