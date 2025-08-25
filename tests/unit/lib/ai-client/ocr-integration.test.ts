/**
 * AI Client OCR統合テスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// モック設定
vi.mock('@/lib/ai-client/config', () => ({
  aiProvider: 'openai',
  getChatModel: 'gpt-4o',
  isUsingMock: vi.fn(() => false)
}))

vi.mock('@/lib/ai-client/factory', () => ({
  aiClient: {
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }
}))

vi.mock('@/lib/errors', () => ({
  ErrorFactory: {
    createExternalServiceError: vi.fn((provider, operation, message) => 
      new Error(`${provider} ${operation}: ${message}`)),
    createAIServiceError: vi.fn((provider, operation, message) => 
      new Error(`${provider} ${operation}: ${message}`))
  }
}))

import { aiClient } from '@/lib/ai-client/factory'
import { 
  extractTextFromImageWithLLM, 
  enhancedExtractTextFromImageWithLLM, 
  estimateOcrConfidence 
} from '@/lib/ai-client/main'

describe('AI Client OCR Integration', () => {
  const mockCompletion = {
    choices: [{
      message: {
        content: 'この製品は健康維持にお役立ていただけます。バランスの取れた食事と適度な運動と組み合わせることで、より良い結果が期待できます。'
      }
    }]
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(aiClient.chat.completions.create).mockResolvedValue(mockCompletion as any)
  })

  describe('extractTextFromImageWithLLM (basic version)', () => {
    it('should extract text from image buffer', async () => {
      const imageBuffer = Buffer.from([0xFF, 0xD8, ...Array(1022).fill(0)]) // JPEG header + data
      
      const result = await extractTextFromImageWithLLM(imageBuffer)
      
      expect(result).toBe('この製品は健康維持にお役立ていただけます。バランスの取れた食事と適度な運動と組み合わせることで、より良い結果が期待できます。')
      expect(aiClient!.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: 'text',
                  text: 'この画像に含まれるテキストを日本語で正確に抽出してください。'
                }),
                expect.objectContaining({
                  type: 'image_url',
                  image_url: expect.objectContaining({
                    url: expect.stringContaining('data:image/jpeg;base64,'),
                    detail: 'high'
                  })
                })
              ])
            })
          ]),
          temperature: 0.1,
          max_tokens: 1000
        })
      )
    })

    it('should use custom prompt', async () => {
      const imageBuffer = Buffer.from([0xFF, 0xD8, ...Array(1022).fill(0)])
      const customPrompt = 'カスタムプロンプトです'
      
      await extractTextFromImageWithLLM(imageBuffer, customPrompt)
      
      expect(aiClient!.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.arrayContaining([
                expect.objectContaining({
                  text: customPrompt
                })
              ])
            })
          ])
        })
      )
    })

    it('should handle AI service errors', async () => {
      const imageBuffer = Buffer.from([0xFF, 0xD8, ...Array(1022).fill(0)])
      vi.mocked(aiClient!.chat.completions.create).mockRejectedValue(new Error('API Error'))
      
      await expect(extractTextFromImageWithLLM(imageBuffer)).rejects.toThrow('openai image text extraction: API Error')
    })
  })

  describe('enhancedExtractTextFromImageWithLLM export', () => {
    it('should be properly exported', () => {
      expect(enhancedExtractTextFromImageWithLLM).toBeDefined()
      expect(typeof enhancedExtractTextFromImageWithLLM).toBe('function')
    })
  })

  describe('estimateOcrConfidence export', () => {
    it('should be properly exported', () => {
      expect(estimateOcrConfidence).toBeDefined()
      expect(typeof estimateOcrConfidence).toBe('function')
    })

    it('should estimate confidence correctly', () => {
      const highQualityText = 'この製品は健康維持にお役立ていただけます。バランスの取れた食事と適度な運動と組み合わせることで、より良い結果が期待できます。'
      
      const result = estimateOcrConfidence(highQualityText)
      
      expect(result).toBeDefined()
      expect(result.overallScore).toBeGreaterThan(0)
      expect(result.level).toBeDefined()
      expect(['very-high', 'high', 'medium', 'low', 'very-low']).toContain(result.level)
    })
  })

  describe('Integration scenarios', () => {
    it('should work with basic OCR followed by confidence estimation', async () => {
      const imageBuffer = Buffer.from([0xFF, 0xD8, ...Array(1022).fill(0)])
      
      // 基本OCRを実行
      const extractedText = await extractTextFromImageWithLLM(imageBuffer)
      expect(extractedText).toBeDefined()
      
      // 抽出されたテキストの信頼度を推定
      const confidence = estimateOcrConfidence(extractedText)
      expect(confidence.overallScore).toBeGreaterThan(0)
      expect(confidence.level).toBeDefined()
    })

    it('should handle empty or corrupted responses', async () => {
      const emptyCompletion = {
        choices: [{
          message: {
            content: ''
          }
        }]
      }
      vi.mocked(aiClient!.chat.completions.create).mockResolvedValue(emptyCompletion as any)
      
      const imageBuffer = Buffer.from([0xFF, 0xD8, ...Array(1022).fill(0)])
      const result = await extractTextFromImageWithLLM(imageBuffer)
      
      expect(result).toBe('')
    })

    it('should handle response with no choices', async () => {
      const noChoicesCompletion = { choices: [] }
      vi.mocked(aiClient!.chat.completions.create).mockResolvedValue(noChoicesCompletion as any)
      
      const imageBuffer = Buffer.from([0xFF, 0xD8, ...Array(1022).fill(0)])
      const result = await extractTextFromImageWithLLM(imageBuffer)
      
      expect(result).toBe('')
    })

    it('should sanitize markdown-like content', async () => {
      const markdownCompletion = {
        choices: [{
          message: {
            content: '```\n抽出されたテキスト：健康サプリメント\n```\n**注意事項**\n# 効果について'
          }
        }]
      }
      vi.mocked(aiClient!.chat.completions.create).mockResolvedValue(markdownCompletion as any)
      
      const imageBuffer = Buffer.from([0xFF, 0xD8, ...Array(1022).fill(0)])
      const result = await extractTextFromImageWithLLM(imageBuffer)
      
      // マークダウン記法が除去されているかチェック
      expect(result).not.toContain('```')
      expect(result).not.toContain('**')
      expect(result).not.toContain('# ')
      expect(result).toContain('抽出されたテキスト：健康サプリメント')
      expect(result).toContain('注意事項')
      expect(result).toContain('効果について')
    })
  })
})