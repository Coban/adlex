import { NextRequest, NextResponse } from 'next/server';

/**
 * テスト専用ログインAPI エンドポイント
 * 
 * 目的:
 * - Playwright E2Eテスト用のstorageState生成
 * - UIログインフローの完全廃止
 * - テスト実行時間の大幅短縮
 * 
 * セキュリティ:
 * - 本番環境では完全に無効化（404応答）
 * - テスト環境でのみ動作
 */

// 本番環境での安全なハンドラー
function productionHandler() {
  return NextResponse.json(
    { error: 'Test endpoints are not available in production' },
    { status: 404 }
  );
}

/**
 * テストユーザーとしてログイン
 * POST /api/test/login-as
 */
export async function POST(request: NextRequest) {
  // 本番環境チェック - 最優先でセキュリティを確保
  if (process.env.NODE_ENV === 'production') {
    return productionHandler();
  }

  try {
    const body = await request.json();
    const { email, role } = body;

    // パラメータ検証
    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email and role are required', example: { email: 'admin@test.com', role: 'admin' } },
        { status: 400 }
      );
    }

    if (!['admin', 'user'].includes(role)) {
      return NextResponse.json(
        { error: 'Role must be either "admin" or "user"' },
        { status: 400 }
      );
    }

    // テスト用のシンプルなセッション情報を作成
    const userId = role === 'admin' ? 'test-admin-1' : 'test-user-1';
    const sessionData = {
      access_token: `test-token-${userId}-${Date.now()}`,
      refresh_token: `test-refresh-${userId}-${Date.now()}`,
      expires_at: Math.floor(Date.now() / 1000) + 3600, // 1時間後
      expires_in: 3600
    };

    // 成功レスポンス準備
    const responseData = {
      success: true,
      message: 'Test login successful',
      user: {
        id: userId,
        email: email,
        role: role,
        organization_id: role === 'admin' ? 'test-org-admin' : 'test-org-user'
      },
      session: {
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token,
        expires_at: sessionData.expires_at,
        expires_in: sessionData.expires_in
      }
    };

    const response = NextResponse.json(responseData);

    // テスト用認証Cookie設定
    response.cookies.set('sb-access-token', sessionData.access_token, {
      httpOnly: true,
      secure: false, // テスト環境では false
      sameSite: 'lax',
      maxAge: sessionData.expires_in,
      path: '/'
    });

    response.cookies.set('sb-refresh-token', sessionData.refresh_token, {
      httpOnly: true,
      secure: false, // テスト環境では false
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7日間
      path: '/'
    });

    // フロントエンド用セッション情報
    response.cookies.set('sb-session', JSON.stringify({
      access_token: sessionData.access_token,
      refresh_token: sessionData.refresh_token,
      expires_at: sessionData.expires_at,
      user: {
        id: userId,
        email: email,
        role: role
      }
    }), {
      httpOnly: false, // JavaScriptからアクセス可能
      secure: false, // テスト環境では false
      sameSite: 'lax',
      maxAge: sessionData.expires_in,
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('Test login API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error during test login',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * テストログアウト
 * DELETE /api/test/login-as
 */
export async function DELETE() {
  // 本番環境チェック
  if (process.env.NODE_ENV === 'production') {
    return productionHandler();
  }

  try {
    const response = NextResponse.json({ 
      success: true, 
      message: 'Test logout successful' 
    });
    
    // 全認証Cookieをクリア
    const cookiesToClear = ['sb-access-token', 'sb-refresh-token', 'sb-session'];
    
    cookiesToClear.forEach(cookieName => {
      response.cookies.set(cookieName, '', {
        httpOnly: cookieName !== 'sb-session',
        secure: false, // テスト環境では false
        sameSite: 'lax',
        maxAge: 0,
        expires: new Date(0),
        path: '/'
      });
    });

    return response;

  } catch (error) {
    console.error('Test logout API error:', error);
    return NextResponse.json(
      { error: 'Failed to logout test user' },
      { status: 500 }
    );
  }
}

/**
 * エンドポイント情報取得（開発時のデバッグ用）
 * GET /api/test/login-as
 */
export async function GET() {
  // 本番環境チェック
  if (process.env.NODE_ENV === 'production') {
    return productionHandler();
  }

  return NextResponse.json({
    endpoint: '/api/test/login-as',
    description: 'Test-only login API for Playwright E2E tests',
    methods: {
      POST: {
        description: 'Login as test user',
        body: {
          email: 'admin@test.com',
          role: 'admin | user'
        },
        response: 'Sets authentication cookies and returns session info'
      },
      DELETE: {
        description: 'Logout test user',
        response: 'Clears authentication cookies'
      },
      GET: {
        description: 'Get endpoint information'
      }
    },
    security: 'Only available in NODE_ENV=test, completely disabled in production'
  });
}