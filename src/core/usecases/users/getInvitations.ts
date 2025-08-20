import { RepositoryContainer } from '@/core/ports'

export interface GetInvitationsInput {
  currentUserId: string
}

export type GetInvitationsResult = {
  success: true
  data: {
    invitations: Array<{
    id: string
    email: string
    role: string
    status: string
    expires_at?: string | null
    created_at?: string
    organization_id?: string
  }> // 招待データ配列
  }
} | {
  success: false
  error: string
  code: 'AUTHENTICATION_ERROR' | 'AUTHORIZATION_ERROR' | 'INTERNAL_ERROR'
}

export class GetInvitationsUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: GetInvitationsInput): Promise<GetInvitationsResult> {
    try {
      const { currentUserId } = input

      // 現在のユーザー情報を取得
      const currentUser = await this.repositories.users.findById(currentUserId)
      if (!currentUser) {
        return {
          success: false,
          error: 'ユーザー情報の取得に失敗しました',
          code: 'AUTHENTICATION_ERROR'
        }
      }

      // 管理者権限をチェック
      if (currentUser.role !== 'admin') {
        return {
          success: false,
          error: '管理者権限が必要です',
          code: 'AUTHORIZATION_ERROR'
        }
      }

      // 組織IDを確認
      if (!currentUser.organization_id) {
        return {
          success: false,
          error: '組織に所属していません',
          code: 'AUTHENTICATION_ERROR'
        }
      }

      // 招待リストを取得（作成日時の降順でソート）
      const rawInvitations = await this.repositories.userInvitations.findByOrganizationId(
        currentUser.organization_id,
        {
          orderBy: [{ field: 'created_at', direction: 'desc' }]
        }
      )

      // レスポンス型に変換（statusフィールドを追加）
      const invitations = (rawInvitations || []).map(invitation => ({
        id: String(invitation.id),
        email: invitation.email,
        role: invitation.role ?? 'user',
        status: invitation.accepted_at ? 'accepted' : 'pending',
        expires_at: invitation.expires_at,
        created_at: invitation.created_at ?? undefined,
        organization_id: String(invitation.organization_id)
      }))

      return {
        success: true,
        data: {
          invitations
        }
      }

    } catch (error) {
      console.error('Get invitations usecase error:', error)
      return {
        success: false,
        error: '招待リストの取得に失敗しました',
        code: 'INTERNAL_ERROR'
      }
    }
  }
}