import { AuthRepository } from '@/core/ports/authRepository'

/**
 * サインアウトのユースケース入力
 */
export interface SignOutInput {
  // サインアウトは特に入力パラメータを必要としない
  _placeholder?: never
}

/**
 * サインアウトのユースケース出力
 */
export interface SignOutOutput {
  success: boolean
}

/**
 * サインアウトのユースケース結果
 */
export type SignOutResult = 
  | { success: true; data: SignOutOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * サインアウトユースケース
 */
export class SignOutUseCase {
  constructor(private authRepository: AuthRepository) {}

  async execute(_input: SignOutInput): Promise<SignOutResult> {
    try {
      // 認証リポジトリを使用してサインアウト
      await this.authRepository.signOut()

      return {
        success: true,
        data: { success: true }
      }

    } catch (error) {
      console.error('Sign out usecase error:', error)
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '内部エラーが発生しました' }
      }
    }
  }
}