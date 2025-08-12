import { NextRequest } from 'next/server'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@upstash/qstash', () => ({
  Receiver: vi.fn().mockImplementation(() => ({ verify: vi.fn(async () => false) })),
}))

vi.mock('@/lib/ai-client', () => ({
  createEmbedding: vi.fn(async () => [0.1, 0.2]),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: vi.fn(() => ({ update: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })) })) })),
}))

import { POST } from '../route'

describe('QStash Embeddings Webhook', () => {
  it('署名不正は401', async () => {
    const req = new NextRequest('http://localhost:3000/api/dictionaries/embeddings/qstash', { method: 'POST', body: JSON.stringify({}) })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})


