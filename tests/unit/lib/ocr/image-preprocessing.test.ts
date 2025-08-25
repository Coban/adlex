/**
 * 画像前処理機能のテスト
 */

import { describe, it, expect } from 'vitest'

import { preprocessImageNode } from '@/lib/ocr/image-preprocessing'

describe('Image Preprocessing', () => {
  // テスト用の画像データを作成
  const createTestImage = (format: 'png' | 'jpeg' | 'webp' | 'gif', size = 1024): Buffer => {
    const buffer = Buffer.alloc(size)
    
    switch (format) {
      case 'png':
        buffer[0] = 0x89
        buffer[1] = 0x50
        buffer[2] = 0x4E
        buffer[3] = 0x47
        break
      case 'jpeg':
        buffer[0] = 0xFF
        buffer[1] = 0xD8
        break
      case 'webp':
        Buffer.from('RIFF').copy(buffer, 0)
        Buffer.from('WEBP').copy(buffer, 8)
        break
      case 'gif':
        Buffer.from('GIF').copy(buffer, 0)
        break
    }
    
    return buffer
  }

  describe('preprocessImageNode', () => {
    it('should handle PNG images', async () => {
      const pngBuffer = createTestImage('png', 2048)
      
      const result = await preprocessImageNode(pngBuffer)
      
      expect(result).toBeDefined()
      expect(result.processedBuffer).toBeDefined()
      expect(result.originalMetadata.format).toBe('image/png')
      expect(result.originalMetadata.sizeBytes).toBe(2048)
      expect(result.processedMetadata.sizeBytes).toBe(2048)
    })

    it('should handle JPEG images', async () => {
      const jpegBuffer = createTestImage('jpeg', 1536)
      
      const result = await preprocessImageNode(jpegBuffer)
      
      expect(result.originalMetadata.format).toBe('image/jpeg')
      expect(result.originalMetadata.sizeBytes).toBe(1536)
    })

    it('should detect WebP images', async () => {
      const webpBuffer = createTestImage('webp', 3072)
      
      const result = await preprocessImageNode(webpBuffer)
      
      expect(result.originalMetadata.format).toBe('image/webp')
    })

    it('should detect GIF images', async () => {
      const gifBuffer = createTestImage('gif', 512)
      
      const result = await preprocessImageNode(gifBuffer)
      
      expect(result.originalMetadata.format).toBe('image/gif')
    })

    it('should handle unknown formats gracefully', async () => {
      const unknownBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04])
      
      const result = await preprocessImageNode(unknownBuffer)
      
      expect(result.originalMetadata.format).toBeUndefined()
      expect(result.processedMetadata.format).toBe('unknown')
    })

    it('should warn about large file sizes', async () => {
      const largeBuffer = createTestImage('jpeg', 10 * 1024 * 1024) // 10MB
      
      const result = await preprocessImageNode(largeBuffer, { maxFileSizeBytes: 5 * 1024 * 1024 })
      
      expect(result.appliedProcessing).toContain('size-warning:10485760 > 5242880')
    })

    it('should use default options when none provided', async () => {
      const buffer = createTestImage('jpeg', 1024)
      
      const result = await preprocessImageNode(buffer)
      
      expect(result).toBeDefined()
      expect(result.appliedProcessing).toContain('no-processing')
    })

    it('should handle very small buffers', async () => {
      const tinyBuffer = Buffer.from([0x01, 0x02])
      
      const result = await preprocessImageNode(tinyBuffer)
      
      expect(result.originalMetadata.format).toBeUndefined()
    })

    it('should preserve buffer content when no processing needed', async () => {
      const originalBuffer = createTestImage('jpeg', 1024)
      
      const result = await preprocessImageNode(originalBuffer)
      
      expect(result.processedBuffer.equals(originalBuffer)).toBe(true)
    })
  })

  describe('Image format detection', () => {
    it('should detect PNG correctly', async () => {
      const pngBuffer = createTestImage('png')
      const result = await preprocessImageNode(pngBuffer)
      expect(result.originalMetadata.format).toBe('image/png')
    })

    it('should detect JPEG correctly', async () => {
      const jpegBuffer = createTestImage('jpeg')
      const result = await preprocessImageNode(jpegBuffer)
      expect(result.originalMetadata.format).toBe('image/jpeg')
    })

    it('should detect WebP correctly', async () => {
      const webpBuffer = createTestImage('webp')
      const result = await preprocessImageNode(webpBuffer)
      expect(result.originalMetadata.format).toBe('image/webp')
    })

    it('should detect GIF correctly', async () => {
      const gifBuffer = createTestImage('gif')
      const result = await preprocessImageNode(gifBuffer)
      expect(result.originalMetadata.format).toBe('image/gif')
    })
  })

  describe('Processing options', () => {
    it('should respect maxFileSizeBytes option', async () => {
      const largeBuffer = createTestImage('jpeg', 6 * 1024 * 1024) // 6MB
      
      const result = await preprocessImageNode(largeBuffer, {
        maxFileSizeBytes: 3 * 1024 * 1024 // 3MB limit
      })
      
      expect(result.appliedProcessing.some(p => p.includes('size-warning'))).toBe(true)
    })

    it('should handle custom processing options', async () => {
      const buffer = createTestImage('png', 2048)
      
      const result = await preprocessImageNode(buffer, {
        maxWidth: 1024,
        maxHeight: 768,
        jpegQuality: 90,
        targetFormat: 'jpeg'
      })
      
      expect(result).toBeDefined()
      // Node.js版では実際のリサイズは行わないが、オプションは受け入れる
    })
  })

  describe('Error handling', () => {
    it('should handle empty buffers', async () => {
      const emptyBuffer = Buffer.alloc(0)
      
      const result = await preprocessImageNode(emptyBuffer)
      
      expect(result.originalMetadata.sizeBytes).toBe(0)
      expect(result.processedMetadata.sizeBytes).toBe(0)
    })
  })
})