/**
 * 拡張LLMベースOCR機能
 * 画像前処理、信頼度推定、メタデータ記録を統合した高機能OCR
 */

import { randomUUID } from 'crypto'


import { aiProvider, getChatModel, isUsingMock } from '@/lib/ai-client/config'
import { aiClient } from '@/lib/ai-client/factory'
import { ErrorFactory } from '@/lib/errors'

import { ConfidenceResult, estimateOcrConfidence } from './confidence-estimation'
import { ImageProcessingOptions, ImageProcessingResult, preprocessImage } from './image-preprocessing'
import { finishOcrMetadataRecording, OcrMetadata, startOcrMetadataRecording, updateOcrMetadata } from './metadata'

export interface EnhancedOcrOptions {
  /** カスタムプロンプト */
  prompt?: string
  /** 画像前処理オプション */
  imageProcessing?: ImageProcessingOptions
  /** 最大リトライ回数 */
  maxRetries?: number
  /** タイムアウト時間（ミリ秒） */
  timeoutMs?: number
  /** メタデータ記録を無効化 */
  disableMetadata?: boolean
  /** 信頼度推定を無効化 */
  disableConfidenceEstimation?: boolean
}

export interface EnhancedOcrResult {
  /** 抽出されたテキスト */
  text: string
  /** 信頼度推定結果 */
  confidence?: ConfidenceResult
  /** OCRメタデータ */
  metadata?: OcrMetadata
  /** 画像前処理結果 */
  imageProcessing?: ImageProcessingResult
  /** セッションID */
  sessionId: string
}

// 入力タイプの定義
export type ImageInput = Buffer | File | Blob | string // string は Base64 または URL

const DEFAULT_OPTIONS: Required<Omit<EnhancedOcrOptions, 'prompt' | 'imageProcessing'>> = {
  maxRetries: 2,
  timeoutMs: 30000,
  disableMetadata: false,
  disableConfidenceEstimation: false
}

const DEFAULT_PROMPT = 'この画像に含まれるテキストを日本語で正確に抽出してください。レイアウトや改行も可能な限り保持してください。'

/**
 * 拡張LLMベースOCR実行
 */
export async function enhancedExtractTextFromImageWithLLM(
  imageInput: ImageInput,
  options: EnhancedOcrOptions = {}
): Promise<EnhancedOcrResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const sessionId = randomUUID()
  const prompt = options.prompt ?? DEFAULT_PROMPT

  try {
    // モック環境での処理
    if (isUsingMock()) {
      const mockText = 'モック環境: この画像からテキストが抽出されました。薬機法に関する内容が含まれている可能性があります。'
      
      const result: EnhancedOcrResult = {
        text: mockText,
        sessionId
      }

      if (!opts.disableConfidenceEstimation) {
        result.confidence = estimateOcrConfidence(mockText)
      }

      return result
    }

    // AI クライアントの確認
    if (!aiClient) {
      throw ErrorFactory.createExternalServiceError(
        aiProvider, 
        'image processing', 
        'AI client is not available for image processing'
      )
    }

    // 入力画像を Buffer に変換
    const imageBuffer = await convertToBuffer(imageInput)
    
    // メタデータ記録開始
    if (!opts.disableMetadata) {
      startOcrMetadataRecording(
        sessionId,
        aiProvider,
        getChatModel,
        imageBuffer.length,
        prompt.length
      )
    }

    let processingResult: ImageProcessingResult | undefined
    let finalImageBuffer = imageBuffer

    // 画像前処理
    if (options.imageProcessing || shouldApplyDefaultProcessing(imageBuffer)) {
      try {
        processingResult = await preprocessImage(imageBuffer, options.imageProcessing)
        finalImageBuffer = processingResult.processedBuffer
        
        if (!opts.disableMetadata) {
          updateOcrMetadata(sessionId, {
            imageInfo: {
              processedSizeBytes: processingResult.processedMetadata.sizeBytes,
              mimeType: processingResult.processedMetadata.format,
              width: processingResult.processedMetadata.width,
              height: processingResult.processedMetadata.height
            } as Partial<OcrMetadata['imageInfo']>
          })
        }
      } catch (processingError) {
        console.warn('[Enhanced OCR] Image preprocessing failed, using original image:', processingError)
        // 前処理に失敗しても元の画像で続行
      }
    }

    // OCR実行（リトライ機能付き）
    let extractedText: string
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      try {
        if (!opts.disableMetadata && attempt > 0) {
          updateOcrMetadata(sessionId, {
            debug: { 
              promptLength: prompt.length,
              retryCount: attempt 
            }
          })
        }

        extractedText = await performLLMOcr(finalImageBuffer, prompt, opts.timeoutMs)
        break // 成功した場合はループを抜ける
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.warn(`[Enhanced OCR] Attempt ${attempt + 1} failed:`, error)
        
        if (attempt === opts.maxRetries) {
          throw lastError
        }

        // リトライ前に少し待機
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
      }
    }

    // extractedText が定義されているかチェック
    if (extractedText! === undefined) {
      throw lastError ?? new Error('OCR processing failed after all retries')
    }

    // 信頼度推定
    let confidence: ConfidenceResult | undefined
    if (!opts.disableConfidenceEstimation) {
      const imageInfo = processingResult ? {
        width: processingResult.processedMetadata.width,
        height: processingResult.processedMetadata.height,
        sizeBytes: processingResult.processedMetadata.sizeBytes
      } : {
        sizeBytes: finalImageBuffer.length
      }
      
      confidence = estimateOcrConfidence(extractedText, imageInfo)
    }

    // メタデータ記録完了
    let metadata: OcrMetadata | undefined
    if (!opts.disableMetadata) {
      metadata = finishOcrMetadataRecording(sessionId, extractedText, confidence?.overallScore)
    }

    return {
      text: extractedText,
      confidence,
      metadata,
      imageProcessing: processingResult,
      sessionId
    }

  } catch (error) {
    // エラー時のメタデータ記録
    if (!opts.disableMetadata) {
      finishOcrMetadataRecording(
        sessionId, 
        '', 
        undefined, 
        error instanceof Error ? error : new Error(String(error))
      )
    }

    console.error('[Enhanced OCR] Processing failed:', error)
    
    if (error instanceof Error) {
      throw error
    } else {
      throw ErrorFactory.createAIServiceError(
        aiProvider,
        'enhanced OCR processing',
        String(error)
      )
    }
  }
}

/**
 * 実際のLLM OCR処理を実行
 */
async function performLLMOcr(
  imageBuffer: Buffer,
  prompt: string,
  timeoutMs: number
): Promise<string> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`OCR processing timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  const ocrPromise = (async () => {
    try {
      const base64Image = imageBuffer.toString('base64')
      const completion = await aiClient!.chat.completions.create({
        model: getChatModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      })

      const extractedText = completion.choices[0]?.message?.content ?? ''
      return sanitizePlainText(extractedText)
      
    } catch (error) {
      throw ErrorFactory.createAIServiceError(
        aiProvider,
        'LLM image text extraction',
        error instanceof Error ? error.message : 'Unknown error',
        error instanceof Error ? error : undefined
      )
    }
  })()

  return Promise.race([ocrPromise, timeoutPromise])
}

/**
 * 入力を Buffer に変換
 */
async function convertToBuffer(input: ImageInput): Promise<Buffer> {
  if (Buffer.isBuffer(input)) {
    return input
  }

  if (typeof input === 'string') {
    // Base64 データURLの場合
    if (input.startsWith('data:')) {
      const base64Data = input.split(',')[1]
      if (!base64Data) {
        throw new Error('Invalid data URL format')
      }
      return Buffer.from(base64Data, 'base64')
    }
    
    // Base64文字列の場合
    try {
      return Buffer.from(input, 'base64')
    } catch {
      throw new Error('Invalid base64 string')
    }
  }

  if (input instanceof File || input instanceof Blob) {
    const arrayBuffer = await input.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  throw new Error('Unsupported image input type')
}

/**
 * デフォルトの前処理を適用すべきかチェック
 */
function shouldApplyDefaultProcessing(imageBuffer: Buffer): boolean {
  const sizeMB = imageBuffer.length / (1024 * 1024)
  
  // 5MB以上の場合は前処理を推奨
  if (sizeMB > 5) {
    return true
  }

  // WebP フォーマットの場合は JPEG に変換
  if (imageBuffer.slice(0, 4).toString() === 'RIFF' && 
      imageBuffer.slice(8, 12).toString() === 'WEBP') {
    return true
  }

  return false
}

/**
 * プレーンテキストをサニタイズ
 */
function sanitizePlainText(text: string): string {
  return text
    .replace(/^```[\s\S]*?```$/gm, '') // コードブロックを除去
    .replace(/^\*\*(.+?)\*\*$/gm, '$1') // Bold マークアップを除去
    .replace(/^#+\s+/gm, '') // Markdown ヘッダーを除去
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Markdown リンクを除去
    .trim()
}