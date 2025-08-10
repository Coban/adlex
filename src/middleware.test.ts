import type { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Middleware', () => {
  type CookieItem = { name: string; value: string; options?: Record<string, unknown> }
  type CookieConfig = { cookies: { getAll: () => CookieItem[]; setAll: (cookies: CookieItem[]) => void } }
  type MockSupabaseClient = { auth: { getUser: ReturnType<typeof vi.fn> } }

  let mockSupabaseClient: MockSupabaseClient
  let mockNextResponse: { cookies: { set: ReturnType<typeof vi.fn> }; headers: Headers }
  let mockCreateServerClient: ReturnType<typeof vi.fn>
  let mockNextResponseNext: ReturnType<typeof vi.fn>
  let mockRequest: NextRequest

  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks()
    vi.resetModules()
    
    // Create fresh mocks for each test
    mockSupabaseClient = {
      auth: {
        getUser: vi.fn(() => Promise.resolve({
          data: { user: { id: 'test-user-id', email: 'test@example.com' } },
          error: null
        }))
      }
    }

    mockNextResponse = {
      cookies: {
        set: vi.fn()
      },
      headers: new Headers()
    }

    mockCreateServerClient = vi.fn(() => mockSupabaseClient)
    mockNextResponseNext = vi.fn(() => mockNextResponse)

    // Mock modules
    vi.doMock('@supabase/ssr', () => ({
      createServerClient: mockCreateServerClient
    }))

    vi.doMock('next/server', async () => {
      const actual = await vi.importActual('next/server')
      return {
        ...actual,
        NextResponse: {
          next: mockNextResponseNext
        }
      }
    })
    
    // Create mock request
    mockRequest = {
      url: 'http://localhost:3000/test-path',
      cookies: {
        getAll: vi.fn(() => []),
        set: vi.fn()
      }
    } as unknown as NextRequest

    // Set up environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key'
  })

  describe('middleware function', () => {
    it('should process request and return response', async () => {
      const { middleware } = await import('../middleware')
      const response = await middleware(mockRequest)
      
      expect(response).toBeDefined()
      expect(mockNextResponseNext).toHaveBeenCalled()
    })

    it('should create Supabase client with environment variables', async () => {
      const { middleware } = await import('../middleware')
      
      await middleware(mockRequest)
      
      expect(mockCreateServerClient).toHaveBeenCalledWith(
        'http://localhost:54321',
        'mock-anon-key',
        expect.objectContaining({
          cookies: expect.objectContaining({
            getAll: expect.any(Function),
            setAll: expect.any(Function)
          })
        })
      )
    })

    it('should call getUser to check authentication', async () => {
      const { middleware } = await import('../middleware')
      
      await middleware(mockRequest)
      
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled()
    })

    it('should handle cookies correctly', async () => {
      const mockCookies = [
        { name: 'session', value: 'test-session-value' }
      ]
      const getAllSpy = vi.fn(() => mockCookies)
      mockRequest.cookies.getAll = getAllSpy

      let cookieConfig: CookieConfig | undefined
      mockCreateServerClient.mockImplementation((url: string, key: string, config: CookieConfig) => {
        cookieConfig = config
        return mockSupabaseClient
      })

      const { middleware } = await import('../middleware')
      await middleware(mockRequest)
      
      // The cookies.getAll should be called through the Supabase client config
      expect(cookieConfig).toBeDefined()
      cookieConfig!.cookies.getAll()
      expect(getAllSpy).toHaveBeenCalled()
    })

    it('should handle authentication errors gracefully', async () => {
      // Mock getUser to return an error for this test
      mockSupabaseClient.auth.getUser = vi.fn(() => Promise.resolve({
        data: { user: null },
        error: { message: 'Authentication error' }
      }))

      const { middleware } = await import('../middleware')
      const response = await middleware(mockRequest)
      
      expect(response).toBeDefined()
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled()
    })
  })

  describe('config', () => {
    it('should have correct matcher configuration', async () => {
      const { config } = await import('../middleware')
      
      expect(config).toBeDefined()
      expect(config.matcher).toBeDefined()
      expect(Array.isArray(config.matcher)).toBe(true)
      expect(config.matcher).toHaveLength(1)
    })

    it('should exclude static files and images', async () => {
      const { config } = await import('../middleware')
      const matcher = config.matcher[0]
      
      // The matcher uses negative lookahead, so check for presence of exclusion patterns
      expect(matcher).toContain('_next/static')
      expect(matcher).toContain('_next/image') 
      expect(matcher).toContain('favicon.ico')
      expect(matcher).toContain('svg|png|jpg|jpeg|gif|webp')
    })
  })

  describe('cookie handling', () => {
    it('should handle cookie operations through Supabase client config', async () => {
      let cookieConfig: CookieConfig | undefined
      mockCreateServerClient.mockImplementation((url: string, key: string, config: CookieConfig) => {
        cookieConfig = config
        return mockSupabaseClient
      })

      const { middleware } = await import('../middleware')
      await middleware(mockRequest)

      // Test getAll function
      expect(cookieConfig).toBeDefined()
      expect(cookieConfig!.cookies.getAll).toBeInstanceOf(Function)
      cookieConfig!.cookies.getAll()
      expect(mockRequest.cookies.getAll).toHaveBeenCalled()

      // Test setAll function
      expect(cookieConfig!.cookies.setAll).toBeInstanceOf(Function)
      const testCookies = [
        { name: 'test-cookie', value: 'test-value', options: { httpOnly: true } }
      ]
      cookieConfig!.cookies.setAll(testCookies)

      expect(mockRequest.cookies.set).toHaveBeenCalledWith('test-cookie', 'test-value')
      expect(mockNextResponse.cookies.set).toHaveBeenCalledWith('test-cookie', 'test-value', { httpOnly: true })
    })
  })

  describe('environment variables', () => {
    it('should use SUPABASE_URL environment variable', async () => {
      const { middleware } = await import('../middleware')
      
      await middleware(mockRequest)
      
      expect(mockCreateServerClient).toHaveBeenCalledWith(
        'http://localhost:54321',
        'mock-anon-key',
        expect.any(Object)
      )
    })

    it('should use SUPABASE_ANON_KEY environment variable', async () => {
      const { middleware } = await import('../middleware')
      
      await middleware(mockRequest)
      
      expect(mockCreateServerClient).toHaveBeenCalledWith(
        expect.any(String),
        'mock-anon-key',
        expect.any(Object)
      )
    })
  })

  describe('middleware flow', () => {
    it('should complete full middleware execution', async () => {
      const { middleware } = await import('../middleware')
      const response = await middleware(mockRequest)
      
      expect(mockCreateServerClient).toHaveBeenCalledOnce()
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledOnce()
      expect(mockNextResponseNext).toHaveBeenCalledWith({ request: mockRequest })
      expect(response).toBe(mockNextResponse)
    })
  })
})