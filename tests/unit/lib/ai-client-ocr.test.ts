import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock dependencies
vi.mock('@/lib/ocr/image-preprocessing', () => ({
  preprocessImage: vi.fn(),
  validateImageForProcessing: vi.fn(() => ({ isValid: true })),
}))

vi.mock('@/lib/ocr/metadata', () => ({
  defaultOcrMetadataManager: {
    startProcessing: vi.fn(() => 'mock-metadata-id'),
    recordSuccess: vi.fn(),
    recordError: vi.fn(),
  }
}))

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn()
      }
    },
    embeddings: {
      create: vi.fn()
    }
  }))
}))

// Partially mock AI client to preserve actual implementation while overriding specific parts
vi.mock('@/lib/ai-client', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    // Keep all actual functions by default
  }
})

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

// Import after mocks
const { extractTextFromImageWithLLM, estimateOcrConfidence } = await import('@/lib/ai-client')
const { preprocessImage, validateImageForProcessing } = await import('@/lib/ocr/image-preprocessing')
const { defaultOcrMetadataManager } = await import('@/lib/ocr/metadata')

describe('AI Client OCR機能', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('AI_PROVIDER', 'openai')
    vi.stubEnv('AI_API_KEY', 'test-key')
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('extractTextFromImageWithLLM', () => {
    it('テストモードでモックレスポンスを返すこと', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      const result = await extractTextFromImageWithLLM(mockFile)
      
      expect(result).toMatchObject({
        text: expect.any(String),
        provider: expect.any(String),
        model: expect.any(String),
        confidence: expect.any(Number),
        processingTimeMs: expect.any(Number),
        imageInfo: expect.objectContaining({
          originalSize: expect.any(Number),
          wasPreprocessed: expect.any(Boolean)
        })
      })
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })

    it('画像前処理が実行されること', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const mockProcessingResult = {
        data: 'data:image/jpeg;base64,processed',
        originalSize: 1000,
        processedSize: 800,
        compressionRatio: 0.8,
        originalDimensions: { width: 1024, height: 768 },
        processedDimensions: { width: 800, height: 600 },
        options: {
          maxWidth: 2048,
          maxHeight: 2048,
          quality: 85,
          format: 'jpeg' as const,
          asDataUrl: true
        },
        processingTimeMs: 100
      }
      
      vi.mocked(preprocessImage).mockResolvedValue(mockProcessingResult)
      
      await extractTextFromImageWithLLM(mockFile)
      
      expect(preprocessImage).toHaveBeenCalledWith(mockFile, expect.objectContaining({
        maxWidth: 2048,
        maxHeight: 2048,
        quality: 85,
        format: 'jpeg'
      }))
    })

    it('前処理をスキップできること', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      await extractTextFromImageWithLLM(mockFile, { skipPreprocessing: true })
      
      expect(preprocessImage).not.toHaveBeenCalled()
    })

    it('画像検証エラーが発生すること', async () => {
      const mockFile = new File(['test'], 'test.gif', { type: 'image/gif' })
      vi.mocked(validateImageForProcessing).mockReturnValue({
        isValid: false,
        reason: 'サポートされていない形式'
      })
      
      await expect(extractTextFromImageWithLLM(mockFile)).rejects.toThrow('画像検証エラー')
    })

    it('URL形式の検証が行われること', async () => {
      await expect(extractTextFromImageWithLLM('invalid-url')).rejects.toThrow('無効な画像URL')
    })

    it('メタデータが記録されること', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      await extractTextFromImageWithLLM(mockFile)
      
      expect(defaultOcrMetadataManager.startProcessing).toHaveBeenCalled()
      expect(defaultOcrMetadataManager.recordSuccess).toHaveBeenCalled()
    })

    it('メタデータ記録を無効化できること', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      await extractTextFromImageWithLLM(mockFile, { disableMetadata: true })
      
      expect(defaultOcrMetadataManager.startProcessing).not.toHaveBeenCalled()
    })

    it('カスタムオプションが適用されること', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const customOptions = {
        maxRetries: 3,
        timeout: 30000,
        preprocessing: {
          maxWidth: 1024,
          quality: 70
        }
      }
      
      const mockProcessingResult = {
        data: 'data:image/jpeg;base64,processed',
        originalSize: 1000,
        processedSize: 700,
        compressionRatio: 0.7,
        originalDimensions: { width: 1024, height: 768 },
        processedDimensions: { width: 1024, height: 768 },
        options: expect.any(Object),
        processingTimeMs: 50
      }
      
      vi.mocked(preprocessImage).mockResolvedValue(mockProcessingResult)
      
      await extractTextFromImageWithLLM(mockFile, customOptions)
      
      expect(preprocessImage).toHaveBeenCalledWith(mockFile, expect.objectContaining({
        maxWidth: 1024,
        quality: 70
      }))
    })
  })

  describe('estimateOcrConfidence', () => {
    it('空のテキストで0を返すこと', () => {
      expect(estimateOcrConfidence('')).toBe(0)
      expect(estimateOcrConfidence('   ')).toBe(0)
    })

    it('日本語テキストの信頼度を計算できること', () => {
      const japaneseText = 'これは日本語のテストです。薬機法に準拠した表現を使用しています。'
      const confidence = estimateOcrConfidence(japaneseText)
      
      expect(confidence).toBeGreaterThan(0)
      expect(confidence).toBeLessThanOrEqual(1)
    })

    it('文字化けのあるテキストで低い信頼度を返すこと', () => {
      const corruptedText = 'これは文字化け�����が含まれるテスト'
      const confidence = estimateOcrConfidence(corruptedText)
      
      expect(confidence).toBeLessThan(0.8) // 文字化けによりペナルティ
    })

    it('適切な長さのテキストで高い信頼度を返すこと', () => {
      const goodText = 'この製品は健康維持をサポートします。バランスの取れた食生活と適度な運動と併せてご利用ください。'
      const confidence = estimateOcrConfidence(goodText)
      
      expect(confidence).toBeGreaterThan(0.7)
    })

    it('画像情報を考慮できること', () => {
      const text = 'テスト文字列です'
      const imageInfo = {
        dimensions: { width: 2048, height: 1536 },
        wasPreprocessed: true
      }
      
      const confidenceWithInfo = estimateOcrConfidence(text, imageInfo)
      const confidenceWithoutInfo = estimateOcrConfidence(text)
      
      expect(confidenceWithInfo).toBeGreaterThanOrEqual(confidenceWithoutInfo)
    })

    it('低解像度画像でペナルティが適用されること', () => {
      const text = 'テスト文字列'
      const lowResInfo = {
        dimensions: { width: 256, height: 256 },
        wasPreprocessed: false
      }
      const highResInfo = {
        dimensions: { width: 2048, height: 1536 },
        wasPreprocessed: false
      }
      
      const lowResConfidence = estimateOcrConfidence(text, lowResInfo)
      const highResConfidence = estimateOcrConfidence(text, highResInfo)
      
      expect(highResConfidence).toBeGreaterThan(lowResConfidence)
    })

    it('英数字混在テキストを適切に評価すること', () => {
      const mixedText = 'Product ABC123 は健康食品です。1日2粒を目安にお召し上がりください。'
      const confidence = estimateOcrConfidence(mixedText)
      
      expect(confidence).toBeGreaterThan(0.5)
      expect(confidence).toBeLessThanOrEqual(1)
    })

    it('不自然な繰り返しでペナルティが適用されること', () => {
      const repeatedText = 'あああああああああああああああああああああ'
      const normalText = 'これは通常のテキストです'
      
      const repeatedConfidence = estimateOcrConfidence(repeatedText)
      const normalConfidence = estimateOcrConfidence(normalText)
      
      expect(normalConfidence).toBeGreaterThan(repeatedConfidence)
    })

    it('適切な文構造で高評価されること', () => {
      const wellStructuredText = `第一章：製品概要
      
この製品は自然由来の成分を使用した健康食品です。
毎日の健康維持にお役立てください。

注意事項：
・1日の摂取目安量を守ってください
・体調に異変を感じた場合は使用を中止してください`
      
      const confidence = estimateOcrConfidence(wellStructuredText)
      expect(confidence).toBeGreaterThan(0.8)
    })
  })
})