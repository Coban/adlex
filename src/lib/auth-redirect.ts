'use client'

/**
 * 認証後のリダイレクト処理を管理するユーティリティ
 */

/**
 * サインイン成功後のリダイレクト先URLを取得
 */
export function getRedirectUrl(): string {
  if (typeof window === 'undefined') return '/'
  
  const urlParams = new URLSearchParams(window.location.search)
  const redirectParam = urlParams.get('redirect')
  
  // リダイレクトパラメーターがある場合はそれを使用
  if (redirectParam) {
    // セキュリティ: 相対パスのみを許可
    if (redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
      return redirectParam
    }
  }
  
  // デフォルトはホームページ
  return '/'
}

/**
 * 現在のパスをリダイレクトパラメーターとして含んだサインインURLを生成
 */
export function createSignInUrl(currentPath?: string): string {
  const path = currentPath ?? (typeof window !== 'undefined' ? window.location.pathname : '/')
  
  // ホームページや認証関連ページの場合はリダイレクトパラメーターを追加しない
  if (path === '/' || path.startsWith('/auth/')) {
    return '/auth/signin'
  }
  
  return `/auth/signin?redirect=${encodeURIComponent(path)}`
}

/**
 * ローカルストレージから認証関連データをクリア
 */
export function clearAuthData(): void {
  if (typeof window === 'undefined') return
  
  // Supabaseのローカルストレージデータをクリア
  const keysToRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && (key.startsWith('supabase.auth.') || key.startsWith('sb-'))) {
      keysToRemove.push(key)
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key))
  
  // セッションストレージもクリア
  sessionStorage.clear()
}