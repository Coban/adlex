/**
 * 拡張LLMベースOCR機能のテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// テスト用のモック設定
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

import { isUsingMock } from '@/lib/ai-client/config'
import { aiClient } from '@/lib/ai-client/factory'
import { enhancedExtractTextFromImageWithLLM } from '@/lib/ocr/enhanced-ocr'

describe('Enhanced OCR', () => {
  // テスト用の画像データ
  const createTestImageBuffer = (size = 1024): Buffer => {
    const buffer = Buffer.alloc(size)
    // JPEG ヘッダーを設定
    buffer[0] = 0xFF
    buffer[1] = 0xD8
    // テストデータで埋める
    for (let i = 2; i < size; i++) {
      buffer[i] = i % 256
    }
    return buffer
  }

  const mockCompletion = {
    choices: [{
      message: {
        content: 'テスト用のOCR結果です。このサプリメントは健康維持にお役立ていただけます。'
      }
    }]
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isUsingMock).mockReturnValue(false)
    vi.mocked(aiClient.chat.completions.create).mockResolvedValue(mockCompletion as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('enhancedExtractTextFromImageWithLLM', () => {
    it('should process image and return enhanced results', async () => {
      const imageBuffer = createTestImageBuffer(2048)
      
      const result = await enhancedExtractTextFromImageWithLLM(imageBuffer)
      
      expect(result).toBeDefined()
      expect(result.text).toBe('テスト用のOCR結果です。このサプリメントは健康維持にお役立ていただけます。')
      expect(result.sessionId).toBeDefined()
      expect(result.confidence).toBeDefined()
      expect(result.metadata).toBeDefined()
    })

    it('should handle mock environment', async () => {
      vi.mocked(isUsingMock).mockReturnValue(true)
      const imageBuffer = createTestImageBuffer()
      
      const result = await enhancedExtractTextFromImageWithLLM(imageBuffer)
      
      expect(result.text).toContain('モック環境')
      expect(result.sessionId).toBeDefined()
      expect(result.confidence).toBeDefined()
    })

    it('should support custom prompt', async () => {
      const imageBuffer = createTestImageBuffer()
      const customPrompt = 'カスタムプロンプトです'
      
      await enhancedExtractTextFromImageWithLLM(imageBuffer, { prompt: customPrompt })
      
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

    it('should handle different input types', async () => {
      // Buffer input
      const bufferInput = createTestImageBuffer()
      const bufferResult = await enhancedExtractTextFromImageWithLLM(bufferInput)
      expect(bufferResult.text).toBeDefined()

      // Base64 string input
      const base64Input = bufferInput.toString('base64')
      const base64Result = await enhancedExtractTextFromImageWithLLM(base64Input)
      expect(base64Result.text).toBeDefined()

      // Data URL input
      const dataUrlInput = `data:image/jpeg;base64,${base64Input}`
      const dataUrlResult = await enhancedExtractTextFromImageWithLLM(dataUrlInput)
      expect(dataUrlResult.text).toBeDefined()
    })

    it('should disable features when requested', async () => {
      const imageBuffer = createTestImageBuffer()
      
      const result = await enhancedExtractTextFromImageWithLLM(imageBuffer, {
        disableMetadata: true,
        disableConfidenceEstimation: true
      })
      
      expect(result.text).toBeDefined()
      expect(result.metadata).toBeUndefined()
      expect(result.confidence).toBeUndefined()
    })

    it('should apply image preprocessing when needed', async () => {
      const largeImageBuffer = createTestImageBuffer(6 * 1024 * 1024) // 6MB
      
      const result = await enhancedExtractTextFromImageWithLLM(largeImageBuffer)
      
      expect(result.imageProcessing).toBeDefined()
      // 大きな画像の場合は前処理が適用されるはず
    })

    it('should handle retry logic', async () => {
      // 最初は失敗、2回目は成功するようにモック
      vi.mocked(aiClient!.chat.completions.create)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockCompletion as any)

      const imageBuffer = createTestImageBuffer()
      
      const result = await enhancedExtractTextFromImageWithLLM(imageBuffer, {
        maxRetries: 2
      })
      
      expect(result.text).toBeDefined()
      expect(aiClient!.chat.completions.create).toHaveBeenCalledTimes(2)
    })

    it('should handle timeout', async () => {
      // 長時間のレスポンスをシミュレート
      vi.mocked(aiClient!.chat.completions.create).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockCompletion as any), 2000))
      )

      const imageBuffer = createTestImageBuffer()
      
      await expect(
        enhancedExtractTextFromImageWithLLM(imageBuffer, { timeoutMs: 100 })
      ).rejects.toThrow('OCR processing timed out')
    })

    it('should handle AI client unavailable', async () => {
      // aiClientを無効化
      vi.doMock('../ai-client/config', () => ({
        aiClient: null,
        aiProvider: 'openai',
        getChatModel: 'gpt-4o',
        isUsingMock: vi.fn(() => false)
      }))

      const imageBuffer = createTestImageBuffer()
      
      await expect(
        enhancedExtractTextFromImageWithLLM(imageBuffer)
      ).rejects.toThrow('AI client is not available')
    })

    it('should record metadata correctly', async () => {
      const imageBuffer = createTestImageBuffer(2048)
      
      const result = await enhancedExtractTextFromImageWithLLM(imageBuffer)
      
      expect(result.metadata).toBeDefined()
      expect(result.metadata!.provider).toBe('openai')
      expect(result.metadata!.model).toBe('gpt-4o')
      expect(result.metadata!.imageInfo.originalSizeBytes).toBe(2048)
      expect(result.metadata!.processingTimeMs).toBeGreaterThan(0)
    })

    it('should estimate confidence correctly', async () => {
      const imageBuffer = createTestImageBuffer()
      
      const result = await enhancedExtractTextFromImageWithLLM(imageBuffer)
      
      expect(result.confidence).toBeDefined()
      expect(result.confidence!.overallScore).toBeGreaterThan(0)
      expect(result.confidence!.level).toBeDefined()
      expect(['very-high', 'high', 'medium', 'low', 'very-low']).toContain(result.confidence!.level)
    })

    it('should handle invalid input gracefully', async () => {
      await expect(
        enhancedExtractTextFromImageWithLLM('invalid-base64' as any)
      ).rejects.toThrow('Invalid base64 string')
    })

    it('should sanitize output text', async () => {
      // マークダウン形式のレスポンスをシミュレート
      const markdownCompletion = {
        choices: [{
          message: {
            content: '```\n抽出されたテキスト\n```\n**太字**\n# ヘッダー\n[リンク](http://example.com)'
          }
        }]
      }
      
      vi.mocked(aiClient!.chat.completions.create).mockResolvedValue(markdownCompletion as any)
      
      const imageBuffer = createTestImageBuffer()
      const result = await enhancedExtractTextFromImageWithLLM(imageBuffer)
      
      // マークダウンが除去されているかチェック
      expect(result.text).not.toContain('```')
      expect(result.text).not.toContain('**')
      expect(result.text).not.toContain('#')
      expect(result.text).not.toContain('[')
    })
  })

  describe('Input conversion', () => {
    it('should handle File input', async () => {
      const buffer = createTestImageBuffer()
      const arrayBuffer = new ArrayBuffer(buffer.length)
      const uint8Array = new Uint8Array(arrayBuffer)
      uint8Array.set(buffer)
      const file = new File([arrayBuffer], 'test.jpg', { type: 'image/jpeg' })
      
      const result = await enhancedExtractTextFromImageWithLLM(file)
      expect(result.text).toBeDefined()
    })

    it('should handle Blob input', async () => {
      const buffer = createTestImageBuffer()
      const arrayBuffer = new ArrayBuffer(buffer.length)
      const uint8Array = new Uint8Array(arrayBuffer)
      uint8Array.set(buffer)
      const blob = new Blob([arrayBuffer], { type: 'image/jpeg' })
      
      const result = await enhancedExtractTextFromImageWithLLM(blob)
      expect(result.text).toBeDefined()
    })
  })
})