/**
 * 認証リポジトリのポート定義
 */
export interface AuthRepository {
  /**
   * サインアウトを実行
   */
  signOut(): Promise<void>

  /**
   * 現在のユーザーを取得
   */
  getCurrentUser(): Promise<AuthUser | null>

  /**
   * セッションが有効かチェック
   */
  isSessionValid(): Promise<boolean>
}

/**
 * 認証ユーザー情報
 */
export interface AuthUser {
  id: string
  email: string
  emailVerified: boolean
  lastSignInAt?: string
}

/**
 * 認証エラー
 */
export interface AuthError {
  code: string
  message: string
}

/**
 * 認証結果の型
 */
export type AuthResult<T> = 
  | { success: true; data: T }
  | { success: false; error: AuthError }