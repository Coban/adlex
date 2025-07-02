import { http, HttpResponse } from "msw";

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
  http.post("/api/checks", () => {
    return HttpResponse.json({
      id: 1,
      status: "queued",
    });
  }),

  http.get("/api/dictionaries", () => {
    return HttpResponse.json([
      {
        id: 1,
        phrase: "テスト表現",
        category: "NG",
        notes: "テスト用",
      },
    ]);
  }),

  http.post("/api/dictionaries", () => {
    return HttpResponse.json({
      id: 2,
      phrase: "新しい表現",
      category: "ALLOW",
      notes: "追加されました",
    });
  }),

  // Mock OpenAI API
  http.post("https://api.openai.com/v1/chat/completions", () => {
    return HttpResponse.json({
      choices: [{
        message: {
          content: "Mock AI response",
          tool_calls: [{
            function: {
              arguments: JSON.stringify({
                modified: "Mock modified text",
                violations: [],
              }),
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
];
