import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({ auth: {}, from: vi.fn(), rpc: vi.fn() })),
}))

import { useSupabase } from '../use-supabase'

describe('useSupabase', () => {
  it('Supabase クライアントを返す', () => {
    const { result } = renderHook(() => useSupabase())
    expect(result.current).toBeTruthy()
    expect(typeof result.current.from).toBe('function')
  })
})


