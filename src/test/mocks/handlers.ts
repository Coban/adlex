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
];
