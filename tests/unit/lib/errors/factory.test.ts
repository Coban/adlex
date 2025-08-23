import { describe, it, expect } from 'vitest'
import { ErrorFactory } from '@/lib/errors/factory'
import { AppError } from '@/lib/errors/types'

describe('ErrorFactory', () => {
  describe('createAuthenticationError', () => {
    it('認証エラーを正しく作成できること', () => {
      const error = ErrorFactory.createAuthenticationError()

      expect(error).toBeInstanceOf(AppError)
      expect(error.code).toBe('AUTHENTICATION_ERROR')
      expect(error.userMessage).toBe('認証が必要です。サインインしてください。')
    })

    it('カスタムメッセージと原因エラーを設定できること', () => {
      const cause = new Error('Token expired')
      const error = ErrorFactory.createAuthenticationError('トークンが期限切れです', cause)

      expect(error.message).toBe('トークンが期限切れです')
      expect(error.cause).toBe(cause)
    })
  })

  describe('createAuthorizationError', () => {
    it('認可エラーを正しく作成できること', () => {
      const error = ErrorFactory.createAuthorizationError()

      expect(error.code).toBe('AUTHORIZATION_ERROR')
      expect(error.userMessage).toBe('この操作を実行する権限がありません。')
    })
  })

  describe('createValidationError', () => {
    it('バリデーションエラーを正しく作成できること', () => {
      const error = ErrorFactory.createValidationError('メールアドレスの形式が正しくありません')

      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.message).toBe('メールアドレスの形式が正しくありません')
      expect(error.userMessage).toBe('メールアドレスの形式が正しくありません')
    })

    it('カスタムユーザーメッセージを設定できること', () => {
      const error = ErrorFactory.createValidationError(
        'Invalid email format',
        'メールアドレスを確認してください'
      )

      expect(error.message).toBe('Invalid email format')
      expect(error.userMessage).toBe('メールアドレスを確認してください')
    })
  })

  describe('createDatabaseError', () => {
    it('データベースエラーを正しく作成できること', () => {
      const error = ErrorFactory.createDatabaseError('connection_failed', 'Connection timeout')

      expect(error.code).toBe('DATABASE_ERROR')
      expect(error.message).toBe('Connection timeoutテーブルのconnection_failedに失敗しました')
      expect(error.userMessage).toBe('データベース処理中にエラーが発生しました。')
      expect(error.context).toEqual({ operation: 'connection_failed', table: 'Connection timeout' })
    })
  })

  describe('createApiError', () => {
    it('APIエラーを正しく作成できること', () => {
      const error = ErrorFactory.createApiError(404, 'リソースが見つかりません')

      expect(error.code).toBe('API_ERROR')
      expect(error.message).toBe('リソースが見つかりません')
      expect(error.userMessage).toBe('リソースが見つかりません')
      expect(error.context).toEqual({ status: 404, endpoint: undefined })
    })

    it('500エラーの場合の適切なユーザーメッセージ', () => {
      const error = ErrorFactory.createApiError(500)

      expect(error.userMessage).toBe('サーバーエラーが発生しました。しばらく待ってから再試行してください。')
    })

    it('401エラーの場合の適切なユーザーメッセージ', () => {
      const error = ErrorFactory.createApiError(401)

      expect(error.userMessage).toBe('APIエラー: 401')
    })
  })

  describe('createExternalServiceError', () => {
    it('外部サービスエラーを正しく作成できること', () => {
      const error = ErrorFactory.createExternalServiceError(
        'OpenAI',
        'chat completion',
        'Rate limit exceeded'
      )

      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR')
      expect(error.message).toBe('Rate limit exceeded')
      expect(error.userMessage).toBe('外部サービス連携でエラーが発生しました。しばらく待ってから再試行してください。')
      expect(error.context).toEqual({ service: 'OpenAI', operation: 'chat completion' })
    })
  })

  describe('createAIServiceError', () => {
    it('AIサービスエラーを正しく作成できること', () => {
      const error = ErrorFactory.createAIServiceError(
        'openai',
        '薬機法チェック',
        'Token limit exceeded'
      )

      expect(error.code).toBe('AI_SERVICE_ERROR')
      expect(error.message).toBe('Token limit exceeded')
      expect(error.userMessage).toBe('AI処理中にエラーが発生しました。しばらく待ってから再試行してください。')
      expect(error.context).toEqual({ provider: 'openai', operation: '薬機法チェック' })
    })
  })

  describe('createFileProcessingError', () => {
    it('ファイル処理エラーを正しく作成できること', () => {
      const error = ErrorFactory.createFileProcessingError(
        'upload',
        'PDF'
      )

      expect(error.code).toBe('FILE_PROCESSING_ERROR')
      expect(error.message).toBe('ファイルuploadに失敗しました')
      expect(error.userMessage).toBe('PDFファイルの処理中にエラーが発生しました。')
      expect(error.context).toEqual({ operation: 'upload', fileType: 'PDF' })
    })
  })


  describe('createNetworkError', () => {
    it('ネットワークエラーを正しく作成できること', () => {
      const error = ErrorFactory.createNetworkError('Connection timeout')

      expect(error.code).toBe('NETWORK_ERROR')
      expect(error.message).toBe('Connection timeout')
      expect(error.userMessage).toBe('ネットワーク接続を確認してください。')
    })
  })


  describe('createNotFoundError', () => {
    it('リソース未発見エラーを正しく作成できること', () => {
      const error = ErrorFactory.createNotFoundError('check', '123')

      expect(error.code).toBe('NOT_FOUND_ERROR')
      expect(error.message).toBe('check (ID: 123) が見つかりません')
      expect(error.userMessage).toBe('check (ID: 123) が見つかりません')
      expect(error.context).toEqual({ resource: 'check', id: '123' })
    })
  })

  describe('createQuotaExceededError', () => {
    it('クォータ超過エラーを正しく作成できること', () => {
      const error = ErrorFactory.createQuotaExceededError('月間チェック', 1000, 1001)

      expect(error.code).toBe('QUOTA_EXCEEDED_ERROR')
      expect(error.message).toBe('月間チェックの制限を超過しました (1001/1000)')
      expect(error.userMessage).toBe('月間チェックの使用量が上限に達しました。')
      expect(error.context).toEqual({ resource: '月間チェック', limit: 1000, current: 1001 })
    })
  })
})