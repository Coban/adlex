import { describe, it, expect, vi } from 'vitest'

const mockCreateBrowserClient = vi.fn((url: string, key: string) => ({ url, key }))

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: mockCreateBrowserClient,
}))

// Import must be after mock setup
import { createBrowserClient } from '@supabase/ssr'

describe('supabase public client', () => {
  it('createBrowserClient が呼ばれる', async () => {
    // Import after mock is set up to trigger the mock
    const { createClient } = await import('@/lib/supabase')
    const client = createClient()
    expect(client).toBeDefined()
    expect(mockCreateBrowserClient).toHaveBeenCalled()
  })
})


