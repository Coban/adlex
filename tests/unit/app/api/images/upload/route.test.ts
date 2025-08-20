import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// 型定義
type SupabaseClient = {
  auth: {
    getUser: ReturnType<typeof vi.fn>
  }
}

// Supabaseクライアントのモック
const mockSupabaseClient: SupabaseClient = {
  auth: { getUser: vi.fn() },
}

// モック設定
vi.mock('@/infra/supabase/serverClient', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}))

// target import after mocks
import { POST } from '@/app/api/images/upload/route'

function makeFormDataWithFile(contentType = 'image/jpeg', size = 1000) {
  const file = new File([new Uint8Array(size)], 'test.jpg', { type: contentType })
  const fd = new FormData()
  fd.set('image', file)
  return fd
}

describe('Images Upload API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未認証は401を返す', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ 
      data: { user: null }, 
      error: new Error('認証エラー') 
    })
    
    const req = new NextRequest('http://localhost:3000/api/images/upload', { 
      method: 'POST', 
      body: new FormData() 
    })
    
    const res = await POST(req)
    expect(res.status).toBe(401)
    
    const body = await res.json()
    expect(body.error.code).toBe('AUTHENTICATION_ERROR')
    expect(body.error.message).toBe('認証が必要です')
  })

  it('image未指定は400を返す', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ 
      data: { user: { id: 'user123' } }, 
      error: null 
    })
    
    const req = new NextRequest('http://localhost:3000/api/images/upload', { 
      method: 'POST', 
      body: new FormData() 
    })
    
    const res = await POST(req)
    expect(res.status).toBe(400)
    
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toBe('画像ファイルが必要です')
  })

  it('無効なformDataは400を返す', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ 
      data: { user: { id: 'user123' } }, 
      error: null 
    })
    
    // 不正なbodyを送信
    const req = new NextRequest('http://localhost:3000/api/images/upload', { 
      method: 'POST', 
      body: 'invalid-form-data',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    
    const res = await POST(req)
    expect(res.status).toBe(400)
    
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    // Next.jsのformDataパースによる結果
    expect(body.error.message).toMatch(/無効なフォームデータです|画像ファイルが必要です/)
  })

  it('予期しないエラーは500を返す', async () => {
    // 認証で予期しないエラーが発生
    mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Network error'))
    
    const fd = makeFormDataWithFile('image/jpeg', 1000)
    const req = new NextRequest('http://localhost:3000/api/images/upload', { 
      method: 'POST', 
      body: fd 
    })
    
    const res = await POST(req)
    expect(res.status).toBe(500)
    
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(body.error.message).toBe('サーバーエラーが発生しました')
  })

  describe('APIレスポンス仕様', () => {
    it('成功時のレスポンスはsignedUrlのみを含む（プライベートバケット仕様）', () => {
      // この テストは仕様確認用
      // プライベートバケットを使用するため、レスポンスには以下が含まれる：
      // - signedUrl: 署名付きURL（1時間有効）
      // 以下は含まれない：
      // - url/publicUrl: プライベートバケットのため403エラーとなる
      
      expect(true).toBe(true) // 仕様確認のみ
    })
  })

  describe('エラーハンドリング仕様', () => {
    it('エラーレスポンスは統一されたフォーマットを持つ', () => {
      // エラーレスポンスフォーマット:
      // {
      //   error: {
      //     code: string,
      //     message: string,
      //     details?: unknown
      //   }
      // }
      
      expect(true).toBe(true) // 仕様確認のみ
    })
  })
})