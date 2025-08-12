import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ auth: {}, from: () => ({}) })),
}))

// import after mock
import { createAdminClient } from '../supabase/admin'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

describe('supabase admin client', () => {
  const OLD_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const OLD_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = OLD_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = OLD_KEY
  })

  it('環境変数が揃っていれば作成できる', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

    const client = createAdminClient()
    expect(client).toBeDefined()
    expect(createSupabaseClient).toHaveBeenCalled()
  })

  it('環境変数が不足していればエラー', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    expect(() => createAdminClient()).toThrow()
  })
})


