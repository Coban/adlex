import { Page, Route } from '@playwright/test';

/**
 * Playwright専用ルーティングシステム
 * MSWと完全に分離され、E2Eテストでのみ使用される
 */

export interface MockResponse {
  status?: number;
  contentType?: string;
  body?: any;
  headers?: Record<string, string>;
  delay?: number; // レスポンス遅延（ms）
}

export interface RoutePattern {
  method?: string;
  url: string | RegExp;
}

/**
 * 決定論的APIレスポンスモック
 */
export class PlaywrightRouteManager {
  private routes: Map<string, { pattern: RoutePattern; response: MockResponse }> = new Map();
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * APIルートを登録
   */
  async mockApi(
    id: string,
    pattern: RoutePattern,
    response: MockResponse
  ): Promise<void> {
    this.routes.set(id, { pattern, response });

    const urlPattern = typeof pattern.url === 'string' 
      ? `**/${pattern.url}` 
      : pattern.url;

    await this.page.route(urlPattern, async (route: Route) => {
      // メソッドチェック
      if (pattern.method && route.request().method() !== pattern.method) {
        await route.continue();
        return;
      }

      const { status = 200, contentType = 'application/json', body, headers = {}, delay = 0 } = response;

      // 決定論的遅延
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // レスポンスボディの処理
      let responseBody: string;
      if (typeof body === 'string') {
        responseBody = body;
      } else if (body !== undefined) {
        responseBody = JSON.stringify(body);
      } else {
        responseBody = '';
      }

      await route.fulfill({
        status,
        contentType,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          ...headers,
        },
        body: responseBody,
      });
    });
  }

  /**
   * 特定のルートを削除
   */
  async unregisterRoute(id: string): Promise<void> {
    const route = this.routes.get(id);
    if (route) {
      await this.page.unroute(route.pattern.url);
      this.routes.delete(id);
    }
  }

  /**
   * 全ルートをクリア
   */
  async clearAllRoutes(): Promise<void> {
    for (const [id] of this.routes) {
      await this.unregisterRoute(id);
    }
  }

  /**
   * ネットワークエラーシミュレーション
   */
  async simulateNetworkError(pattern: RoutePattern): Promise<void> {
    const urlPattern = typeof pattern.url === 'string' 
      ? `**/${pattern.url}` 
      : pattern.url;

    await this.page.route(urlPattern, async (route: Route) => {
      if (pattern.method && route.request().method() !== pattern.method) {
        await route.continue();
        return;
      }
      await route.abort('failed');
    });
  }

  /**
   * タイムアウトシミュレーション
   */
  async simulateTimeout(pattern: RoutePattern, timeoutMs: number): Promise<void> {
    const urlPattern = typeof pattern.url === 'string' 
      ? `**/${pattern.url}` 
      : pattern.url;

    await this.page.route(urlPattern, async (route: Route) => {
      if (pattern.method && route.request().method() !== pattern.method) {
        await route.continue();
        return;
      }
      // タイムアウトまで待機してからエラー
      await new Promise(resolve => setTimeout(resolve, timeoutMs));
      await route.abort('timeout');
    });
  }
}

/**
 * 共通APIエラーレスポンス
 */
export const API_ERROR_RESPONSES = {
  INTERNAL_SERVER_ERROR: {
    status: 500,
    body: { error: 'Internal Server Error', message: 'サーバー内部でエラーが発生しました' }
  },
  UNAUTHORIZED: {
    status: 401,
    body: { error: 'Unauthorized', message: '認証が必要です' }
  },
  FORBIDDEN: {
    status: 403,
    body: { error: 'Forbidden', message: 'アクセス権限がありません' }
  },
  NOT_FOUND: {
    status: 404,
    body: { error: 'Not Found', message: 'リソースが見つかりません' }
  },
  RATE_LIMIT: {
    status: 429,
    body: { error: 'Rate Limit Exceeded', message: 'リクエスト制限に達しました' }
  },
  VALIDATION_ERROR: {
    status: 422,
    body: { 
      error: 'Validation Error', 
      message: 'バリデーションエラー',
      details: [
        { field: 'text', message: 'テキストは必須です' }
      ]
    }
  }
} as const;

/**
 * 共通成功レスポンス
 */
export const API_SUCCESS_RESPONSES = {
  CHECK_RESULT: {
    status: 200,
    body: {
      id: 'test-check-12345',
      status: 'completed',
      original_text: 'テストテキスト',
      modified_text: 'テスト用の修正されたテキスト',
      violations: [],
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z'
    }
  },
  CHECK_RESULT_WITH_VIOLATIONS: {
    status: 200,
    body: {
      id: 'test-check-12345',
      status: 'completed',
      original_text: 'がんが治る奇跡のサプリメント',
      modified_text: '健康をサポートするサプリメント',
      violations: [
        {
          id: 'violation-1',
          text: 'がんが治る',
          reason: '医薬品的な効果効能の表現は薬機法に違反します',
          start: 0,
          end: 5,
          category: 'medical_efficacy',
          suggestions: ['健康をサポートする', '体調を整える']
        }
      ],
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z'
    }
  }
} as const;

/**
 * ページ用のルーティングヘルパー関数
 */
export async function setupPlaywrightRouting(page: Page): Promise<PlaywrightRouteManager> {
  const routeManager = new PlaywrightRouteManager(page);
  return routeManager;
}

/**
 * 決定論的APIモックセットアップ
 */
export async function setupDeterministicApiMocks(page: Page): Promise<PlaywrightRouteManager> {
  const routeManager = await setupPlaywrightRouting(page);

  // デフォルトの成功レスポンス
  await routeManager.mockApi(
    'default-check',
    { method: 'POST', url: 'api/checks' },
    API_SUCCESS_RESPONSES.CHECK_RESULT
  );

  await routeManager.mockApi(
    'check-status',
    { method: 'GET', url: /api\/checks\/[^/]+$/ },
    API_SUCCESS_RESPONSES.CHECK_RESULT
  );

  // ストリームエンドポイント
  await routeManager.mockApi(
    'check-stream',
    { method: 'GET', url: /api\/checks\/[^/]+\/stream/ },
    {
      status: 200,
      contentType: 'text/event-stream',
      body: 'data: {"type":"progress","message":"処理中"}\n\ndata: {"type":"complete","result":"完了"}\n\n'
    }
  );

  return routeManager;
}