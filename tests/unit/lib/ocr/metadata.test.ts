import { describe, it, expect, beforeEach } from 'vitest'

import { OcrMetadataManager, defaultOcrMetadataManager } from '@/lib/ocr/metadata'

describe('OCRメタデータ管理', () => {
  let manager: OcrMetadataManager

  beforeEach(() => {
    manager = new OcrMetadataManager(undefined, true) // インメモリ + デバッグモード
  })

  describe('OcrMetadataManager', () => {
    it('処理開始を記録できること', () => {
      const id = manager.startProcessing('openai', 'gpt-4o', {
        originalSize: 1024,
        dimensions: { width: 800, height: 600 },
        format: 'jpeg',
        wasPreprocessed: true
      })
      
      // 新しいUUID形式または従来の形式のいずれかを受け入れる
      expect(id).toMatch(/^ocr_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+_[a-z0-9_]+)$/)
    })

    it('成功を記録できること', async () => {
      const id = manager.startProcessing('openai', 'gpt-4o', {
        originalSize: 1024,
        dimensions: { width: 800, height: 600 },
        format: 'jpeg',
        wasPreprocessed: false
      })

      await manager.recordSuccess(id, {
        text: 'テスト文字列です。',
        confidence: 0.85,
        characterCount: 8,
        estimatedLines: 1,
        detectedLanguage: 'ja'
      }, {
        responseTime: 1200,
        tokenUsage: { prompt: 100, completion: 50, total: 150 }
      }, {
        requestPayloadSize: 2048,
        retryCount: 0
      })

      const stats = await manager.getStatistics()
      expect(stats.successCount).toBe(1)
      expect(stats.errorCount).toBe(0)
      expect(stats.averageConfidence).toBe(0.85)
    })

    it('エラーを記録できること', async () => {
      const id = manager.startProcessing('lmstudio', 'llama-vision', {
        originalSize: 2048,
        dimensions: { width: 1024, height: 768 },
        format: 'png',
        wasPreprocessed: true
      })

      await manager.recordError(id, {
        message: 'Vision機能がサポートされていません',
        type: 'ai_provider',
        code: 'VISION_NOT_SUPPORTED'
      }, {
        responseTime: 500
      }, {
        retryCount: 2
      })

      const stats = await manager.getStatistics()
      expect(stats.errorCount).toBe(1)
      expect(stats.successCount).toBe(0)
      expect(stats.errorsByType.ai_provider).toBe(1)
    })

    it('プロバイダー別統計を計算できること', async () => {
      // OpenAI成功
      const openaiId = manager.startProcessing('openai', 'gpt-4o', {
        originalSize: 1000,
        dimensions: { width: 800, height: 600 },
        format: 'jpeg',
        wasPreprocessed: false
      })
      
      // 少し待機してから記録（processingTimeMsが正しく計算されるように）
      await new Promise(resolve => setTimeout(resolve, 10))
      
      await manager.recordSuccess(openaiId, {
        text: 'OpenAIテスト',
        confidence: 0.9,
        characterCount: 7,
        estimatedLines: 1
      }, { responseTime: 800 })

      // LM Studio失敗
      const lmstudioId = manager.startProcessing('lmstudio', 'llama', {
        originalSize: 1500,
        dimensions: { width: 1024, height: 768 },
        format: 'png',
        wasPreprocessed: true
      })
      await manager.recordError(lmstudioId, {
        message: 'タイムアウト',
        type: 'timeout'
      }, { responseTime: 30000 })

      const stats = await manager.getStatistics()
      
      expect(stats.byProvider.openai.count).toBe(1)
      expect(stats.byProvider.openai.successRate).toBe(1)
      expect(stats.byProvider.openai.averageTime).toBeGreaterThan(0)
      
      expect(stats.byProvider.lmstudio.count).toBe(1)
      expect(stats.byProvider.lmstudio.successRate).toBe(0)
      expect(stats.byProvider.lmstudio.averageTime).toBe(0)
    })

    it('期間指定で統計を取得できること', async () => {
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      
      const id = manager.startProcessing('openai', 'gpt-4o', {
        originalSize: 1000,
        dimensions: { width: 800, height: 600 },
        format: 'jpeg',
        wasPreprocessed: false
      })
      await manager.recordSuccess(id, {
        text: 'テスト',
        confidence: 0.8,
        characterCount: 2,
        estimatedLines: 1
      })

      // 昨日の統計（該当なし）
      const yesterdayStats = await manager.getStatistics(yesterday, yesterday)
      expect(yesterdayStats.totalProcessed).toBe(0)

      // 今日の統計（該当あり）
      const todayStats = await manager.getStatistics(yesterday, now)
      expect(todayStats.totalProcessed).toBe(1)
    })

    it('最近の処理を取得できること', async () => {
      const ids: string[] = []
      
      // 複数の処理を記録（時間差をつけて）
      for (let i = 0; i < 3; i++) {
        const id = manager.startProcessing('openai', 'gpt-4o', {
          originalSize: 1000 + i,
          dimensions: { width: 800, height: 600 },
          format: 'jpeg',
          wasPreprocessed: false
        })
        ids.push(id)
        
        // 少し待機してからレコード
        await new Promise(resolve => setTimeout(resolve, 1))
        
        await manager.recordSuccess(id, {
          text: `テスト${i}`,
          confidence: 0.8 + i * 0.1,
          characterCount: 3,
          estimatedLines: 1
        })
      }

      const recent = await manager.getRecent(2)
      expect(recent).toHaveLength(2)
      // 最新順で返される（最後に処理されたものが最初に来る）
      expect(recent[0].result?.text).toBe('テスト2')
      expect(recent[1].result?.text).toBe('テスト1')
    })

    it('古いデータをクリーンアップできること', async () => {
      const id = manager.startProcessing('openai', 'gpt-4o', {
        originalSize: 1000,
        dimensions: { width: 800, height: 600 },
        format: 'jpeg',
        wasPreprocessed: false
      })
      await manager.recordSuccess(id, {
        text: 'テスト',
        confidence: 0.8,
        characterCount: 2,
        estimatedLines: 1
      })

      // 統計でデータが存在することを確認
      const beforeStats = await manager.getStatistics()
      expect(beforeStats.totalProcessed).toBe(1)

      // 現在時刻以降の日付でクリーンアップ（すべて削除される）
      const cleaned = await manager.cleanup(0) // 0日前 = すべて削除
      
      expect(cleaned).toBeGreaterThan(0)
      
      const afterStats = await manager.getStatistics()
      expect(afterStats.totalProcessed).toBe(0)
    })
  })

  describe('デフォルトマネージャー', () => {
    it('デフォルトマネージャーが利用可能であること', () => {
      expect(defaultOcrMetadataManager).toBeInstanceOf(OcrMetadataManager)
    })

    it('デフォルトマネージャーで処理を記録できること', () => {
      const id = defaultOcrMetadataManager.startProcessing('openai', 'gpt-4o', {
        originalSize: 1000,
        dimensions: { width: 800, height: 600 },
        format: 'jpeg',
        wasPreprocessed: false
      })

      // 新しいUUID形式または従来の形式のいずれかを受け入れる
      expect(id).toMatch(/^ocr_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+_[a-z0-9_]+)$/)
    })
  })
})