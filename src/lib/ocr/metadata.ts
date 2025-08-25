/**
 * OCR メタデータ記録機能
 * OCR処理のパフォーマンス追跡とデバッグ情報を管理
 */

export interface OcrMetadata {
  /** 処理開始時刻 */
  startTime: number
  /** 処理完了時刻 */
  endTime?: number
  /** 処理時間（ミリ秒） */
  processingTimeMs?: number
  /** 使用されたプロバイダー */
  provider: 'openai' | 'openrouter' | 'lmstudio' | 'mock'
  /** 使用されたモデル */
  model: string
  /** 画像情報 */
  imageInfo: {
    /** 元の画像サイズ（バイト） */
    originalSizeBytes: number
    /** 処理後の画像サイズ（バイト） */
    processedSizeBytes?: number
    /** MIME タイプ */
    mimeType?: string
    /** 画像の幅 */
    width?: number
    /** 画像の高さ */
    height?: number
  }
  /** OCR信頼度スコア */
  confidenceScore?: number
  /** 抽出されたテキストの長さ */
  extractedTextLength?: number
  /** エラー情報 */
  error?: {
    type: string
    message: string
    stack?: string
  }
  /** デバッグ情報 */
  debug: {
    /** プロンプトの長さ */
    promptLength: number
    /** レスポンストークン数 */
    responseTokens?: number
    /** プロンプトトークン数 */
    promptTokens?: number
    /** リトライ回数 */
    retryCount: number
  }
}

/** メタデータストレージ（メモリ内キャッシュ） */
const metadataCache = new Map<string, OcrMetadata>()
const MAX_CACHE_SIZE = 100
const CACHE_TTL_MS = 30 * 60 * 1000 // 30分

/**
 * OCRメタデータを記録開始
 */
export function startOcrMetadataRecording(
  sessionId: string,
  provider: 'openai' | 'openrouter' | 'lmstudio' | 'mock',
  model: string,
  originalImageSize: number,
  promptLength: number
): void {
  const metadata: OcrMetadata = {
    startTime: Date.now(),
    provider,
    model,
    imageInfo: {
      originalSizeBytes: originalImageSize
    },
    debug: {
      promptLength,
      retryCount: 0
    }
  }

  // キャッシュサイズ制限
  if (metadataCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = metadataCache.keys().next().value
    if (oldestKey) {
      metadataCache.delete(oldestKey)
    }
  }

  metadataCache.set(sessionId, metadata)
}

/**
 * OCRメタデータを更新
 */
export function updateOcrMetadata(
  sessionId: string,
  updates: Partial<OcrMetadata>
): void {
  const metadata = metadataCache.get(sessionId)
  if (!metadata) {
    console.warn(`[OCR Metadata] Session ${sessionId} not found`)
    return
  }

  // 深いマージを実行
  Object.assign(metadata, {
    ...updates,
    imageInfo: { ...metadata.imageInfo, ...updates.imageInfo },
    debug: { ...metadata.debug, ...updates.debug }
  })

  metadataCache.set(sessionId, metadata)
}

/**
 * OCRメタデータ記録を完了
 */
export function finishOcrMetadataRecording(
  sessionId: string,
  extractedText: string,
  confidenceScore?: number,
  error?: Error
): OcrMetadata | undefined {
  const metadata = metadataCache.get(sessionId)
  if (!metadata) {
    console.warn(`[OCR Metadata] Session ${sessionId} not found`)
    return undefined
  }

  const endTime = Date.now()
  const finalMetadata: OcrMetadata = {
    ...metadata,
    endTime,
    processingTimeMs: endTime - metadata.startTime,
    confidenceScore,
    extractedTextLength: extractedText.length,
    error: error ? {
      type: error.constructor.name,
      message: error.message,
      stack: error.stack
    } : undefined
  }

  metadataCache.set(sessionId, finalMetadata)

  // ログ出力（本番環境では無効化可能）
  if (process.env.NODE_ENV !== 'production' ?? process.env.LOG_OCR_METADATA === 'true') {
    console.log(`[OCR Metadata] ${sessionId}:`, {
      provider: finalMetadata.provider,
      model: finalMetadata.model,
      processingTimeMs: finalMetadata.processingTimeMs,
      confidenceScore: finalMetadata.confidenceScore,
      textLength: finalMetadata.extractedTextLength,
      success: !finalMetadata.error
    })
  }

  return finalMetadata
}

/**
 * OCRメタデータを取得
 */
export function getOcrMetadata(sessionId: string): OcrMetadata | undefined {
  return metadataCache.get(sessionId)
}

/**
 * 期限切れのメタデータをクリーンアップ
 */
export function cleanupOcrMetadata(): number {
  const now = Date.now()
  let cleaned = 0

  for (const [sessionId, metadata] of metadataCache.entries()) {
    if (now - metadata.startTime > CACHE_TTL_MS) {
      metadataCache.delete(sessionId)
      cleaned++
    }
  }

  return cleaned
}

/**
 * 全てのメタデータ統計を取得
 */
export function getOcrMetadataStats(): {
  totalSessions: number
  avgProcessingTime: number
  avgConfidenceScore: number
  providerDistribution: Record<string, number>
  errorRate: number
} {
  if (metadataCache.size === 0) {
    return {
      totalSessions: 0,
      avgProcessingTime: 0,
      avgConfidenceScore: 0,
      providerDistribution: {},
      errorRate: 0
    }
  }

  const metadataList = Array.from(metadataCache.values())
  const completedSessions = metadataList.filter(m => m.endTime)
  
  const avgProcessingTime = completedSessions.reduce((sum, m) => 
    sum + (m.processingTimeMs ?? 0), 0) / Math.max(completedSessions.length, 1)
  
  const sessionsWithConfidence = completedSessions.filter(m => m.confidenceScore !== undefined)
  const avgConfidenceScore = sessionsWithConfidence.reduce((sum, m) => 
    sum + (m.confidenceScore ?? 0), 0) / Math.max(sessionsWithConfidence.length, 1)
  
  const providerDistribution = completedSessions.reduce((acc, m) => {
    acc[m.provider] = (acc[m.provider] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const errorRate = completedSessions.filter(m => m.error).length / 
                   Math.max(completedSessions.length, 1)

  return {
    totalSessions: metadataCache.size,
    avgProcessingTime,
    avgConfidenceScore,
    providerDistribution,
    errorRate
  }
}