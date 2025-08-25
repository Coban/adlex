/**
 * OCR メタデータ記録機能のテスト
 */

import { describe, it, expect, beforeEach } from 'vitest'

import {
  startOcrMetadataRecording,
  updateOcrMetadata,
  finishOcrMetadataRecording,
  getOcrMetadata,
  cleanupOcrMetadata,
  getOcrMetadataStats
} from '@/lib/ocr/metadata'

describe('OCR Metadata', () => {
  const sessionId = 'test-session-123'

  beforeEach(() => {
    // テスト前にキャッシュをクリア
    cleanupOcrMetadata()
  })

  describe('startOcrMetadataRecording', () => {
    it('should initialize metadata recording', () => {
      startOcrMetadataRecording(sessionId, 'openai', 'gpt-4o', 1024, 100)
      
      const metadata = getOcrMetadata(sessionId)
      expect(metadata).toBeDefined()
      expect(metadata!.provider).toBe('openai')
      expect(metadata!.model).toBe('gpt-4o')
      expect(metadata!.imageInfo.originalSizeBytes).toBe(1024)
      expect(metadata!.debug.promptLength).toBe(100)
      expect(metadata!.debug.retryCount).toBe(0)
      expect(metadata!.startTime).toBeGreaterThan(0)
    })
  })

  describe('updateOcrMetadata', () => {
    beforeEach(() => {
      startOcrMetadataRecording(sessionId, 'openai', 'gpt-4o', 1024, 100)
    })

    it('should update metadata with new values', () => {
      updateOcrMetadata(sessionId, {
        confidenceScore: 0.85,
        imageInfo: {
          originalSizeBytes: 1024,
          processedSizeBytes: 512,
          width: 800,
          height: 600
        }
      })

      const metadata = getOcrMetadata(sessionId)
      expect(metadata!.confidenceScore).toBe(0.85)
      expect(metadata!.imageInfo.processedSizeBytes).toBe(512)
      expect(metadata!.imageInfo.width).toBe(800)
      expect(metadata!.imageInfo.height).toBe(600)
      // 元の値は保持される
      expect(metadata!.imageInfo.originalSizeBytes).toBe(1024)
    })

    it('should handle non-existent session gracefully', () => {
      // 存在しないセッションIDでも例外を投げない
      expect(() => {
        updateOcrMetadata('non-existent', { confidenceScore: 0.5 })
      }).not.toThrow()
    })
  })

  describe('finishOcrMetadataRecording', () => {
    beforeEach(() => {
      startOcrMetadataRecording(sessionId, 'openai', 'gpt-4o', 1024, 100)
    })

    it('should complete metadata recording successfully', () => {
      const extractedText = 'テスト用のテキストです。'
      const confidenceScore = 0.85

      const result = finishOcrMetadataRecording(sessionId, extractedText, confidenceScore)

      expect(result).toBeDefined()
      expect(result!.endTime).toBeGreaterThan(result!.startTime)
      expect(result!.processingTimeMs).toBeGreaterThan(0)
      expect(result!.confidenceScore).toBe(confidenceScore)
      expect(result!.extractedTextLength).toBe(extractedText.length)
      expect(result!.error).toBeUndefined()
    })

    it('should record error information when error occurs', () => {
      const error = new Error('Test error')
      const extractedText = ''

      const result = finishOcrMetadataRecording(sessionId, extractedText, undefined, error)

      expect(result).toBeDefined()
      expect(result!.error).toBeDefined()
      expect(result!.error!.type).toBe('Error')
      expect(result!.error!.message).toBe('Test error')
      expect(result!.error!.stack).toBeDefined()
    })

    it('should handle non-existent session gracefully', () => {
      const result = finishOcrMetadataRecording('non-existent', 'text', 0.5)
      expect(result).toBeUndefined()
    })
  })

  describe('getOcrMetadataStats', () => {
    it('should return empty stats when no data', () => {
      const stats = getOcrMetadataStats()
      
      expect(stats.totalSessions).toBe(0)
      expect(stats.avgProcessingTime).toBe(0)
      expect(stats.avgConfidenceScore).toBe(0)
      expect(stats.providerDistribution).toEqual({})
      expect(stats.errorRate).toBe(0)
    })

    it('should calculate correct statistics', () => {
      // 複数のセッションを作成
      const sessions = [
        { id: 'session1', provider: 'openai', confidence: 0.8, hasError: false },
        { id: 'session2', provider: 'openrouter', confidence: 0.9, hasError: false },
        { id: 'session3', provider: 'openai', confidence: 0.7, hasError: true }
      ]

      sessions.forEach(session => {
        startOcrMetadataRecording(session.id, session.provider as any, 'model', 1024, 100)
        
        // 少し時間を進める
        setTimeout(() => {
          const error = session.hasError ? new Error('Test error') : undefined
          finishOcrMetadataRecording(session.id, 'test text', session.confidence, error)
        }, 10)
      })

      // 非同期処理の完了を待つ
      setTimeout(() => {
        const stats = getOcrMetadataStats()
        
        expect(stats.totalSessions).toBe(3)
        expect(stats.avgConfidenceScore).toBeCloseTo((0.8 + 0.9 + 0.7) / 3)
        expect(stats.providerDistribution.openai).toBe(2)
        expect(stats.providerDistribution.openrouter).toBe(1)
        expect(stats.errorRate).toBeCloseTo(1/3)
      }, 50)
    })
  })

  describe('cleanupOcrMetadata', () => {
    it('should remove expired metadata', async () => {
      startOcrMetadataRecording(sessionId, 'openai', 'gpt-4o', 1024, 100)
      
      // メタデータが存在することを確認
      expect(getOcrMetadata(sessionId)).toBeDefined()
      
      // 時間を大幅に進める（TTLを超える）
      const metadata = getOcrMetadata(sessionId)!
      metadata.startTime = Date.now() - (31 * 60 * 1000) // 31分前

      const cleanedCount = cleanupOcrMetadata()
      
      expect(cleanedCount).toBe(1)
      expect(getOcrMetadata(sessionId)).toBeUndefined()
    })
  })
})