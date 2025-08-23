import { describe, it, expect } from 'vitest'
import { AppError } from '@/lib/errors/types'

describe('AppError', () => {
  it('基本的なエラーオブジェクトを正しく作成できること', () => {
    const error = new AppError({
      code: 'VALIDATION_ERROR',
      message: 'テストエラー',
      userMessage: 'ユーザー向けメッセージ'
    })

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(AppError)
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.message).toBe('テストエラー')
    expect(error.userMessage).toBe('ユーザー向けメッセージ')
    expect(error.context).toBeUndefined()
    expect(error.cause).toBeUndefined()
  })

  it('コンテキスト情報を含むエラーを作成できること', () => {
    const context = { userId: '123', action: 'create' }
    const error = new AppError({
      code: 'DATABASE_ERROR',
      message: 'データベースエラー',
      userMessage: 'システムエラーが発生しました',
      context
    })

    expect(error.code).toBe('DATABASE_ERROR')
    expect(error.context).toEqual(context)
  })

  it('原因エラーを含むエラーを作成できること', () => {
    const originalError = new Error('元のエラー')
    const error = new AppError({
      code: 'EXTERNAL_SERVICE_ERROR',
      message: '外部サービスエラー',
      userMessage: 'サービスに接続できません',
      cause: originalError
    })

    expect(error.code).toBe('EXTERNAL_SERVICE_ERROR')
    expect(error.cause).toBe(originalError)
  })

  it('すべての引数を含む完全なエラーを作成できること', () => {
    const context = { service: 'openai', operation: 'chat' }
    const originalError = new Error('API rate limit exceeded')
    const error = new AppError({
      code: 'AI_SERVICE_ERROR',
      message: 'AI サービスでエラーが発生しました',
      userMessage: 'しばらく時間をおいてから再度お試しください',
      context,
      cause: originalError
    })

    expect(error.code).toBe('AI_SERVICE_ERROR')
    expect(error.message).toBe('AI サービスでエラーが発生しました')
    expect(error.userMessage).toBe('しばらく時間をおいてから再度お試しください')
    expect(error.context).toEqual(context)
    expect(error.cause).toBe(originalError)
  })

  it('Error のプロパティが継承されていること', () => {
    const error = new AppError({
      code: 'VALIDATION_ERROR',
      message: 'テストエラー',
      userMessage: 'ユーザー向けメッセージ'
    })

    expect(error.name).toBe('AppError')
    expect(error.stack).toBeDefined()
    expect(typeof error.toString).toBe('function')
  })
})