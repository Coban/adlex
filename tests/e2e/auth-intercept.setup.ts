import { test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('認証API応答をモック', async ({ page }) => {
  console.log('Starting API interception authentication setup...');
  
  const mockUser = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@test.com',
    role: 'admin',
    email_confirmed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_metadata: {},
    app_metadata: { role: 'admin' }
  };

  const mockSession = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: mockUser
  };

  // より包括的なSupabase認証APIモック
  await page.route('**/auth/v1/**', async route => {
    const url = route.request().url();
    const method = route.request().method();
    
    console.log(`Auth API intercepted: ${method} ${url}`);
    
    if (url.includes('/token') || url.includes('/refresh')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: JSON.stringify(mockSession)
      });
    } else if (url.includes('/user')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: JSON.stringify(mockUser)
      });
    } else if (url.includes('/session')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: JSON.stringify(mockSession)
      });
    } else if (method === 'OPTIONS') {
      await route.fulfill({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: ''
      });
    } else {
      // その他の認証関連APIはデフォルトで成功を返す
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: JSON.stringify({ success: true })
      });
    }
  });

  // Supabaseのrest APIもモック（すべてのAPIを包括的にカバー）
  await page.route('**/rest/v1/**', async route => {
    const url = route.request().url();
    const method = route.request().method();
    
    console.log(`REST API intercepted: ${method} ${url}`);
    
    // CORSプリフライト対応
    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, prefer'
        },
        body: ''
      });
      return;
    }
    
    // ユーザープロファイル取得（複数のパターンに対応）
    if (url.includes('/users') || url.includes('/profiles')) {
      const userData = {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@test.com',
        role: 'admin',
        organization_id: '00000000-0000-0000-0000-000000000002',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        organizations: {
          id: '00000000-0000-0000-0000-000000000002',
          name: 'Test Organization',
          plan: 'standard'
        }
      };
      
      // 単一オブジェクトとしても配列としても返す
      const responseBody = url.includes('select=') || method === 'GET' 
        ? JSON.stringify([userData])
        : JSON.stringify(userData);
        
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Range': '0-0/1'
        },
        body: responseBody
      });
    }
    // 組織情報取得
    else if (url.includes('/organizations')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Range': '0-0/1'
        },
        body: JSON.stringify([{
          id: '00000000-0000-0000-0000-000000000002',
          name: 'Test Organization',
          plan: 'standard',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
      });
    }
    // その他のAPIリクエスト
    else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Range': '0-0/0'
        },
        body: JSON.stringify([])
      });
    }
  });

  // ホームページに移動
  await page.goto('/');
  
  // 包括的な認証データをローカルストレージとセッションストレージに設定
  await page.evaluate((sessionData) => {
    // Supabaseのすべての可能なキー形式で保存
    const hostname = window.location.hostname;
    const possibleKeys = [
      `sb-${hostname}-auth-token`,
      `sb-localhost-auth-token`,
      `supabase.auth.token`,
      `sb-auth-token`,
      'supabase-auth-token',
      'auth-token'
    ];
    
    // ローカルストレージとセッションストレージ両方に保存
    possibleKeys.forEach(key => {
      localStorage.setItem(key, JSON.stringify(sessionData));
      sessionStorage.setItem(key, JSON.stringify(sessionData));
    });
    
    // Cookieにも設定（WebKit/Safari対応）
    document.cookie = `sb-auth-token=${JSON.stringify(sessionData)}; path=/; SameSite=Lax`;
    document.cookie = `auth-role=admin; path=/; SameSite=Lax`;
    document.cookie = `auth-user=admin@test.com; path=/; SameSite=Lax`;
    
    // 追加の認証フラグ
    localStorage.setItem('auth-test-user', 'admin@test.com');
    localStorage.setItem('auth-test-role', 'admin');
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userRole', 'admin');
    
    // セッションストレージにも同様に設定
    sessionStorage.setItem('auth-test-user', 'admin@test.com');
    sessionStorage.setItem('auth-test-role', 'admin');
    sessionStorage.setItem('isAuthenticated', 'true');
    sessionStorage.setItem('userRole', 'admin');
    
    console.log('Comprehensive mock authentication data set in localStorage, sessionStorage, and cookies');
  }, mockSession);
  
  // アプリケーション内部のAPIルートもモック
  await page.route('**/api/users**', async route => {
    const method = route.request().method();
    
    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: ''
      });
      return;
    }
    
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: mockUser,
        profile: {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'admin@test.com',
          role: 'admin',
          organization_id: '00000000-0000-0000-0000-000000000002'
        }
      })
    });
  });

  // 組織関連のAPIルートもモック
  await page.route('**/api/organizations**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Test Organization',
        plan: 'standard'
      })
    });
  });
  
  // ページをリロードして認証状態を反映
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  
  console.log('API interception authentication setup completed');
  
  // 認証状態を保存
  await page.context().storageState({ path: authFile });
});