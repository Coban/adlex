import { vi } from 'vitest';

// Comprehensive mock query builder with all methods
export const createMockQueryBuilder = () => ({
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

// Mock Supabase client with all the methods used in the repositories
export const createMockSupabaseClient = () => {
  const mockQuery = createMockQueryBuilder();

  const mockClient = {
    from: vi.fn().mockReturnValue(mockQuery),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'mock-user-id', email: 'test@example.com' } },
        error: null,
      }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: { id: 'mock-user-id', email: 'test@example.com' }, session: {} },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return { mockClient, mockQuery };
};

// Export default mock
export const mockSupabaseClient = createMockSupabaseClient().mockClient;

// Mock factory for individual test files
export const createTestSupabaseMock = () => {
  const { mockClient, mockQuery } = createMockSupabaseClient();
  
  return {
    mockClient,
    mockQuery,
    mockModule: () => ({
      createClient: vi.fn(() => mockClient)
    })
  };
};