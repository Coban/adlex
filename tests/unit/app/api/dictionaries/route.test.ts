import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/dictionaries/route";
import { mockRepositories } from 'tests/mocks/repositories';

// Mock the repository provider
vi.mock('@/core/ports', () => ({
  getRepositories: vi.fn(),
}))

// Mock UseCases
vi.mock('@/core/usecases/dictionaries/getDictionaries', () => ({
  GetDictionariesUseCase: vi.fn().mockImplementation(() => ({
    execute: vi.fn()
  }))
}))

vi.mock('@/core/usecases/dictionaries/createDictionary', () => ({
  CreateDictionaryUseCase: vi.fn().mockImplementation(() => ({
    execute: vi.fn()
  }))
}))

// Mock Supabase auth
vi.mock('@/infra/supabase/serverClient', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn()
    }
  }))
}))

const mockAuth = {
  getUser: vi.fn()
}

const mockSupabaseClient = {
  auth: mockAuth
}

// Import UseCases for mocking
import { GetDictionariesUseCase } from '@/core/usecases/dictionaries/getDictionaries'
import { CreateDictionaryUseCase } from '@/core/usecases/dictionaries/createDictionary'

let mockGetDictionariesUseCase: any
let mockCreateDictionaryUseCase: any

describe("Dictionaries API Route (Unit Tests)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset mock repositories
    mockRepositories.users.reset();
    mockRepositories.dictionaries.reset();
    
    // Mock auth and repositories
    const supabaseModule = await import('@/infra/supabase/serverClient');
    const repositoriesModule = await import('@/core/ports');
    
    vi.mocked(supabaseModule.createClient).mockReturnValue(mockSupabaseClient as any);
    vi.mocked(repositoriesModule.getRepositories).mockResolvedValue(mockRepositories);
    
    // Default to authenticated admin user
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-user' } },
      error: null
    });
    
    // Setup UseCase mocks
    mockGetDictionariesUseCase = {
      execute: vi.fn()
    }
    mockCreateDictionaryUseCase = {
      execute: vi.fn()
    }
    
    vi.mocked(GetDictionariesUseCase).mockReturnValue(mockGetDictionariesUseCase)
    vi.mocked(CreateDictionaryUseCase).mockReturnValue(mockCreateDictionaryUseCase)
  });

  describe("GET /api/dictionaries", () => {
    it("should return dictionaries for authenticated user", async () => {
      const mockResult = {
        success: true,
        data: {
          dictionaries: [{
            id: 1,
            phrase: "テスト表現",
            category: "NG",
            notes: "テスト用",
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }],
          total: 1
        }
      }

      mockGetDictionariesUseCase.execute.mockResolvedValue(mockResult)

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
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      });
      expect(data.total).toBe(1);
    });

    it("should return 401 for unauthenticated user", async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error("Unauthorized"),
      });

      const request = new NextRequest("http://localhost/api/dictionaries");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toEqual({
        code: 'AUTHENTICATION_ERROR',
        message: '認証が必要です',
        details: undefined
      });
    });

    it("should handle search parameters", async () => {
      const mockResult = {
        success: true,
        data: { dictionaries: [], total: 0 }
      }
      mockGetDictionariesUseCase.execute.mockResolvedValue(mockResult)

      const request = new NextRequest("http://localhost/api/dictionaries?search=テスト&category=NG");
      await GET(request);

      expect(mockGetDictionariesUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'テスト',
          category: 'NG'
        })
      );
    });
  });

  describe("POST /api/dictionaries", () => {
    it("should create new dictionary entry for admin user", async () => {
      // Mock repository to return user data
      mockRepositories.users.findById.mockResolvedValue({
        id: 'admin-user',
        email: 'admin@test.com',
        role: 'admin',
        organization_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      })

      const mockResult = {
        success: true,
        data: {
          dictionary: {
            id: 2,
            phrase: "新しい表現",
            category: "ALLOW",
            notes: "追加テスト",
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          warning: undefined,
        }
      };

      mockCreateDictionaryUseCase.execute.mockResolvedValue(mockResult);

      const requestBody = {
        phrase: "新しい表現",
        category: "ALLOW",
        reasoning: "追加テスト",
      };

      const request = new NextRequest("http://localhost/api/dictionaries", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toEqual(mockResult.data);
      expect(mockCreateDictionaryUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-user',
          organizationId: 1,
          phrase: "新しい表現",
          category: "ALLOW",
          reasoning: "追加テスト",
        })
      );
    });

    it("should return 403 for non-admin user", async () => {
      // Mock repository to return user data
      mockRepositories.users.findById.mockResolvedValue({
        id: 'regular-user',
        email: 'user@test.com',
        role: 'user',
        organization_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      })

      const mockResult = {
        success: false,
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: '管理者権限が必要です',
          details: undefined
        }
      };

      mockCreateDictionaryUseCase.execute.mockResolvedValue(mockResult);

      const requestBody = {
        phrase: "新しい表現",
        category: "ALLOW",
        reasoning: "追加テスト",
      };

      const request = new NextRequest("http://localhost/api/dictionaries", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toEqual({
        code: 'AUTHORIZATION_ERROR',
        message: '管理者権限が必要です',
        details: undefined
      });
    });

    it("should return 400 for invalid input", async () => {
      const requestBody = {
        phrase: "",
        category: "INVALID",
        notes: "テスト",
      };

      const request = new NextRequest("http://localhost/api/dictionaries", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('語句は1文字以上である必要があります'),
          details: expect.arrayContaining([
            expect.objectContaining({
              path: ['phrase'],
              message: expect.stringContaining('語句は1文字以上である必要があります')
            })
          ])
        })
      );
    });
  });
});