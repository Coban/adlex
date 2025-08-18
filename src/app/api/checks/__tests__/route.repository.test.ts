import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { POST } from '../route'
import { createMockRepositories, setupRepositoryMock, repositoryPresets } from '@/test/mocks/repositories'

// Mock the repository provider
vi.mock('@/lib/repositories', () => ({
  getRepositories: vi.fn(),
}))

// Mock Supabase auth
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({
    auth: {
      getUser: vi.fn()
    }
  }))
}))

// Mock queue manager
vi.mock('@/lib/queue-manager', () => ({
  queueManager: {
    addToQueue: vi.fn().mockResolvedValue(undefined)
  }
}))

import { getRepositories } from '@/lib/repositories'
import { createClient } from '@/lib/supabase/server'
import { queueManager } from '@/lib/queue-manager'

describe('Checks API Route with Repository Pattern', () => {
  let mockRepositories: ReturnType<typeof createMockRepositories>
  let mockSupabaseClient: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create fresh repository mocks for each test
    mockRepositories = createMockRepositories()
    
    // Setup default Supabase client mock
    mockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'user-123',
              email: 'test@example.com'
            }
          },
          error: null
        })
      }
    }
    
    // Setup mocks to return our instances
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient)
    vi.mocked(getRepositories).mockResolvedValue(mockRepositories)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('POST /api/checks', () => {
    it('should create a new check successfully', async () => {
      // Setup repository mocks with presets
      const userPreset = repositoryPresets.authenticatedUser('user-123', 1)
      const checkPreset = repositoryPresets.successfulCheckCreation(1)
      
      mockRepositories.users.findById = userPreset.users.findById
      mockRepositories.organizations.findById = userPreset.organizations.findById
      mockRepositories.checks.create = checkPreset.checks.create

      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'Test text for checking'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('id', 1)
      expect(data).toHaveProperty('status', 'pending')
      
      // Verify repository methods were called
      expect(mockRepositories.users.findById).toHaveBeenCalledWith('user-123')
      expect(mockRepositories.organizations.findById).toHaveBeenCalledWith(1)
      expect(mockRepositories.checks.create).toHaveBeenCalled()
      expect(queueManager.addToQueue).toHaveBeenCalledWith(
        1, // check id
        'Test text for checking', // text
        1, // organization id
        'normal', // priority
        'text', // input type
        undefined // image url
      )
    })

    it('should handle missing text input', async () => {
      // Setup basic authenticated user
      const userPreset = repositoryPresets.authenticatedUser()
      mockRepositories.users.findById = userPreset.users.findById
      mockRepositories.organizations.findById = userPreset.organizations.findById

      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error', 'Text is required')
    })

    it('should handle empty text input', async () => {
      // Setup basic authenticated user
      const userPreset = repositoryPresets.authenticatedUser()
      mockRepositories.users.findById = userPreset.users.findById
      mockRepositories.organizations.findById = userPreset.organizations.findById

      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: ''
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error', 'Text cannot be empty')
    })

    it('should handle text exceeding character limit', async () => {
      const longText = 'a'.repeat(10001)
      
      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: longText
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error', 'Text too long (max 10000 characters)')
    })

    it('should handle authentication failure', async () => {
      // Mock auth failure
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
      // Setup user with exceeded usage
      const userPreset = repositoryPresets.authenticatedUser()
      const orgPreset = repositoryPresets.usageLimitExceeded(1)
      
      mockRepositories.users.findById = userPreset.users.findById
      mockRepositories.organizations.findById = orgPreset.organizations.findById

      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'Test text'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data).toHaveProperty('error', 'Monthly usage limit exceeded')
      expect(data).toHaveProperty('usage', 100)
      expect(data).toHaveProperty('limit', 100)
    })

    it('should handle user not found', async () => {
      // Mock user not found
      mockRepositories.users.findById = vi.fn().mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'Test text'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('error', 'User not found')
    })

    it('should handle organization not found', async () => {
      // Setup user without organization
      mockRepositories.users.findById = vi.fn().mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        organization_id: null,
        role: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'Test text'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('error', 'User not in organization')
    })

    it('should handle check creation failure', async () => {
      // Setup basic user and org
      const userPreset = repositoryPresets.authenticatedUser()
      mockRepositories.users.findById = userPreset.users.findById
      mockRepositories.organizations.findById = userPreset.organizations.findById
      
      // Mock check creation failure
      mockRepositories.checks.create = vi.fn().mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

    it('should handle image input type', async () => {
      // Setup repository mocks
      const userPreset = repositoryPresets.authenticatedUser()
      const checkPreset = repositoryPresets.successfulCheckCreation(2)
      
      mockRepositories.users.findById = userPreset.users.findById
      mockRepositories.organizations.findById = userPreset.organizations.findById
      
      // Mock check creation for image type
      mockRepositories.checks.create = vi.fn().mockResolvedValue({
        id: 2,
        status: 'pending',
        original_text: '',
        input_type: 'image',
        image_url: 'https://example.com/image.jpg',
        ocr_status: 'pending',
        created_at: new Date().toISOString(),
      })

      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input_type: 'image',
          image_url: 'https://example.com/image.jpg'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('id', 2)
      expect(data).toHaveProperty('status', 'pending')
      
      // Verify queue was called with image parameters
      expect(queueManager.addToQueue).toHaveBeenCalledWith(
        2, // check id
        '', // empty text for image
        1, // organization id
        'normal', // priority
        'image', // input type
        'https://example.com/image.jpg' // image url
      )
    })

    it('should handle missing image_url for image input type', async () => {
      // Setup basic authenticated user
      const userPreset = repositoryPresets.authenticatedUser()
      mockRepositories.users.findById = userPreset.users.findById
      mockRepositories.organizations.findById = userPreset.organizations.findById

      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input_type: 'image'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error', 'image_url is required for image checks')
    })
  })
})