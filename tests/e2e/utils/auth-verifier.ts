import { Page } from '@playwright/test';

/**
 * 認証状態の詳細情報
 */
export interface AuthState {
  isAuthenticated: boolean;
  userRole: string | null;
  sessionValid: boolean;
  expiresAt: number | null;
  tokenType: 'access' | 'refresh' | null;
  userId: string | null;
}

/**
 * 認証状態を詳細に検証する
 * T001の要件に基づく実装
 */
export async function verifyAuthenticationState(page: Page): Promise<AuthState> {
  const authState = await page.evaluate(() => {
    // Supabaseクライアントから認証状態を取得
    const supabaseAuth = (window as any).supabaseClient?.auth;
    
    if (!supabaseAuth) {
      return {
        isAuthenticated: false,
        userRole: null,
        sessionValid: false,
        expiresAt: null,
        tokenType: null,
        userId: null
      };
    }

    // セッション情報の取得
    const session = supabaseAuth.getSession ? supabaseAuth.getSession() : null;
    const user = supabaseAuth.getUser ? supabaseAuth.getUser() : null;
    
    // LocalStorageからSupabaseトークン情報を取得
    let tokenInfo = null;
    try {
      const authKey = Object.keys(localStorage).find(key => key.startsWith('supabase.auth.token'));
      if (authKey) {
        tokenInfo = JSON.parse(localStorage.getItem(authKey) || '{}');
      }
    } catch {
      console.warn('Failed to parse auth token from localStorage');
    }

    const currentTime = Date.now() / 1000; // Unix timestamp in seconds
    const expiresAt = tokenInfo?.expires_at || session?.expires_at;
    const isExpired = expiresAt ? currentTime >= expiresAt : false;

    return {
      isAuthenticated: !!(session?.access_token && user && !isExpired),
      userRole: user?.user_metadata?.role || user?.role || tokenInfo?.user?.role || null,
      sessionValid: !!(session && !isExpired),
      expiresAt: expiresAt || null,
      tokenType: tokenInfo?.token_type || 'access',
      userId: user?.id || tokenInfo?.user?.id || null
    };
  });

  return authState as AuthState;
}

/**
 * 管理者権限の確認
 */
export async function verifyAdminPermissions(page: Page): Promise<boolean> {
  const authState = await verifyAuthenticationState(page);
  return authState.isAuthenticated && authState.userRole === 'admin';
}

/**
 * セッション有効期限の確認
 */
export async function verifySessionExpiry(page: Page): Promise<{
  isExpired: boolean;
  expiresInMinutes: number;
  willExpireSoon: boolean; // 5分以内に期限切れ
}> {
  const authState = await verifyAuthenticationState(page);
  
  if (!authState.expiresAt) {
    return {
      isExpired: false,
      expiresInMinutes: Infinity,
      willExpireSoon: false
    };
  }

  const currentTime = Date.now() / 1000;
  const expiresInSeconds = authState.expiresAt - currentTime;
  const expiresInMinutes = expiresInSeconds / 60;
  
  return {
    isExpired: expiresInSeconds <= 0,
    expiresInMinutes: Math.max(0, expiresInMinutes),
    willExpireSoon: expiresInSeconds > 0 && expiresInSeconds <= 300 // 5分以内
  };
}

/**
 * トークンの有効性検証
 */
export async function verifyTokenValidity(page: Page): Promise<{
  hasValidToken: boolean;
  tokenType: string | null;
  tokenPresent: boolean;
}> {
  const result = await page.evaluate(() => {
    try {
      // LocalStorageからトークン情報を取得
      const authKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('supabase.auth.token') || key.startsWith('sb-')
      );
      
      if (authKeys.length === 0) {
        return { hasValidToken: false, tokenType: null, tokenPresent: false };
      }

      const authKey = authKeys[0];
      const tokenData = JSON.parse(localStorage.getItem(authKey) || '{}');
      
      const accessToken = tokenData.access_token;
      const expiresAt = tokenData.expires_at;
      const tokenType = tokenData.token_type || 'Bearer';
      
      if (!accessToken) {
        return { hasValidToken: false, tokenType: null, tokenPresent: false };
      }

      // トークンの期限チェック
      const currentTime = Date.now() / 1000;
      const isExpired = expiresAt ? currentTime >= expiresAt : false;
      
      return {
        hasValidToken: !isExpired,
        tokenType,
        tokenPresent: true
      };
    } catch (error) {
      return { hasValidToken: false, tokenType: null, tokenPresent: false };
    }
  });

  return result;
}

/**
 * 認証状態のデバッグ情報を出力
 */
export async function debugAuthenticationState(page: Page): Promise<void> {
  const authState = await verifyAuthenticationState(page);
  const sessionExpiry = await verifySessionExpiry(page);
  const tokenValidity = await verifyTokenValidity(page);
  
  console.log('=== 認証状態デバッグ情報 ===');
  console.log('認証状態:', authState);
  console.log('セッション期限:', sessionExpiry);
  console.log('トークン状態:', tokenValidity);
  console.log('現在のURL:', page.url());
  console.log('=======================');
}

/**
 * テスト用の認証状態セットアップ
 */
export async function setupTestAuthState(page: Page, mockAuthData: {
  isAuthenticated?: boolean;
  userRole?: string;
  userId?: string;
  expiresAt?: number;
}): Promise<void> {
  await page.addInitScript((authData) => {
    const tokenData = {
      access_token: authData.isAuthenticated ? 'test-access-token' : null,
      refresh_token: 'test-refresh-token',
      expires_at: authData.expiresAt || (Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: {
        id: authData.userId || 'test-user-id',
        role: authData.userRole || 'user',
        email: authData.userRole === 'admin' ? 'admin@test.com' : 'user@test.com',
        user_metadata: {
          role: authData.userRole || 'user'
        }
      }
    };

    localStorage.setItem('supabase.auth.token', JSON.stringify(tokenData));
    
    // モックSupabaseクライアントを設定
    (window as any).supabaseClient = {
      auth: {
        getSession: () => Promise.resolve({
          data: { session: authData.isAuthenticated ? tokenData : null }
        }),
        getUser: () => Promise.resolve({
          data: { user: authData.isAuthenticated ? tokenData.user : null }
        })
      }
    };
  }, mockAuthData);
}