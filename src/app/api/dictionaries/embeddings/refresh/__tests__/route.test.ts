import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

 
type SupabaseClientMock = {
  auth: { getUser: ReturnType<typeof vi.fn> }
  from: ReturnType<typeof vi.fn>
}

const mockSupabase: SupabaseClientMock = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

// embeddingQueue は呼ばれない経路（401,404）のみ確認
vi.mock('@/lib/embedding-queue', () => ({
  embeddingQueue: { enqueueOrganization: vi.fn(async () => ({ id: 'job', total: 0, status: 'queued' })) },
}))

import { POST, GET } from '../route'

describe('Embeddings Refresh API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST: 未認証は401', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('x') })
    const req = new NextRequest('http://localhost:3000/api/dictionaries/embeddings/refresh', { method: 'POST', body: JSON.stringify({}) })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('GET: 未認証は401', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('x') })
    const req = new NextRequest('http://localhost:3000/api/dictionaries/embeddings/refresh', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })
})


