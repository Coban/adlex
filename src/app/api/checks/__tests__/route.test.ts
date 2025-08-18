import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Supabase client first to avoid hoisting issues
const mockSupabaseClient = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}))

import { POST } from '../route'

// Mock AI client
vi.mock('@/lib/ai-client', () => ({
  createChatCompletion: vi.fn(),
  createEmbedding: vi.fn(),
  isUsingLMStudio: vi.fn(() => false)
}))

import { createChatCompletion, createEmbedding } from '../../../../lib/ai-client'

// Set up AI client mocks with proper return values
vi.mocked(createChatCompletion).mockResolvedValue({
  id: 'chatcmpl-123',
  object: 'chat.completion',
  choices: [{
    message: {
      role: 'assistant',
      content: null,
      function_call: {
        name: 'check_text',
        arguments: JSON.stringify({
          violations: [],
          modified_text: 'Safe text'
        })
      }
    }
  }]
})

vi.mocked(createEmbedding).mockResolvedValue([0.1, 0.2, 0.3])

describe('Checks API Route', () => {
  // Helper function to create mock Supabase response for user profile
  const createUserProfileMock = (userData: unknown) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(() => Promise.resolve({
          data: userData,
          error: null
        }))
      }))
    }))
  })

  // Helper function to create mock Supabase response for organization data
  const createOrganizationMock = (orgData: unknown) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({
          data: orgData,
          error: null
        }))
      }))
    }))
  })

  // Helper function to create mock Supabase response for check insertion
  const createCheckInsertMock = (checkData: unknown) => ({
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({
          data: checkData,
          error: null
        }))
      }))
    }))
  })

  // Helper function to mock standard Supabase calls
  const mockStandardSupabaseCalls = () => {
    // Mock user profile
    mockSupabaseClient.from.mockReturnValueOnce(createUserProfileMock({
      id: 'user-123',
      organization_id: 'org-123',
      role: 'user'
    }))

    // Mock organization data 
    mockSupabaseClient.from.mockReturnValueOnce(createOrganizationMock({
      id: 'org-123',
      used_checks: 10,
      max_checks: 100
    }))
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set up default environment variables
    process.env.NODE_ENV = 'development'
    process.env.SKIP_AUTH = 'true'
    
    // Mock successful auth response
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com'
        }
      },
      error: null
    })
    
    // Ensure createClient returns the mock properly
    // This should already be set up by the vi.mock call above
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe.skip('POST /api/checks', () => {
    it('should create a new check successfully', async () => {
      // Mock RPC calls
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null
      })

      mockSupabaseClient.from
        .mockReturnValueOnce(createUserProfileMock({
          id: 'user-123',
          organization_id: 'org-123',
          role: 'user'
        }))
        .mockReturnValueOnce(createOrganizationMock({
          id: 'org-123',
          used_checks: 10,
          max_checks: 100
        }))
        .mockReturnValueOnce(createCheckInsertMock({
          id: 1,
          original_text: 'Test text',
          status: 'pending',
          user_id: 'user-123',
          organization_id: 'org-123'
        }))

      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({
          text: 'Test text for checking'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('status', 'pending')
    })

    it.skip('should handle missing text input', async () => {
      // Mock user profile for this test
      mockSupabaseClient.from.mockReturnValueOnce(createUserProfileMock({
        id: 'user-123',
        organization_id: 'org-123',
        role: 'user'
      }))

      // Mock organization data 
      mockSupabaseClient.from.mockReturnValueOnce(createOrganizationMock({
        id: 'org-123',
        used_checks: 10,
        max_checks: 100
      }))

      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({})
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error', 'Text is required')
    })

    it('should handle empty text input', async () => {
      mockStandardSupabaseCalls()

      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({
          text: ''
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error', 'Text is required')
    })

    it('should handle text exceeding character limit', async () => {
      const longText = 'a'.repeat(10001)
      
      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({
          text: longText
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error', 'Text must be 10,000 characters or less')
    })

    it('should handle authentication failure', async () => {
      process.env.SKIP_AUTH = 'false'
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Authentication failed')
      })

      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: 'Test text'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toHaveProperty('error', 'Unauthorized')
    })

    it('should handle usage limit exceeded', async () => {
      process.env.SKIP_AUTH = 'false'
      
      // Mock user profile
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({
              data: {
                id: 'user-123',
                organization_id: 'org-123',
                role: 'user'
              },
              error: null
            }))
          }))
        }))
      })

      // Mock organization data with exceeded usage
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: {
                id: 'org-123',
                used_checks: 100,
                max_checks: 100
              },
              error: null
            }))
          }))
        }))
      })

      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({
          text: 'Test text'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data).toHaveProperty('error', 'Usage limit exceeded')
    })

    it('should handle user profile not found', async () => {
      process.env.SKIP_AUTH = 'false'
      
      // Mock user profile not found
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({
              data: null,
              error: new Error('User not found')
            }))
          }))
        }))
      })

      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({
          text: 'Test text'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('error', 'User profile not found')
    })

    it('should handle organization not found', async () => {
      process.env.SKIP_AUTH = 'false'
      
      // Mock user profile
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({
              data: {
                id: 'user-123',
                organization_id: 'org-123',
                role: 'user'
              },
              error: null
            }))
          }))
        }))
      })

      // Mock organization not found
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: null,
              error: new Error('Organization not found')
            }))
          }))
        }))
      })

      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({
          text: 'Test text'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('error', 'Organization not found')
    })

    it('should handle database insertion error', async () => {
      // Mock user profile
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({
              data: {
                id: 'user-123',
                organization_id: 'org-123',
                role: 'user'
              },
              error: null
            }))
          }))
        }))
      })

      // Mock organization data
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: {
                id: 'org-123',
                used_checks: 10,
                max_checks: 100
              },
              error: null
            }))
          }))
        }))
      })

      // Mock check insertion failure
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: null,
              error: new Error('Database insertion failed')
            }))
          }))
        }))
      })

      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({
          text: 'Test text'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toHaveProperty('error', 'Failed to create check')
    })

    it('should process text with AI in background', async () => {
      // Mock user profile
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({
              data: {
                id: 'user-123',
                organization_id: 'org-123',
                role: 'user'
              },
              error: null
            }))
          }))
        }))
      })

      // Mock organization data
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: {
                id: 'org-123',
                used_checks: 10,
                max_checks: 100
              },
              error: null
            }))
          }))
        }))
      })

      // Mock check insertion
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: {
                id: 1,
                original_text: 'Test text',
                status: 'pending',
                user_id: 'user-123',
                organization_id: 'org-123'
              },
              error: null
            }))
          }))
        }))
      })

      // Mock dictionary search
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          textSearch: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({
              data: [
                {
                  id: 1,
                  phrase: '効果',
                  category: 'NG',
                  reason: 'Effectiveness claims',
                  embedding: [0.1, 0.2, 0.3]
                }
              ],
              error: null
            }))
          }))
        }))
      })

      // Mock AI responses
      vi.mocked(createEmbedding).mockResolvedValue({
        object: 'list',
        data: [{
          object: 'embedding',
          embedding: [0.1, 0.2, 0.3],
          index: 0
        }]
      })

      vi.mocked(createChatCompletion).mockResolvedValue({
        id: 'chatcmpl-123',
        object: 'chat.completion',
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            function_call: {
              name: 'check_text',
              arguments: JSON.stringify({
                violations: [{
                  start_pos: 0,
                  end_pos: 4,
                  reason: 'Effectiveness claims'
                }],
                modified_text: 'Safe text'
              })
            }
          }
        }]
      })

      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({
          text: 'Test text with effectiveness claims'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('status', 'pending')
    })

    it('should handle AI processing errors', async () => {
      // Mock user profile
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({
              data: {
                id: 'user-123',
                organization_id: 'org-123',
                role: 'user'
              },
              error: null
            }))
          }))
        }))
      })

      // Mock organization data
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: {
                id: 'org-123',
                used_checks: 10,
                max_checks: 100
              },
              error: null
            }))
          }))
        }))
      })

      // Mock check insertion
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: {
                id: 1,
                original_text: 'Test text',
                status: 'pending',
                user_id: 'user-123',
                organization_id: 'org-123'
              },
              error: null
            }))
          }))
        }))
      })

      // Mock dictionary search
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          textSearch: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({
              data: [],
              error: null
            }))
          }))
        }))
      })

      // Mock AI error
      vi.mocked(createEmbedding).mockRejectedValue(new Error('AI service unavailable'))

      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({
          text: 'Test text'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('status', 'pending')
    })

    it('should skip auth in test mode', async () => {
      process.env.NODE_ENV = 'test'
      process.env.SKIP_AUTH = 'true'

      // Mock organization data for test user
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: {
                id: 'test-org',
                used_checks: 0,
                max_checks: 1000
              },
              error: null
            }))
          }))
        }))
      })

      // Mock check insertion
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: {
                id: 1,
                original_text: 'Test text',
                status: 'pending',
                user_id: '11111111-1111-1111-1111-111111111111',
                organization_id: 'test-org'
              },
              error: null
            }))
          }))
        }))
      })

      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: 'Test text'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('status', 'pending')
      expect(mockSupabaseClient.auth.getUser).not.toHaveBeenCalled()
    })

    it('should handle invalid JSON request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: 'invalid json'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error', 'Invalid JSON')
    })

    it('should handle missing content type', async () => {
      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({
          text: 'Test text'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error', 'Content-Type must be application/json')
    })
  })
})