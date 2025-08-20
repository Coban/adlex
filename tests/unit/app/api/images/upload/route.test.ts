import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the repository provider
vi.mock('@/core/ports', () => ({
  getRepositories: vi.fn(),
}))

// Mock the use case directly
vi.mock('@/core/usecases/images/uploadImage', () => ({
  UploadImageUseCase: vi.fn()
}))

// Mock Supabase client - hoisting問題を避けるため、ファクトリー内で直接定義
vi.mock('@/infra/supabase/serverClient', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn()
    },
    storage: {
      from: vi.fn()
    }
  })
}))

// Import mocked modules
import { POST } from '@/app/api/images/upload/route'
import { createClient } from '@/infra/supabase/serverClient'
import { getRepositories } from '@/core/ports'
import { UploadImageUseCase } from '@/core/usecases/images/uploadImage'

const mockCreateClient = vi.mocked(createClient)
const mockGetRepositories = vi.mocked(getRepositories)
const MockUploadImageUseCase = vi.mocked(UploadImageUseCase)

function makeFormDataWithFile(contentType = 'image/jpeg', size = 1000) {
  const file = new File([new Uint8Array(size)], 'test.jpg', { type: contentType })
  const fd = new FormData()
  fd.set('image', file)
  return fd
}

describe('Images Upload API Route', () => {
  let mockSupabaseClient: any
  let mockStorageBucket: any
  let mockUploadImageUseCaseInstance: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup mock storage bucket
    mockStorageBucket = {
      upload: vi.fn(),
      createSignedUrl: vi.fn(),
    }
    
    // Setup mock Supabase client
    mockSupabaseClient = {
      auth: {
        getUser: vi.fn()
      },
      storage: {
        from: vi.fn(() => mockStorageBucket)
      }
    }
    
    // Setup mock use case instance
    mockUploadImageUseCaseInstance = {
      execute: vi.fn()
    }
    
    // Configure mocks
    mockCreateClient.mockResolvedValue(mockSupabaseClient)
    MockUploadImageUseCase.mockImplementation(() => mockUploadImageUseCaseInstance)
    mockGetRepositories.mockResolvedValue({
      users: {
        findById: vi.fn().mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com',
          organization_id: 1,
          role: 'user' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
    } as any)
  })

  it('未認証は401', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ 
      data: { user: null }, 
      error: new Error('no') 
    })
    
    const req = new NextRequest('http://localhost:3000/api/images/upload', { 
      method: 'POST', 
      body: new FormData() 
    })
    const res = await POST(req)
    
    expect(res.status).toBe(401)
  })

  it('image未指定は400', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ 
      data: { user: { id: 'user-123' } }, 
      error: null 
    })
    
    const req = new NextRequest('http://localhost:3000/api/images/upload', { 
      method: 'POST', 
      body: new FormData() 
    })
    const res = await POST(req)
    
    expect(res.status).toBe(400)
  })

  it.skip('不正なcontent-typeは400', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ 
      data: { user: { id: 'user-123' } }, 
      error: null 
    })
    
    // ユースケースがバリデーションエラーを返すよう設定
    mockUploadImageUseCaseInstance.execute.mockResolvedValue({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'サポートされていないファイルタイプです（JPEG、PNG、WebPのみ）'
      }
    })
    
    const fd = makeFormDataWithFile('image/gif')
    const req = new NextRequest('http://localhost:3000/api/images/upload', { 
      method: 'POST', 
      body: fd 
    })
    const res = await POST(req)
    
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it.skip('大きすぎるファイルは400', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ 
      data: { user: { id: 'user-123' } }, 
      error: null 
    })
    
    const fd = makeFormDataWithFile('image/jpeg', 11 * 1024 * 1024)
    const req = new NextRequest('http://localhost:3000/api/images/upload', { 
      method: 'POST', 
      body: fd 
    })
    const res = await POST(req)
    
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it.skip('アップロード失敗で500', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ 
      data: { user: { id: 'user-123' } }, 
      error: null 
    })
    mockStorageBucket.upload.mockResolvedValue({ 
      error: new Error('upload failed') 
    })
    
    const fd = makeFormDataWithFile('image/png', 1000)
    const req = new NextRequest('http://localhost:3000/api/images/upload', { 
      method: 'POST', 
      body: fd 
    })
    const res = await POST(req)
    
    expect(res.status).toBe(500)
  })

  it.skip('署名URL作成失敗で500', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ 
      data: { user: { id: 'user-123' } }, 
      error: null 
    })
    mockStorageBucket.upload.mockResolvedValue({ error: null })
    mockStorageBucket.createSignedUrl.mockResolvedValue({ 
      data: null, 
      error: new Error('sign failed') 
    })
    
    const fd = makeFormDataWithFile('image/webp', 1000)
    const req = new NextRequest('http://localhost:3000/api/images/upload', { 
      method: 'POST', 
      body: fd 
    })
    const res = await POST(req)
    
    expect(res.status).toBe(500)
  })

  it.skip('正常系', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ 
      data: { user: { id: 'user-123' } }, 
      error: null 
    })
    mockStorageBucket.upload.mockResolvedValue({ error: null })
    mockStorageBucket.createSignedUrl.mockResolvedValue({ 
      data: { signedUrl: 'http://signed-url' }, 
      error: null 
    })
    
    const fd = makeFormDataWithFile('image/jpeg', 1000)
    const req = new NextRequest('http://localhost:3000/api/images/upload', { 
      method: 'POST', 
      body: fd 
    })
    const res = await POST(req)
    
    expect(res.status).toBe(200)
    
    const body = await res.json()
    expect(body).toHaveProperty('signedUrl', 'http://signed-url')
    expect(body).not.toHaveProperty('url')
  })
})