import { RepositoryContainer } from '@/core/ports'

/**
 * 招待情報取得のユースケース入力
 */
export interface GetInvitationInfoInput {
  token: string
}

/**
 * 招待情報取得のユースケース出力
 */
export interface GetInvitationInfoOutput {
  email: string
  role: 'admin' | 'user'
  organizationName: string
}

/**
 * 招待情報取得のユースケース結果
 */
export type GetInvitationInfoResult = 
  | { success: true; data: GetInvitationInfoOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * 招待情報取得ユースケース
 */
export class GetInvitationInfoUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: GetInvitationInfoInput): Promise<GetInvitationInfoResult> {
    try {
      // 入力バリデーション
      const validationError = this.validateInput(input)
      if (validationError) {
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: validationError }
        }
      }

      // 有効な招待情報を取得
      const invitation = await this.repositories.userInvitations.findByToken(input.token)
      
      if (!invitation) {
        return {
          success: false,
          error: { code: 'NOT_FOUND_ERROR', message: '無効または期限切れの招待リンクです' }
        }
      }

      // 期限チェック
      if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
        return {
          success: false,
          error: { code: 'EXPIRED_ERROR', message: '招待リンクが期限切れです' }
        }
      }

      // 既に受諾済みかチェック
      if (invitation.accepted_at) {
        return {
          success: false,
          error: { code: 'ALREADY_ACCEPTED_ERROR', message: 'この招待は既に受諾されています' }
        }
      }

      // 組織情報を取得
      const organization = await this.repositories.organizations.findById(invitation.organization_id.toString())
      
      return {
        success: true,
        data: {
          email: invitation.email,
          role: invitation.role ?? 'user',
          organizationName: organization?.name ?? '不明な組織'
        }
      }

    } catch (error) {
      console.error('Get invitation info usecase error:', error)
      
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '招待情報の取得に失敗しました' }
      }
    }
  }

  /**
   * 入力値のバリデーション
   */
  private validateInput(input: GetInvitationInfoInput): string | null {
    if (!input.token || typeof input.token !== 'string' || input.token.trim().length === 0) {
      return '招待トークンが必要です'
    }

    return null
  }
}