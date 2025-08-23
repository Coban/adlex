import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextResponse } from 'next/server'
import { ErrorHandler } from '@/lib/errors/handler'
import { ErrorFactory } from '@/lib/errors/factory'
import { AppError } from '@/lib/errors/types'

// logger のモック
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}))

describe('ErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createApiErrorResponse', () => {
    it('AppErrorから適切なAPIレスポンスを作成できること', () => {
      const appError = ErrorFactory.createValidationError('無効な入力です')
      const response = ErrorHandler.createApiErrorResponse(appError)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(400)
      
      // レスポンスボディの確認
      const responseText = JSON.parse(JSON.stringify(Object.fromEntries(response.headers)))
      expect(response.headers.get('content-type')).toBe('application/json')
    })

    it('一般的なErrorから500レスポンスを作成できること', () => {
      const error = new Error('予期しないエラー')
      const response = ErrorHandler.createApiErrorResponse(error)

      expect(response.status).toBe(500)
    })

    it('未知のエラーから500レスポンスを作成できること', () => {
      const error = 'string error'
      const response = ErrorHandler.createApiErrorResponse(error)

      expect(response.status).toBe(500)
    })

    it('認証エラーから401レスポンスを作成できること', () => {
      const authError = ErrorFactory.createAuthenticationError()
      const response = ErrorHandler.createApiErrorResponse(authError)

      expect(response.status).toBe(401)
    })

    it('認可エラーから403レスポンスを作成できること', () => {
      const authzError = ErrorFactory.createAuthorizationError()
      const response = ErrorHandler.createApiErrorResponse(authzError)

      expect(response.status).toBe(403)
    })

    it('リソース未発見エラーから404レスポンスを作成できること', () => {
      const notFoundError = ErrorFactory.createNotFoundError('user', '123')
      const response = ErrorHandler.createApiErrorResponse(notFoundError)

      expect(response.status).toBe(404)
    })

  })

  describe('getDisplayMessage', () => {
    it('AppErrorからユーザーメッセージを取得できること', () => {
      const appError = ErrorFactory.createValidationError(
        'Invalid input',
        'カスタムユーザーメッセージ'
      )
      const message = ErrorHandler.getDisplayMessage(appError)

      expect(message).toBe('カスタムユーザーメッセージ')
    })

    it('一般的なErrorから汎用メッセージを取得できること', () => {
      const error = new Error('Some error')
      const message = ErrorHandler.getDisplayMessage(error)

      expect(message).toBe('予期しないエラーが発生しました。サポートにお問い合わせください。')
    })

    it('未知のエラーから汎用メッセージを取得できること', () => {
      const error = { unknown: 'error object' }
      const message = ErrorHandler.getDisplayMessage(error)

      expect(message).toBe('予期しないエラーが発生しました')
    })

    it('null/undefinedから汎用メッセージを取得できること', () => {
      expect(ErrorHandler.getDisplayMessage(null)).toBe('予期しないエラーが発生しました')
      expect(ErrorHandler.getDisplayMessage(undefined)).toBe('予期しないエラーが発生しました')
    })
  })

  describe('logError', () => {
    let consoleSpy: any
    
    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleSpy.mockRestore()
    })

    it('AppErrorを適切にログ出力できること', () => {
      const appError = ErrorFactory.createDatabaseError('select', 'Connection failed')
      const context = { userId: '123' }
      
      ErrorHandler.logError(appError, context)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[DATABASE_ERROR\]/),
        expect.objectContaining({
          userMessage: expect.any(String),
          context: expect.objectContaining({ userId: '123' })
        })
      )
    })

    it('一般的なErrorを適切にログ出力できること', () => {
      const error = new Error('Test error')
      
      ErrorHandler.logError(error)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[UNKNOWN_ERROR\]/),
        expect.objectContaining({
          stack: expect.any(String)
        })
      )
    })

    it('コンテキスト情報と共にログ出力できること', () => {
      const error = new Error('Test error')
      const context = { operation: 'test', userId: '456' }
      
      ErrorHandler.logError(error, context)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[UNKNOWN_ERROR\]/),
        expect.objectContaining({
          context: expect.objectContaining({ operation: 'test', userId: '456' })
        })
      )
    })
  })

  describe('private getHttpStatus', () => {
    it('エラーコードから適切なHTTPステータスをマッピングできること', () => {
      // プライベートメソッドなので、createApiErrorResponse を通じて間接的にテスト
      const testCases = [
        { error: ErrorFactory.createValidationError('test'), expectedStatus: 400 },
        { error: ErrorFactory.createAuthenticationError(), expectedStatus: 401 },
        { error: ErrorFactory.createAuthorizationError(), expectedStatus: 403 },
        { error: ErrorFactory.createNotFoundError('test', '1'), expectedStatus: 404 },
        { error: ErrorFactory.createDatabaseError('test', 'error'), expectedStatus: 500 },
        { error: ErrorFactory.createExternalServiceError('test', 'op'), expectedStatus: 502 },
        { error: ErrorFactory.createAIServiceError('openai', 'chat'), expectedStatus: 502 }
      ]

      testCases.forEach(({ error, expectedStatus }) => {
        const response = ErrorHandler.createApiErrorResponse(error)
        expect(response.status).toBe(expectedStatus)
      })
    })
  })
})