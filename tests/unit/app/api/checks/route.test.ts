import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { POST } from '@/app/api/checks/route'
import { CreateCheckUseCase } from '@/core/usecases/checks/createCheck'
import { mockRepositories } from 'tests/mocks/repositories'

// Mock the repository provider
vi.mock('@/core/ports', () => ({
  getRepositories: vi.fn(),
}))

// Mock Supabase auth
vi.mock('@/infra/supabase/serverClient', () => ({
  createClient: vi.fn(() => ({
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

// Mock CreateCheckUseCase
vi.mock('@/core/usecases/checks/createCheck', () => ({
  CreateCheckUseCase: vi.fn()
}))

const mockAuth = {
  getUser: vi.fn()
}

const mockSupabaseClient = {
  auth: mockAuth
}


describe('Checks API Route (Unit Tests)', () => {
  let mockCreateCheckUseCase: { execute: ReturnType<typeof vi.fn> }
  
  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Reset mock repositories
    mockRepositories.users.reset()
    mockRepositories.organizations.reset()
    mockRepositories.checks.reset()
    
    // Mock auth and repositories
    const supabaseModule = await import('@/infra/supabase/serverClient')
    const repositoriesModule = await import('@/core/ports')
    
    vi.mocked(supabaseModule.createClient).mockResolvedValue(mockSupabaseClient as unknown as Awaited<ReturnType<typeof supabaseModule.createClient>>)
    vi.mocked(repositoriesModule.getRepositories).mockResolvedValue(mockRepositories)
    
    // Default to authenticated user
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null
    })
    
    mockRepositories.users.findById.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      role: 'user',
      organization_id: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    })
    
    // Mock CreateCheckUseCase 
    mockCreateCheckUseCase = {
      execute: vi.fn()
    }
    vi.mocked(CreateCheckUseCase).mockImplementation(() => mockCreateCheckUseCase as unknown as InstanceType<typeof CreateCheckUseCase>)
  })

  describe('POST /api/checks', () => {
    it('should create a new check successfully', async () => {
      // Mock successful UseCase response
      mockCreateCheckUseCase.execute.mockResolvedValue({
        success: true,
        data: {
          checkId: 1,
          status: 'pending',
          message: 'Check created successfully'
        }
      })

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
      expect(data).toHaveProperty('checkId', 1)
      expect(data).toHaveProperty('status', 'pending')
      
      // Verify UseCase was called with correct input
      expect(mockCreateCheckUseCase.execute).toHaveBeenCalledWith({
        userId: 'user-123',
        organizationId: 1,
        originalText: 'Test text for checking',
        inputType: 'text',
        fileName: undefined
      })
    })

    it('should handle missing text input', async () => {
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
      expect(data.error).toEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('テキストは1文字以上である必要があります')
        })
      )
    })

    it('should handle empty text input', async () => {
      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: ''  // empty string should trigger validation
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('テキストは1文字以上である必要があります')
        })
      )
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
      expect(data.error).toEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('テキストは10,000文字以下である必要があります'),
          details: expect.any(Array)
        })
      )
    })

    it('should handle authentication failure', async () => {
      mockAuth.getUser.mockResolvedValue({
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
      expect(data.error).toEqual({
        code: 'AUTHENTICATION_ERROR',
        message: 'Unauthorized',
        details: undefined
      })
    })

    it('should handle usage limit exceeded', async () => {
      // Mock UseCase to return usage limit error
      mockCreateCheckUseCase.execute.mockResolvedValue({
        success: false,
        error: {
          code: 'USAGE_LIMIT_EXCEEDED',
          message: 'Monthly usage limit exceeded'
        }
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

      expect(response.status).toBe(429)
      expect(data.error).toEqual({
        code: 'USAGE_LIMIT_EXCEEDED',
        message: 'Monthly usage limit exceeded',
        details: undefined
      })
    })

    it('should handle user not found', async () => {
      mockRepositories.users.findById.mockResolvedValue(null)

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
      expect(data.error).toEqual({
        code: 'AUTHORIZATION_ERROR',
        message: 'User not in organization',
        details: undefined
      })
    })

    it('should handle organization not found', async () => {
      mockRepositories.users.findById.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        organization_id: null,
        role: 'user',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
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
      expect(data.error).toEqual({
        code: 'AUTHORIZATION_ERROR',
        message: 'User not in organization',
        details: undefined
      })
    })

    it('should handle check creation failure', async () => {
      // Mock UseCase to return creation failure
      mockCreateCheckUseCase.execute.mockResolvedValue({
        success: false,
        error: {
          code: 'REPOSITORY_ERROR',
          message: 'チェックの作成に失敗しました'
        }
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

      expect(response.status).toBe(500)
      expect(data.error).toEqual({
        code: 'REPOSITORY_ERROR',
        message: 'チェックの作成に失敗しました'
      })
    })

    it('should handle image input type', async () => {
      // Mock UseCase to return successful image check creation
      mockCreateCheckUseCase.execute.mockResolvedValue({
        success: true,
        data: {
          checkId: 2,
          status: 'pending',
          message: 'Image check created successfully'
        }
      })

      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputType: 'image',
          text: 'dummy text for image' // Need some text to pass validation
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('checkId', 2)
      expect(data).toHaveProperty('status', 'pending')
    })

    it('should handle missing image_url for image input type', async () => {
      const request = new NextRequest('http://localhost:3000/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputType: 'image'
          // missing text field will trigger validation error
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('テキストは1文字以上である必要があります'),
          details: expect.any(Array)
        })
      )
    })
  })
})