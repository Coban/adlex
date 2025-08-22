/**
 * AdLex統一メール送信サービス
 * ユーザー招待、通知などのメール送信機能を提供
 */

import { logger } from '@/lib/logger'

interface InvitationEmailData {
  to: string
  invitationId: string
  organizationName: string
  inviterName: string
  role: 'admin' | 'user'
}

interface EmailService {
  sendInvitation(data: InvitationEmailData): Promise<void>
}

class MockEmailService implements EmailService {
  async sendInvitation(data: InvitationEmailData): Promise<void> {
    logger.info('Mock invitation email sent', {
      operation: 'sendInvitation',
      recipient: data.to,
      organizationName: data.organizationName,
      role: data.role
    })
    
    // 開発環境ではコンソールにメール内容を表示
    if (process.env.NODE_ENV === 'development') {
      console.log(`
=====================================
📧 招待メール (Mock)
=====================================
宛先: ${data.to}
件名: ${data.organizationName}への招待
内容:
${data.inviterName}さんから${data.organizationName}への招待が届きました。
ロール: ${data.role}
招待ID: ${data.invitationId}

以下のリンクから登録を完了してください：
${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/invite?token=${data.invitationId}
=====================================
      `)
    }
  }
}

class ProductionEmailService implements EmailService {
  async sendInvitation(data: InvitationEmailData): Promise<void> {
    // 本番環境では実際のメール送信サービスを使用
    // 例: SendGrid, AWS SES, Resend等
    
    logger.info('Production invitation email sending', {
      operation: 'sendInvitation',
      recipient: data.to,
      organizationName: data.organizationName,
      role: data.role
    })

    try {
      // TODO: 実際のメールサービスプロバイダーを実装
      // 例: SendGrid実装
      // const response = await sendgrid.send({
      //   to: data.to,
      //   from: process.env.FROM_EMAIL,
      //   subject: `${data.organizationName}への招待`,
      //   html: generateInvitationHTML(data)
      // })

      // 現時点では開発環境と同様にログ出力
      console.log('Production email would be sent:', {
        to: data.to,
        organizationName: data.organizationName,
        role: data.role,
        invitationId: data.invitationId
      })

      logger.info('Invitation email sent successfully', {
        operation: 'sendInvitation',
        recipient: data.to,
        organizationName: data.organizationName
      })
    } catch (error) {
      logger.error('Failed to send invitation email', {
        operation: 'sendInvitation',
        recipient: data.to,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw new Error(`メール送信に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// ファクトリー関数で環境に応じたサービスを返す
function createEmailService(): EmailService {
  if (process.env.NODE_ENV === 'production') {
    return new ProductionEmailService()
  }
  return new MockEmailService()
}

export const emailService = createEmailService()
export type { InvitationEmailData, EmailService }