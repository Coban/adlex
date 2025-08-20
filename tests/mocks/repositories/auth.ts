import { AuthRepository, AuthUser } from '@/core/ports/authRepository'

/**
 * モック認証リポジトリ
 */
export class MockAuthRepository implements AuthRepository {
  private mockUser: AuthUser | null = null
  private mockSessionValid = false

  constructor(mockUser?: AuthUser, sessionValid = false) {
    this.mockUser = mockUser || null
    this.mockSessionValid = sessionValid
  }

  async signOut(): Promise<void> {
    this.mockUser = null
    this.mockSessionValid = false
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    return this.mockUser
  }

  async isSessionValid(): Promise<boolean> {
    return this.mockSessionValid
  }

  // テスト用のヘルパーメソッド
  setMockUser(user: AuthUser | null): void {
    this.mockUser = user
  }

  setSessionValid(valid: boolean): void {
    this.mockSessionValid = valid
  }
}