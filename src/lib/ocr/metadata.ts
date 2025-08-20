/**
 * OCRメタデータ記録システム
 * 
 * OCR処理の結果、性能、エラーなどの情報を記録・管理するシステム
 * - 処理結果の記録
 * - 性能メトリクスの追跡
 * - エラー情報の蓄積
 * - デバッグ情報の管理
 */

/**
 * OCR処理のメタデータ
 */
export interface OcrMetadata {
  /** 処理ID（一意識別子） */
  id: string
  /** 処理開始時刻 */
  startTime: Date
  /** 処理完了時刻 */
  endTime?: Date
  /** 処理時間（ミリ秒） */
  processingTimeMs?: number
  /** 使用されたAIプロバイダー */
  provider: 'openai' | 'lmstudio' | 'openrouter'
  /** 使用されたモデル */
  model: string
  /** 入力画像の情報 */
  imageInfo: {
    /** 元のファイルサイズ（バイト） */
    originalSize: number
    /** 処理後のファイルサイズ（バイト） */
    processedSize?: number
    /** 画像の寸法 */
    dimensions: { width: number; height: number }
    /** 画像形式 */
    format: string
    /** 前処理が実行されたか */
    wasPreprocessed: boolean
  }
  /** OCR結果の情報 */
  result?: {
    /** 抽出されたテキスト */
    text: string
    /** 信頼度スコア */
    confidence: number
    /** 文字数 */
    characterCount: number
    /** 行数（推定） */
    estimatedLines: number
    /** 検出された言語（推定） */
    detectedLanguage?: string
  }
  /** エラー情報 */
  error?: {
    /** エラーメッセージ */
    message: string
    /** エラーコード */
    code?: string
    /** エラータイプ */
    type: 'network' | 'ai_provider' | 'image_processing' | 'validation' | 'timeout' | 'unknown'
    /** 技術的詳細 */
    technicalDetails?: Record<string, any>
  }
  /** パフォーマンス指標 */
  performance: {
    /** レスポンス時間（ミリ秒） */
    responseTime?: number
    /** トークン使用量 */
    tokenUsage?: {
      prompt: number
      completion: number
      total: number
    }
    /** メモリ使用量（概算、バイト） */
    memoryUsage?: number
  }
  /** デバッグ情報 */
  debug?: {
    /** APIリクエストのペイロードサイズ */
    requestPayloadSize?: number
    /** APIレスポンスのサイズ */
    responseSize?: number
    /** 再試行回数 */
    retryCount?: number
    /** 使用されたプロンプト（開発時のみ） */
    prompt?: string
  }
}

/**
 * OCR統計情報
 */
export interface OcrStatistics {
  /** 処理完了数 */
  totalProcessed: number
  /** 成功数 */
  successCount: number
  /** 失敗数 */
  errorCount: number
  /** 成功率 */
  successRate: number
  /** 平均処理時間（ミリ秒） */
  averageProcessingTime: number
  /** 平均信頼度スコア */
  averageConfidence: number
  /** プロバイダー別統計 */
  byProvider: Record<string, {
    count: number
    averageTime: number
    successRate: number
  }>
  /** エラータイプ別統計 */
  errorsByType: Record<string, number>
  /** 期間 */
  period: {
    from: Date
    to: Date
  }
}

/**
 * メタデータストレージの抽象クラス
 */
abstract class MetadataStorage {
  abstract save(metadata: OcrMetadata): Promise<void>
  abstract load(id: string): Promise<OcrMetadata | null>
  abstract list(limit?: number, offset?: number): Promise<OcrMetadata[]>
  abstract getStatistics(fromDate?: Date, toDate?: Date): Promise<OcrStatistics>
  abstract cleanup(olderThan: Date): Promise<number>
}

/**
 * インメモリメタデータストレージ（開発・テスト用）
 */
class InMemoryMetadataStorage extends MetadataStorage {
  private storage = new Map<string, OcrMetadata>()

  async save(metadata: OcrMetadata): Promise<void> {
    this.storage.set(metadata.id, { ...metadata })
  }

  async load(id: string): Promise<OcrMetadata | null> {
    return this.storage.get(id) || null
  }

  async list(limit = 100, offset = 0): Promise<OcrMetadata[]> {
    const items = Array.from(this.storage.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
    
    return items.slice(offset, offset + limit)
  }

  async getStatistics(fromDate?: Date, toDate?: Date): Promise<OcrStatistics> {
    const items = Array.from(this.storage.values()).filter(item => {
      if (fromDate && item.startTime < fromDate) return false
      if (toDate && item.startTime > toDate) return false
      return true
    })

    const totalProcessed = items.length
    const successCount = items.filter(item => !item.error).length
    const errorCount = totalProcessed - successCount

    // 成功したアイテムのみで平均値を計算
    const successfulItems = items.filter(item => !item.error && item.processingTimeMs)
    const averageProcessingTime = successfulItems.length > 0 
      ? successfulItems.reduce((sum, item) => sum + (item.processingTimeMs || 0), 0) / successfulItems.length
      : 0

    const itemsWithConfidence = items.filter(item => item.result?.confidence !== undefined)
    const averageConfidence = itemsWithConfidence.length > 0
      ? itemsWithConfidence.reduce((sum, item) => sum + (item.result?.confidence || 0), 0) / itemsWithConfidence.length
      : 0

    // プロバイダー別統計
    const byProvider: Record<string, { count: number; averageTime: number; successRate: number }> = {}
    for (const item of items) {
      if (!byProvider[item.provider]) {
        byProvider[item.provider] = { count: 0, averageTime: 0, successRate: 0 }
      }
      byProvider[item.provider].count++
    }

    for (const [provider, data] of Object.entries(byProvider)) {
      const providerItems = items.filter(item => item.provider === provider)
      const providerSuccessful = providerItems.filter(item => !item.error && item.processingTimeMs)
      
      data.averageTime = providerSuccessful.length > 0
        ? providerSuccessful.reduce((sum, item) => sum + (item.processingTimeMs || 0), 0) / providerSuccessful.length
        : 0
      data.successRate = providerItems.length > 0 
        ? providerItems.filter(item => !item.error).length / providerItems.length 
        : 0
    }

    // エラータイプ別統計
    const errorsByType: Record<string, number> = {}
    for (const item of items) {
      if (item.error) {
        const errorType = item.error.type || 'unknown'
        errorsByType[errorType] = (errorsByType[errorType] || 0) + 1
      }
    }

    return {
      totalProcessed,
      successCount,
      errorCount,
      successRate: totalProcessed > 0 ? successCount / totalProcessed : 0,
      averageProcessingTime,
      averageConfidence,
      byProvider,
      errorsByType,
      period: {
        from: fromDate || new Date(Math.min(...items.map(i => i.startTime.getTime()))),
        to: toDate || new Date(Math.max(...items.map(i => i.startTime.getTime())))
      }
    }
  }

  async cleanup(olderThan: Date): Promise<number> {
    let cleaned = 0
    for (const [id, item] of this.storage.entries()) {
      if (item.startTime < olderThan) {
        this.storage.delete(id)
        cleaned++
      }
    }
    return cleaned
  }

  // 開発用：すべてのデータをクリアする
  clear(): void {
    this.storage.clear()
  }
}

/**
 * OCRメタデータマネージャー
 */
export class OcrMetadataManager {
  private storage: MetadataStorage
  private isDebugMode: boolean

  constructor(storage?: MetadataStorage, debugMode = false) {
    this.storage = storage || new InMemoryMetadataStorage()
    this.isDebugMode = debugMode || process.env.NODE_ENV === 'development'
  }

  /**
   * 新しいOCR処理を開始する
   */
  startProcessing(
    provider: 'openai' | 'lmstudio' | 'openrouter',
    model: string,
    imageInfo: OcrMetadata['imageInfo']
  ): string {
    const id = this.generateId()
    const metadata: OcrMetadata = {
      id,
      startTime: new Date(),
      provider,
      model,
      imageInfo,
      performance: {}
    }

    // 非同期で保存（エラーは無視）
    this.storage.save(metadata).catch(console.error)

    return id
  }

  /**
   * OCR処理を成功として記録する
   */
  async recordSuccess(
    id: string,
    result: OcrMetadata['result'],
    performance?: Partial<OcrMetadata['performance']>,
    debug?: Partial<OcrMetadata['debug']>
  ): Promise<void> {
    const existing = await this.storage.load(id)
    if (!existing) return

    const endTime = new Date()
    const processingTimeMs = endTime.getTime() - existing.startTime.getTime()

    const updated: OcrMetadata = {
      ...existing,
      endTime,
      processingTimeMs,
      result,
      performance: {
        ...existing.performance,
        responseTime: processingTimeMs,
        ...performance
      },
      ...(this.isDebugMode && debug ? { debug } : {})
    }

    await this.storage.save(updated)
  }

  /**
   * OCR処理をエラーとして記録する
   */
  async recordError(
    id: string,
    error: OcrMetadata['error'],
    performance?: Partial<OcrMetadata['performance']>,
    debug?: Partial<OcrMetadata['debug']>
  ): Promise<void> {
    const existing = await this.storage.load(id)
    if (!existing) return

    const endTime = new Date()
    const processingTimeMs = endTime.getTime() - existing.startTime.getTime()

    const updated: OcrMetadata = {
      ...existing,
      endTime,
      processingTimeMs,
      error,
      performance: {
        ...existing.performance,
        responseTime: processingTimeMs,
        ...performance
      },
      ...(this.isDebugMode && debug ? { debug } : {})
    }

    await this.storage.save(updated)
  }

  /**
   * 統計情報を取得する
   */
  async getStatistics(fromDate?: Date, toDate?: Date): Promise<OcrStatistics> {
    return this.storage.getStatistics(fromDate, toDate)
  }

  /**
   * 最近の処理を取得する
   */
  async getRecent(limit = 10): Promise<OcrMetadata[]> {
    return this.storage.list(limit, 0)
  }

  /**
   * 古いデータをクリーンアップする
   */
  async cleanup(daysOld = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)
    return this.storage.cleanup(cutoffDate)
  }

  private generateId(): string {
    // Node.js環境ではcrypto.randomUUID()を使用、ブラウザ環境ではフォールバック
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `ocr_${crypto.randomUUID()}`
    }
    // フォールバック: より強力な疑似乱数を生成
    return `ocr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${performance.now().toString(36)}`
  }
}

// デフォルトのメタデータマネージャーインスタンス
export const defaultOcrMetadataManager = new OcrMetadataManager()