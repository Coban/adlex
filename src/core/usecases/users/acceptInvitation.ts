import { RepositoryContainer } from '@/core/ports'

export interface AcceptInvitationInput {
  token: string
  password: string
}

export type AcceptInvitationResult = {
  success: true
  data: {
    message: string
    user: {
      id: string
      email: string
    }
  }
} | {
  success: false
  error: string
  code: 'VALIDATION_ERROR' | 'NOT_FOUND_ERROR' | 'CONFLICT_ERROR' | 'INTERNAL_ERROR'
}

export class AcceptInvitationUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: AcceptInvitationInput): Promise<AcceptInvitationResult> {
    try {
      const { token, password } = input

      // バリデーション
      if (!token || !password) {
        return {
          success: false,
          error: 'トークンとパスワードが必要です',
          code: 'VALIDATION_ERROR'
        }
      }

      if (password.length < 6) {
        return {
          success: false,
          error: 'パスワードは6文字以上である必要があります',
          code: 'VALIDATION_ERROR'
        }
      }

      // 有効な招待を確認
      const invitation = await this.repositories.userInvitations.findByToken(token)
      if (!invitation || !this.repositories.userInvitations.isInvitationValid(invitation)) {
        return {
          success: false,
          error: '無効または期限切れの招待リンクです',
          code: 'NOT_FOUND_ERROR'
        }
      }

      // 既にユーザーが存在するかチェック
      const existingUser = await this.repositories.users.findByEmail(invitation.email)
      if (existingUser) {
        return {
          success: false,
          error: 'このメールアドレスは既に登録されています',
          code: 'CONFLICT_ERROR'
        }
      }

      return {
        success: true,
        data: {
          message: 'Supabase認証処理に進む準備が整いました',
          user: {
            id: 'pending',
            email: invitation.email
          }
        }
      }

    } catch (error) {
      console.error('Accept invitation usecase error:', error)
      return {
        success: false,
        error: '招待の承認に失敗しました',
        code: 'INTERNAL_ERROR'
      }
    }
  }
}