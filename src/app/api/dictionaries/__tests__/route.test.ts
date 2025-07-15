import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "../route";

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

// Mock createClient
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

// Disable TypeScript checking for this test file due to complex mock types
// @ts-nocheck

// Mock AI client
vi.mock("@/lib/ai-client", () => ({
  createEmbedding: vi.fn(() => Promise.resolve(new Array(384).fill(0.1))),
}));

describe("/api/dictionaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock authenticated user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    // Mock user profile - we need to reset the complete mock structure
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: {
                  organization_id: 1,
                  role: "admin",
                },
                error: null,
              })),
            })),
          })),
        };
      }
      // Default mock for other tables (dictionaries)
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              data: [
                {
                  id: 1,
                  phrase: "テスト表現",
                  category: "NG",
                  notes: "テスト用",
                  organization_id: 1,
                },
              ],
              error: null,
            })),
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                id: 2,
                phrase: "新しい表現",
                category: "ALLOW",
                notes: "追加されました",
              },
              error: null,
            })),
          })),
        })),
      };
    });
  });

  describe("GET /api/dictionaries", () => {
    it("should return dictionaries for authenticated user", async () => {
      const request = new NextRequest("http://localhost/api/dictionaries");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.dictionaries).toHaveLength(1);
      expect(data.dictionaries[0]).toEqual({
        id: 1,
        phrase: "テスト表現",
        category: "NG",
        notes: "テスト用",
        organization_id: 1,
      });
    });

    it("should return 401 for unauthenticated user", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error("Unauthorized"),
      });

      const request = new NextRequest("http://localhost/api/dictionaries");
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/dictionaries", () => {
    it("should create new dictionary entry for admin user", async () => {
      const requestBody = {
        phrase: "新しい表現",
        category: "ALLOW",
        notes: "追加テスト",
      };

      const request = new NextRequest("http://localhost/api/dictionaries", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.dictionary.phrase).toBe("新しい表現");
      expect(data.dictionary.category).toBe("ALLOW");
    });

    it("should return 403 for non-admin user", async () => {
      // Mock non-admin user
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: {
                    organization_id: 1,
                    role: "user", // Non-admin role
                  },
                  error: null,
                })),
              })),
            })),
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          })),
        };
      });

      const requestBody = {
        phrase: "新しい表現",
        category: "ALLOW",
        notes: "テスト",
      };

      const request = new NextRequest("http://localhost/api/dictionaries", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
    });

    it("should return 400 for invalid category", async () => {
      const requestBody = {
        phrase: "新しい表現",
        category: "INVALID",
        notes: "テスト",
      };

      const request = new NextRequest("http://localhost/api/dictionaries", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });
});
