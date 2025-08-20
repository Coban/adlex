import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Target under test
import { GET } from '@/app/api/checks/stream/route'

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

// Mocks
type SupabaseClientMock = {
  auth: { getUser: ReturnType<typeof vi.fn> }
  from: ReturnType<typeof vi.fn>
  channel: ReturnType<typeof vi.fn>
}

const mockSupabase: SupabaseClientMock = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
  channel: vi.fn(),
}

// Mock repositories
const mockRepositories = {
  users: {
    findById: vi.fn()
  },
  organizations: {
    findById: vi.fn()
  },
  checks: {
    findMany: vi.fn()
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('@/core/ports', () => ({
  getRepositories: vi.fn(() => Promise.resolve(mockRepositories))
}))

vi.mock('@/lib/queue-manager', () => ({
  queueManager: {
    getStatus: vi.fn(() => ({ queueLength: 0, processingCount: 0, maxConcurrent: 3 }))
  }
}))

function setupSupabaseStreams() {
  // users profile - need proper maybeSingle method
  const usersQuery = createMockQueryBuilder()
  usersQuery.eq.mockReturnValue({ maybeSingle: vi.fn(async () => ({ data: { id: 'u1', organization_id: 1, role: 'admin' }, error: null })) })
  
  // checks in pending/processing
  const checksQuery = createMockQueryBuilder() 
  checksQuery.in.mockReturnValue({ order: vi.fn(async () => ({ data: [], error: null })) })
  
  // organizations
  const orgsQuery = createMockQueryBuilder()
  orgsQuery.eq.mockReturnValue({ single: vi.fn(async () => ({ data: { max_checks: 100, used_checks: 10 }, error: null })) })

  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'users') return usersQuery
    if (table === 'checks') return checksQuery
    if (table === 'organizations') return orgsQuery
    return createMockQueryBuilder()
  })

  mockSupabase.channel.mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn((cb: (status: string) => void) => { if (typeof cb === 'function') { cb('SUBSCRIBED') } return { unsubscribe: vi.fn() } }),
    unsubscribe: vi.fn()
  })
}

describe('GET /api/checks/stream (SSE)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the mock query builder
    const newMockQuery = createMockQueryBuilder();
    mockSupabase.from.mockReturnValue(newMockQuery);
  })

  it('認証エラー時は401を返す', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('no') })
    const req = new NextRequest('http://localhost:3000/api/checks/stream')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('SSEを開始し、最初のキュー状態を返す', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    
    // Setup repository mocks
    mockRepositories.users.findById.mockResolvedValue({
      id: 'u1',
      organization_id: 1,
      role: 'admin'
    })
    mockRepositories.organizations.findById.mockResolvedValue({
      max_checks: 100,
      used_checks: 10
    })
    mockRepositories.checks.findMany.mockResolvedValue([])
    
    setupSupabaseStreams()

    const req = new NextRequest('http://localhost:3000/api/checks/stream')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')

    // Read first chunk from stream
    const reader = (res.body as ReadableStream<Uint8Array>).getReader()
    const { value } = await reader.read()
    const text = new TextDecoder().decode(value)
    expect(text).toContain('queue_status')
  })
})
