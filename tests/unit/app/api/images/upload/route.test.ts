import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createMockRepositories } from 'tests/mocks/repositories'

// Mock the repository provider
vi.mock('@/core/ports', () => ({
  getRepositories: vi.fn(),
}))

const mockAuth = {
  getUser: vi.fn()
}

const mockStorage = {
  from: vi.fn()
}

const mockSupabaseClient = {
  auth: mockAuth,
  storage: mockStorage
}

// Mock Supabase auth
vi.mock('@/infra/supabase/serverClient', () => ({
  createClient: vi.fn(async () => mockSupabaseClient)
}))

// Mock UploadImageUseCase
vi.mock('@/core/usecases/images/uploadImage', () => ({
  UploadImageUseCase: vi.fn()
}))

import { getRepositories } from '@/core/ports'
import { UploadImageUseCase } from '@/core/usecases/images/uploadImage'

// target import after mocks
import { POST } from '@/app/api/images/upload/route'

function makeFormDataWithFile(contentType = 'image/jpeg', size = 1000) {
  const file = new File([new Uint8Array(size)], 'test.jpg', { type: contentType })
  const fd = new FormData()
  fd.set('image', file)
  return fd
}

describe('Images Upload API Route', () => {
  let mockRepositories: any
  let mockUploadImageUseCase: any
  
  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Reset mock repositories
    mockRepositories = createMockRepositories()
    vi.mocked(getRepositories).mockResolvedValue(mockRepositories)
    
    // Reset mock usecase
    mockUploadImageUseCase = {
      execute: vi.fn()
    }
    vi.mocked(UploadImageUseCase).mockImplementation(() => mockUploadImageUseCase)
  })

  it('未認証は401', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('no') })
    const req = new NextRequest('http://localhost:3000/api/images/upload', { method: 'POST', body: new FormData() })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('image未指定は400', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    const req = new NextRequest('http://localhost:3000/api/images/upload', { method: 'POST', body: new FormData() })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('ユーザーが見つからない場合は401', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockUploadImageUseCase.execute.mockResolvedValue({
      success: false,
      error: { code: 'AUTHENTICATION_ERROR', message: 'ユーザーが見つかりません' }
    })
    const fd = makeFormDataWithFile('image/jpeg', 1000)
    const req = new NextRequest('http://localhost:3000/api/images/upload', { method: 'POST', body: fd })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('組織に所属していないユーザーは401', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockUploadImageUseCase.execute.mockResolvedValue({
      success: false,
      error: { code: 'AUTHENTICATION_ERROR', message: 'ユーザーが組織に所属していません' }
    })
    const fd = makeFormDataWithFile('image/jpeg', 1000)
    const req = new NextRequest('http://localhost:3000/api/images/upload', { method: 'POST', body: fd })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('不正なcontent-typeは400', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockUploadImageUseCase.execute.mockResolvedValue({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'サポートされていないファイルタイプです（JPEG、PNG、WebPのみ）' }
    })
    const fd = makeFormDataWithFile('image/gif')
    const req = new NextRequest('http://localhost:3000/api/images/upload', { method: 'POST', body: fd })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('大きすぎるファイルは400', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockUploadImageUseCase.execute.mockResolvedValue({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'ファイルサイズが大きすぎます（最大10MBまで）' }
    })
    const fd = makeFormDataWithFile('image/jpeg', 11 * 1024 * 1024)
    const req = new NextRequest('http://localhost:3000/api/images/upload', { method: 'POST', body: fd })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('アップロード失敗で500', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockUploadImageUseCase.execute.mockResolvedValue({
      success: false,
      error: { code: 'REPOSITORY_ERROR', message: 'ファイルのアップロードに失敗しました' }
    })
    const fd = makeFormDataWithFile('image/png', 1000)
    const req = new NextRequest('http://localhost:3000/api/images/upload', { method: 'POST', body: fd })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it('署名URL作成失敗で500', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockUploadImageUseCase.execute.mockResolvedValue({
      success: false,
      error: { code: 'REPOSITORY_ERROR', message: '署名付きURLの生成に失敗しました' }
    })
    const fd = makeFormDataWithFile('image/webp', 1000)
    const req = new NextRequest('http://localhost:3000/api/images/upload', { method: 'POST', body: fd })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it('正常系：成功時は200と署名付きURLを返す', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockUploadImageUseCase.execute.mockResolvedValue({
      success: true,
      data: { signedUrl: 'http://signed-url.example.com' }
    })
    const fd = makeFormDataWithFile('image/jpeg', 1000)
    const req = new NextRequest('http://localhost:3000/api/images/upload', { method: 'POST', body: fd })
    const res = await POST(req)
    expect(res.status).toBe(200)
    
    const responseBody = await res.json()
    expect(responseBody.signedUrl).toBe('http://signed-url.example.com')
  })
})


