import { describe, it, expect, vi } from 'vitest'

// 単純なモック関数を定義
vi.mock('@/lib/ai-client/factory', () => ({
  createAIProvider: vi.fn(),
  aiClient: {
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }
}))

vi.mock('@/lib/ai-client/config', () => ({
  aiProvider: 'openai',
  getApiKey: 'test-api-key',
  getChatModel: 'gpt-4o',
  getEmbeddingModel: 'text-embedding-3-small',
  getEmbeddingProvider: vi.fn(() => 'openai'),
  USE_MOCK: false
}))

vi.mock('@/lib/ai-client/openai-client', () => ({
  createOpenAIEmbedding: vi.fn()
}))

vi.mock('@/lib/ai-client/lmstudio-client', () => ({
  createLMStudioEmbedding: vi.fn()
}))

describe('AI Client Main Functions', () => {
  it('モジュールがインポートできること', async () => {
    const { 
      createChatCompletion, 
      createChatCompletionForCheck, 
      createEmbedding, 
      getEmbeddingDimension, 
      extractTextFromImageWithLLM 
    } = await import('@/lib/ai-client/main')
    
    expect(createChatCompletion).toBeDefined()
    expect(createChatCompletionForCheck).toBeDefined()
    expect(createEmbedding).toBeDefined()
    expect(getEmbeddingDimension).toBeDefined()
    expect(extractTextFromImageWithLLM).toBeDefined()
  })

  describe('getEmbeddingDimension', () => {
    it('text-embedding-3-smallで1536を返すこと', async () => {
      const { getEmbeddingDimension } = await import('@/lib/ai-client/main')
      const dimension = getEmbeddingDimension('text-embedding-3-small')
      expect(dimension).toBe(1536)
    })

    it('text-embedding-3-largeで3072を返すこと', async () => {
      const { getEmbeddingDimension } = await import('@/lib/ai-client/main')
      const dimension = getEmbeddingDimension('text-embedding-3-large')
      expect(dimension).toBe(3072)
    })

    it('nomic-embedで768を返すこと', async () => {
      const { getEmbeddingDimension } = await import('@/lib/ai-client/main')
      const dimension = getEmbeddingDimension('nomic-embed-text')
      expect(dimension).toBe(768)
    })

    it('不明なモデルでデフォルト1536を返すこと', async () => {
      const { getEmbeddingDimension } = await import('@/lib/ai-client/main')
      const dimension = getEmbeddingDimension('unknown-model')
      expect(dimension).toBe(1536)
    })
  })

  describe('チャット完了機能', () => {
    it('createChatCompletionが関数として定義されていること', async () => {
      const { createChatCompletion } = await import('@/lib/ai-client/main')
      expect(typeof createChatCompletion).toBe('function')
    })

    it('createChatCompletionForCheckが関数として定義されていること', async () => {
      const { createChatCompletionForCheck } = await import('@/lib/ai-client/main')
      expect(typeof createChatCompletionForCheck).toBe('function')
    })

    it('extractTextFromImageWithLLMが関数として定義されていること', async () => {
      const { extractTextFromImageWithLLM } = await import('@/lib/ai-client/main')
      expect(typeof extractTextFromImageWithLLM).toBe('function')
    })
  })

  describe('埋め込み機能', () => {
    it('createEmbeddingが関数として定義されていること', async () => {
      const { createEmbedding } = await import('@/lib/ai-client/main')
      expect(typeof createEmbedding).toBe('function')
    })

    it('OpenAI埋め込みをモックで呼び出せること', async () => {
      const { createOpenAIEmbedding } = await import('@/lib/ai-client/openai-client')
      const { createEmbedding } = await import('@/lib/ai-client/main')
      
      const mockEmbedding = {
        data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
        usage: { prompt_tokens: 10, total_tokens: 10 }
      }
      
      vi.mocked(createOpenAIEmbedding).mockResolvedValueOnce(mockEmbedding)

      const result = await createEmbedding('テストテキスト')

      expect(createOpenAIEmbedding).toHaveBeenCalledWith('テストテキスト', 'text-embedding-3-small')
      expect(result).toEqual(mockEmbedding)
    })
  })
})