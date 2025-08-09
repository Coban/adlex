import { describe, it, expect, vi } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn((url: string, key: string) => ({ url, key })),
}))

import { supabase } from '../supabase'
import { createClient } from '@supabase/supabase-js'

describe('supabase public client', () => {
  it('createClient が呼ばれる', () => {
    expect(supabase).toBeDefined()
    expect(createClient).toHaveBeenCalled()
  })
})


