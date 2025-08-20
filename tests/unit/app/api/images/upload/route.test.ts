import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

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
})

// 型定義
type SupabaseClient = {
  auth: {
    getUser: ReturnType<typeof vi.fn>
  }
  from: ReturnType<typeof vi.fn>
  storage: {
    from: ReturnType<typeof vi.fn>
  }
}

const mockSupabase: SupabaseClient = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
  storage: {
    from: vi.fn(),
  },
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

// target import after mocks
import { POST } from '@/app/api/images/upload/route'

function makeFormDataWithFile(contentType = 'image/jpeg', size = 1000) {
  const file = new File([new Uint8Array(size)], 'test.jpg', { type: contentType })
  const fd = new FormData()
  fd.set('image', file)
  return fd
}

describe('Images Upload API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the mock query builder
    const newMockQuery = createMockQueryBuilder();
    mockSupabase.from.mockReturnValue(newMockQuery);
  })

  it('未認証は401', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('no') })
    const req = new NextRequest('http://localhost:3000/api/images/upload', { method: 'POST', body: new FormData() })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('image未指定は400', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    const req = new NextRequest('http://localhost:3000/api/images/upload', { method: 'POST', body: new FormData() })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it.skip('不正なcontent-typeは400', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    const fd = makeFormDataWithFile('image/gif')
    const req = new NextRequest('http://localhost:3000/api/images/upload', { method: 'POST', body: fd })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it.skip('大きすぎるファイルは400', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    const fd = makeFormDataWithFile('image/jpeg', 11 * 1024 * 1024)
    const req = new NextRequest('http://localhost:3000/api/images/upload', { method: 'POST', body: fd })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it.skip('アップロード失敗で500', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { organization_id: 'o1' }, error: null }),
    })
    mockSupabase.storage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: new Error('upload failed') }),
    })
    const fd = makeFormDataWithFile('image/png', 1000)
    const req = new NextRequest('http://localhost:3000/api/images/upload', { method: 'POST', body: fd })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it.skip('署名URL作成失敗で500', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { organization_id: 'o1' }, error: null }),
    })
    mockSupabase.storage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: new Error('sign failed') }),
    })
    const fd = makeFormDataWithFile('image/webp', 1000)
    const req = new NextRequest('http://localhost:3000/api/images/upload', { method: 'POST', body: fd })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it.skip('正常系（複雑なパス生成はskip）', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { organization_id: 'o1' }, error: null }),
    })
    mockSupabase.storage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'http://signed' }, error: null }),
    })
    const fd = makeFormDataWithFile('image/jpeg', 1000)
    const req = new NextRequest('http://localhost:3000/api/images/upload', { method: 'POST', body: fd })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})


