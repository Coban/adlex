import { http, HttpResponse } from "msw";

// Type definitions for request bodies
interface CheckRequestBody {
  text: string;
}

interface OpenAIRequestBody {
  messages: Array<{
    role: string;
    content: string;
  }>;
  tools?: unknown[];
  tool_choice?: unknown;
  temperature?: number;
  max_tokens?: number;
}

interface LMStudioRequestBody {
  messages: Array<{
    role: string;
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
}

export const handlers = [
  // Mock Supabase Auth
  http.post("*/auth/v1/token", () => {
    return HttpResponse.json({
      access_token: "mock-access-token",
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: "mock-refresh-token",
      user: {
        id: "mock-user-id",
        email: "test@example.com",
        is_anonymous: false,
        created_at: "2024-01-01T00:00:00Z",
      },
    });
  }),

  http.get("*/auth/v1/user", () => {
    return HttpResponse.json({
      id: "mock-user-id",
      email: "test@example.com",
      is_anonymous: false,
      created_at: "2024-01-01T00:00:00Z",
    });
  }),

  // Mock API endpoints
  http.post("/api/checks", async ({ request }) => {
    const body = await request.json() as CheckRequestBody;
    
    // E2Eテスト用の予測可能なレスポンス
    // const _hasViolation = body.text.includes("がんが治る") || body.text.includes("血圧が下がる");
    
    return HttpResponse.json({
      id: Date.now(), // ユニークなID
      status: "queued",
      original_text: body.text,
    });
  }),

  // Mock check stream endpoint for E2E tests
  http.get("/api/checks/:id/stream", ({ params }) => {
    const checkId = params.id;
    
    // SSE形式でモックデータを返す
    const mockResult = {
      id: parseInt(checkId as string),
      original_text: "がんが治る奇跡のサプリメント！血圧が下がる効果があります。",
      modified_text: "健康をサポートする栄養補助食品！体調管理に役立つ可能性があります。",
      status: "completed",
      violations: [
        {
          id: 1,
          start_pos: 0,
          end_pos: 5,
          reason: "重篤な疾患の治療効果を標榜する表現",
          dictionary_id: 1,
        },
        {
          id: 2,
          start_pos: 15,
          end_pos: 20,
          reason: "医薬品的効果を標榜する表現",
          dictionary_id: 2,
        }
      ],
    };

    const streamData = `data: ${JSON.stringify(mockResult)}\n\n`;
    
    return new HttpResponse(streamData, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }),

  http.get("/api/dictionaries", () => {
    return HttpResponse.json({
      dictionaries: [
        {
          id: 1,
          phrase: "がんが治る",
          category: "NG",
          notes: "重篤な疾患の治療効果を標榜",
          organization_id: 1,
        },
        {
          id: 2,
          phrase: "血圧が下がる",
          category: "NG", 
          notes: "医薬品的効果を標榜",
          organization_id: 1,
        },
        {
          id: 3,
          phrase: "健康維持",
          category: "ALLOW",
          notes: "一般的な健康表現",
          organization_id: 1,
        },
      ],
    });
  }),

  http.post("/api/dictionaries", () => {
    return HttpResponse.json({
      dictionary: {
        id: Date.now(),
        phrase: "新しい表現",
        category: "ALLOW",
        notes: "追加されました",
        organization_id: 1,
      },
    });
  }),

  // Mock OpenAI API with more realistic responses
  http.post("https://api.openai.com/v1/chat/completions", async ({ request }) => {
    const body = await request.json() as OpenAIRequestBody;
    const userMessage = body.messages?.[body.messages.length - 1]?.content ?? "";
    
    // テキスト内容に基づいてレスポンスを変更
    const hasViolation = userMessage.includes("がんが治る") || userMessage.includes("血圧が下がる");
    
    const mockResponse = {
      modified: hasViolation ? 
        "健康をサポートする栄養補助食品！体調管理に役立つ可能性があります。" : 
        userMessage,
      violations: hasViolation ? [
        {
          start: 0,
          end: 5,
          reason: "重篤な疾患の治療効果を標榜する表現",
          dictionaryId: 1,
        }
      ] : [],
    };

    return HttpResponse.json({
      choices: [{
        message: {
          content: "",
          tool_calls: [{
            function: {
              name: "apply_yakukiho_rules",
              arguments: JSON.stringify(mockResponse),
            },
          }],
        },
      }],
    });
  }),

  http.post("https://api.openai.com/v1/embeddings", () => {
    return HttpResponse.json({
      data: [{
        embedding: new Array(384).fill(0.1),
      }],
    });
  }),

  // Mock Supabase REST API for auth tests
  http.get('http://localhost:54321/rest/v1/users', ({ request }) => {
    const url = new URL(request.url);
    const selectParam = url.searchParams.get('select');
    const idParam = url.searchParams.get('id');
    const emailParam = url.searchParams.get('email');
    
    if (idParam?.includes('eq.u')) {
      return HttpResponse.json([
        {
          id: 'u',
          email: 'test@example.com',
          display_name: 'Test User'
        }
      ]);
    }
    
    if (emailParam?.includes('eq.a@b.com')) {
      return HttpResponse.json([
        { id: 'user-123' }
      ]);
    }
    
    return HttpResponse.json([]);
  }),

  // Mock LM Studio API (if needed for local development)
  http.post("http://localhost:1234/v1/chat/completions", async ({ request }) => {
    const body = await request.json() as LMStudioRequestBody;
    const userMessage = body.messages?.[body.messages.length - 1]?.content ?? "";
    
    return HttpResponse.json({
      choices: [{
        message: {
          content: `LM Studio mock response for: ${userMessage.substring(0, 50)}...`,
        },
      }],
    });
  }),

  // Mock queue status endpoint
  http.get("/api/checks/queue-status", () => {
    return HttpResponse.json({
      queueLength: 0,
      processing: false,
      estimatedWait: 0
    });
  }),

  // Mock admin API endpoints
  http.get("/api/admin/stats", () => {
    return HttpResponse.json({
      stats: {
        totalUsers: 100,
        totalChecks: 5000,
        totalDictionaries: 250,
        totalOrganizations: 20,
        activeUsers: 75,
        checksThisMonth: 800,
        totalViolations: 1200,
        errorRate: '2.5'
      },
      recentActivity: [
        {
          id: '1',
          action: 'チェック実行',
          user: 'test@example.com',
          text: 'テストチェック',
          status: 'completed',
          timestamp: '2024-01-20T10:00:00Z'
        },
        {
          id: '2',
          action: 'チェック実行',
          user: 'user@example.com',
          text: 'サンプルチェック',
          status: 'processing',
          timestamp: '2024-01-20T09:30:00Z'
        }
      ],
      dailyChecks: [
        { date: '2024-01-14', count: 45 },
        { date: '2024-01-15', count: 62 },
        { date: '2024-01-16', count: 38 },
        { date: '2024-01-17', count: 71 },
        { date: '2024-01-18', count: 55 },
        { date: '2024-01-19', count: 89 },
        { date: '2024-01-20', count: 67 }
      ]
    });
  }),

  http.get("/api/admin/performance", () => {
    return HttpResponse.json({
      performance: {
        avgProcessingTime: '3.2',
        maxProcessingTime: '8.5',
        minProcessingTime: '1.1',
        totalChecks24h: 245,
        successRate: '97.8',
        errorRate: '2.2'
      },
      statusBreakdown: {
        completed: 240,
        processing: 3,
        failed: 2
      },
      hourlyActivity: [
        { hour: '0:00', count: 5 },
        { hour: '1:00', count: 2 },
        { hour: '2:00', count: 1 },
        { hour: '3:00', count: 3 },
        { hour: '4:00', count: 4 },
        { hour: '5:00', count: 8 },
        { hour: '6:00', count: 12 },
        { hour: '7:00', count: 18 },
        { hour: '8:00', count: 25 },
        { hour: '9:00', count: 32 },
        { hour: '10:00', count: 28 },
        { hour: '11:00', count: 22 }
      ],
      systemHealth: {
        status: 'healthy',
        uptime: '99.9%',
        lastIncident: null
      }
    });
  }),
];
