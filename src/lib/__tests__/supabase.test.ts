import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createClient } from '@/lib/supabase/client'
import { createClient as createServerClient } from '@/lib/supabase/server'

describe('Supabase Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Client-side Supabase client', () => {
    it('should create client with correct configuration', () => {
      const client = createClient()
      
      expect(client).toBeDefined()
      expect(client.auth).toBeDefined()
      expect(client.from).toBeDefined()
    })

    it('should have auth methods', () => {
      const client = createClient()
      
      expect(typeof client.auth.signInWithPassword).toBe('function')
      expect(typeof client.auth.signUp).toBe('function')
      expect(typeof client.auth.signOut).toBe('function')
      expect(typeof client.auth.getUser).toBe('function')
      expect(typeof client.auth.getSession).toBe('function')
    })

    it('should have database methods', () => {
      const client = createClient()
      
      expect(typeof client.from).toBe('function')
      expect(typeof client.rpc).toBe('function')
    })
  })

  describe.skip('Server-side Supabase client', () => {
    it('should create server client with correct configuration', async () => {
      const client = await createServerClient()
      
      expect(client).toBeDefined()
      expect(client.auth).toBeDefined()
      expect(client.from).toBeDefined()
    })

    it('should have auth methods', async () => {
      const client = await createServerClient()
      
      expect(typeof client.auth.getUser).toBe('function')
      expect(typeof client.auth.getSession).toBe('function')
    })

    it('should have database methods', async () => {
      const client = await createServerClient()
      
      expect(typeof client.from).toBe('function')
      expect(typeof client.rpc).toBe('function')
    })
  })

  describe('Environment configuration', () => {
    it('should use environment variables', () => {
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined()
      expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeDefined()
    })

    it('should handle missing environment variables gracefully', () => {
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      // Client should handle missing env vars gracefully
      expect(() => createClient()).not.toThrow()
      
      // Restore environment variables
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey
    })
  })
})