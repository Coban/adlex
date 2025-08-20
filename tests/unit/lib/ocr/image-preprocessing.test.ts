import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  preprocessImage,
  validateImageForProcessing,
  detectImageFormat,
  getProcessingStats,
  resetProcessingStats,
  type ImageProcessingOptions
} from '@/lib/ocr/image-preprocessing'

// Canvas と Image のモック
global.HTMLCanvasElement = class {
  width = 0
  height = 0
  getContext() {
    return {
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      drawImage: vi.fn(),
      toDataURL: vi.fn(() => 'data:image/jpeg;base64,mockedbase64data'),
    }
  }
  toBlob = vi.fn((callback) => callback(new Blob(['mock'], { type: 'image/jpeg' })))
} as any

global.HTMLImageElement = class {
  naturalWidth = 1024
  naturalHeight = 768
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  
  set src(_: string) {
    setTimeout(() => this.onload?.(), 0)
  }
} as any

global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

describe('画像前処理', () => {
  beforeEach(() => {
    resetProcessingStats()
    vi.clearAllMocks()
  })

  describe('preprocessImage', () => {
    it('Base64画像を正常に処理できること', async () => {
      const base64Image = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/'
      
      const result = await preprocessImage(base64Image)
      
      expect(result.data).toBe('data:image/jpeg;base64,mockedbase64data')
      expect(result.originalSize).toBeGreaterThan(0)
      expect(result.processedSize).toBeGreaterThan(0)
      expect(result.compressionRatio).toBeGreaterThanOrEqual(0)
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0)
      expect(result.options.asDataUrl).toBe(true)
    })

    it('ファイルオブジェクトを正常に処理できること', async () => {
      const mockFile = new File(['mock image data'], 'test.jpg', { type: 'image/jpeg' })
      
      const result = await preprocessImage(mockFile)
      
      expect(result.originalSize).toBe(mockFile.size)
      expect(result.originalDimensions).toEqual({ width: 1024, height: 768 })
      expect(result.processedDimensions.width).toBeLessThanOrEqual(2048)
      expect(result.processedDimensions.height).toBeLessThanOrEqual(2048)
    })

    it('カスタムオプションが適用されること', async () => {
      const mockFile = new File(['mock'], 'test.png', { type: 'image/png' })
      const options: ImageProcessingOptions = {
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 70,
        format: 'jpeg',
        asDataUrl: false
      }
      
      const result = await preprocessImage(mockFile, options)
      
      expect(result.options).toEqual({
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 70,
        format: 'jpeg',
        asDataUrl: false
      })
      expect(result.data).toBeInstanceOf(Blob)
    })

    it('大きな画像がリサイズされること', async () => {
      // 大きな画像をシミュレート
      global.HTMLImageElement = class {
        naturalWidth = 4096
        naturalHeight = 3072
        onload: (() => void) | null = null
        set src(_: string) {
          setTimeout(() => this.onload?.(), 0)
        }
      } as any

      const mockFile = new File(['large image'], 'large.jpg', { type: 'image/jpeg' })
      
      const result = await preprocessImage(mockFile, { maxWidth: 2048, maxHeight: 2048 })
      
      expect(result.originalDimensions).toEqual({ width: 4096, height: 3072 })
      expect(result.processedDimensions.width).toBeLessThanOrEqual(2048)
      expect(result.processedDimensions.height).toBeLessThanOrEqual(2048)
    })
  })

  describe('validateImageForProcessing', () => {
    it('有効な画像ファイルを承認すること', () => {
      const validFile = new File(['data'], 'test.jpg', { type: 'image/jpeg' })
      
      const result = validateImageForProcessing(validFile)
      
      expect(result.isValid).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('サポートされていない形式を拒否すること', () => {
      const invalidFile = new File(['data'], 'test.gif', { type: 'image/gif' })
      
      const result = validateImageForProcessing(invalidFile)
      
      expect(result.isValid).toBe(false)
      expect(result.reason).toContain('サポートされていない画像形式')
    })

    it('大きすぎるファイルを拒否すること', () => {
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })
      
      const result = validateImageForProcessing(largeFile, 10 * 1024 * 1024)
      
      expect(result.isValid).toBe(false)
      expect(result.reason).toContain('ファイルサイズが大きすぎます')
    })

    it('Base64画像を正しく検証すること', () => {
      const validBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/'
      
      const result = validateImageForProcessing(validBase64)
      
      expect(result.isValid).toBe(true)
    })
  })

  describe('detectImageFormat', () => {
    it('Base64からフォーマットを検出できること', () => {
      expect(detectImageFormat('data:image/jpeg;base64,data')).toBe('jpeg')
      expect(detectImageFormat('data:image/png;base64,data')).toBe('png')
      expect(detectImageFormat('data:image/webp;base64,data')).toBe('webp')
    })

    it('Blobからフォーマットを検出できること', () => {
      const jpegBlob = new Blob(['data'], { type: 'image/jpeg' })
      const pngBlob = new Blob(['data'], { type: 'image/png' })
      
      expect(detectImageFormat(jpegBlob)).toBe('jpeg')
      expect(detectImageFormat(pngBlob)).toBe('png')
    })

    it('不明なフォーマットでnullを返すこと', () => {
      expect(detectImageFormat('invalid-data')).toBeNull()
    })
  })

  describe('処理統計', () => {
    it('統計が正しく更新されること', async () => {
      const mockFile = new File(['data'], 'test.jpg', { type: 'image/jpeg' })
      
      await preprocessImage(mockFile)
      
      const stats = getProcessingStats()
      expect(stats.processedCount).toBe(1)
      expect(stats.averageProcessingTime).toBeGreaterThan(0)
      expect(stats.averageCompressionRatio).toBeGreaterThanOrEqual(0)
    })

    it('統計がリセットされること', async () => {
      const mockFile = new File(['data'], 'test.jpg', { type: 'image/jpeg' })
      await preprocessImage(mockFile)
      
      resetProcessingStats()
      
      const stats = getProcessingStats()
      expect(stats.processedCount).toBe(0)
      expect(stats.averageProcessingTime).toBe(0)
      expect(stats.totalSizeSaved).toBe(0)
    })
  })
})