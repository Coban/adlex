import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    auth: {
      exchangeCodeForSession: vi.fn(),
    },
  } as unknown as { auth: { exchangeCodeForSession: ReturnType<typeof vi.fn> } },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => supabaseMock),
}))

import { GET } from '../route'

describe('auth/callback GET', () => {
  const OLD_ENV = process.env.NODE_ENV
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'development'
  })
  afterEach(() => {
    process.env.NODE_ENV = OLD_ENV
  })

  it('code が無い場合はエラーページへリダイレクト', async () => {
    const req = new NextRequest('http://localhost:3000/auth/callback')
    const res = await GET(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/auth/auth-code-error')
  })

  it('code がある場合はセッション交換後に next へリダイレクト', async () => {
    supabaseMock.auth.exchangeCodeForSession.mockResolvedValue({ error: null })
    const req = new NextRequest('http://localhost:3000/auth/callback?code=abc&next=%2Fdashboard')
    const res = await GET(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard')
  })
})


