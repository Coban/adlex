import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "../route";

// Comprehensive mock query builder with all methods
const createMockQueryBuilder = () => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  like: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  contains: vi.fn().mockReturnThis(),
  containedBy: vi.fn().mockReturnThis(),
  rangeGt: vi.fn().mockReturnThis(),
  rangeGte: vi.fn().mockReturnThis(),
  rangeLt: vi.fn().mockReturnThis(),
  rangeLte: vi.fn().mockReturnThis(),
  rangeAdjacent: vi.fn().mockReturnThis(),
  overlaps: vi.fn().mockReturnThis(),
  textSearch: vi.fn().mockReturnThis(),
  match: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  filter: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
});

// Mock Supabase client
const mockQuery = createMockQueryBuilder();
const mockSupabase = {
  from: vi.fn().mockReturnValue(mockQuery),
  auth: {
    getUser: vi.fn(),
  },
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
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

describe.skip("/api/dictionaries - DEPRECATED: Use repository tests instead", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the mock query builder
    const newMockQuery = createMockQueryBuilder();
    mockSupabase.from.mockReturnValue(newMockQuery);

    // Mock authenticated user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    // Mock user profile and dictionaries data - we need to reset the complete mock structure
    mockSupabase.from.mockImplementation((table: string) => {
      const tableQuery = createMockQueryBuilder();
      
      if (table === "users") {
        tableQuery.single.mockResolvedValue({
          data: {
            organization_id: 1,
            role: "admin",
          },
          error: null,
        });
      } else if (table === "dictionaries") {
        tableQuery.order.mockResolvedValue({
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
        });
        tableQuery.single.mockResolvedValue({
          data: {
            id: 2,
            phrase: "新しい表現",
            category: "ALLOW",
            notes: "追加されました",
          },
          error: null,
        });
      }
      
      return tableQuery;
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
        const tableQuery = createMockQueryBuilder();
        
        if (table === "users") {
          tableQuery.single.mockResolvedValue({
            data: {
              organization_id: 1,
              role: "user", // Non-admin role
            },
            error: null,
          });
        } else if (table === "dictionaries") {
          tableQuery.order.mockResolvedValue({
            data: [],
            error: null,
          });
        }
        
        return tableQuery;
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
