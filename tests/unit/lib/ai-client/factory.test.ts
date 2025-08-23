import { describe, it, expect, vi } from 'vitest'

// 単純なモック関数を定義
vi.mock('@/lib/ai-client/openai-client', () => ({
  OpenAIProvider: vi.fn(),
  openaiClient: {}
}))

vi.mock('@/lib/ai-client/openrouter-client', () => ({
  OpenRouterProvider: vi.fn(),
  openRouterClient: {}
}))

vi.mock('@/lib/ai-client/lmstudio-client', () => ({
  LMStudioProvider: vi.fn(),
  lmStudioClient: {}
}))

vi.mock('@/lib/ai-client/mock-client', () => ({
  MockProvider: vi.fn()
}))

vi.mock('@/lib/ai-client/config', () => ({
  aiProvider: 'openai',
  getApiKey: vi.fn(() => 'test-api-key'),
  getChatModel: 'gpt-4o',
  getEmbeddingModel: 'text-embedding-3-small',
  isUsingMock: vi.fn(() => false)
}))

describe('AI Client Factory', () => {
  // シンプルなテストにフォーカス
  it('モジュールがインポートできること', async () => {
    const { createAIProvider, getDefaultProvider } = await import('@/lib/ai-client/factory')
    
    expect(createAIProvider).toBeDefined()
    expect(getDefaultProvider).toBeDefined()
    expect(typeof createAIProvider).toBe('function')
    expect(typeof getDefaultProvider).toBe('function')
  })

  it('プロバイダーオブジェクトを返すこと', async () => {
    const { createAIProvider } = await import('@/lib/ai-client/factory')
    
    // モック環境でプロバイダーを作成
    const provider = createAIProvider('openai')
    expect(provider).toBeDefined()
  })

  it('デフォルトプロバイダーを作成できること', async () => {
    const { getDefaultProvider } = await import('@/lib/ai-client/factory')
    
    const provider = getDefaultProvider()
    expect(provider).toBeDefined()
  })

  it('不正なプロバイダーでエラーをスローすること', async () => {
    const { createAIProvider } = await import('@/lib/ai-client/factory')
    
    expect(() => createAIProvider('invalid' as any)).toThrow()
  })
})