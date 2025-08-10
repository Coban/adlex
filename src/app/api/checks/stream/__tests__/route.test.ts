import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Target under test
import { GET } from '../route'

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

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase)
}))

vi.mock('@/lib/queue-manager', () => ({
  queueManager: {
    getStatus: vi.fn(() => ({ queueLength: 0, processingCount: 0, maxConcurrent: 3 }))
  }
}))

function setupSupabaseStreams() {
  // users profile
  const usersSelect = { eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: 'u1', organization_id: 1, role: 'admin' }, error: null })) })) }
  // checks in pending/processing
  const checksSelect = {
    in: vi.fn(() => ({ order: vi.fn(async () => ({ data: [], error: null })) })),
    select: vi.fn(),
  }
  // organizations
  const orgsSelect = { eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { max_checks: 100, used_checks: 10 }, error: null })) })) }

  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'users') return { select: vi.fn(() => usersSelect) }
    if (table === 'checks') return { select: vi.fn(() => checksSelect), in: checksSelect.in, order: vi.fn() }
    if (table === 'organizations') return { select: vi.fn(() => orgsSelect) }
    return {}
  })

  mockSupabase.channel.mockReturnValue({
    on: vi.fn().mockReturnThis(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subscribe: vi.fn((cb: any) => { if (typeof cb === 'function') { cb('SUBSCRIBED') } return { unsubscribe: vi.fn() } }),
    unsubscribe: vi.fn()
  })
}

describe('GET /api/checks/stream (SSE)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('認証エラー時は401を返す', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('no') })
    const req = new NextRequest('http://localhost:3000/api/checks/stream')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('SSEを開始し、最初のキュー状態を返す', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
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
