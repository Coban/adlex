/**
 * AI Client メイン統合関数
 * 後方互換性を保ちつつ、分割されたモジュールを統合
 */

import OpenAI from 'openai'

import { ErrorFactory } from '@/lib/errors'
import { preprocessImage, ImageProcessingOptions, validateImageForProcessing } from '../ocr/image-preprocessing'
import { defaultOcrMetadataManager, type OcrMetadata } from '../ocr/metadata'

import { aiProvider as configAiProvider, getChatModel, getEmbeddingModel, getEmbeddingProvider } from './config'
import { createAIProvider, aiClient } from './factory'
import { createLMStudioEmbedding } from './lmstudio-client'
import { createOpenAIEmbedding } from './openai-client'
import { LegacyDictionaryEntry, LegacyViolationData } from './types'
import { extractCompleteJSON, generateJSONFromPlainText, sanitizePlainText } from './utils'

// Module-level constants
const aiProvider = configAiProvider
const USE_MOCK = process.env.USE_MOCK === 'true'

/**
 * OCR処理のオプション
 */
export interface OcrOptions {
  /** 画像前処理のオプション */
  preprocessing?: ImageProcessingOptions
  /** 前処理をスキップするか */
  skipPreprocessing?: boolean
  /** 最大リトライ回数 */
  maxRetries?: number
  /** タイムアウト時間（ミリ秒） */
  timeout?: number
  /** メタデータ記録を無効にするか */
  disableMetadata?: boolean
  /** デバッグ情報を記録するか */
  enableDebug?: boolean
}

/**
 * OCR処理の詳細結果
 */
export interface OcrResult {
  /** 抽出されたテキスト */
  text: string
  /** 使用されたプロバイダー */
  provider: 'openai' | 'lmstudio' | 'openrouter'
  /** 使用されたモデル */
  model: string
  /** 信頼度スコア（0.0-1.0） */
  confidence: number
  /** 処理時間（ミリ秒） */
  processingTimeMs: number
  /** 画像情報 */
  imageInfo: {
    originalSize: number
    processedSize?: number
    dimensions?: { width: number; height: number }
    wasPreprocessed: boolean
  }
  /** メタデータID（記録が有効な場合） */
  metadataId?: string
  /** パフォーマンス情報 */
  performance?: {
    tokenUsage?: { prompt: number; completion: number; total: number }
    modelLatency?: number
  }
}

/**
 * OCR信頼度を推定
 */
export function estimateOcrConfidence(text: string, options?: { 
  dimensions?: { width: number; height: number };
  wasPreprocessed: boolean;
}): number {
  if (!text || text.trim().length === 0) return 0
  
  // 基本的な信頼度計算
  const japaneseCharCount = (text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) ?? []).length
  const totalCharCount = text.length
  const japaneseRatio = totalCharCount > 0 ? japaneseCharCount / totalCharCount : 0
  
  // 日本語の割合、前処理の有無、画像サイズに基づいて信頼度を計算
  let confidence = Math.min(0.95, Math.max(0.1, japaneseRatio * 1.2))
  
  // 前処理が実行されている場合は信頼度を若干向上
  if (options?.wasPreprocessed) {
    confidence += 0.05
  }
  
  // 画像の解像度に基づく調整
  if (options?.dimensions) {
    const totalPixels = options.dimensions.width * options.dimensions.height
    if (totalPixels > 1000000) {
      confidence += 0.05 // 高解像度画像
    } else if (totalPixels < 100000) {
      confidence -= 0.1 // 低解像度画像
    }
  }
  
  return Math.min(0.95, Math.max(0.1, confidence))
}

/**
 * テキスト言語を検出
 */
function detectTextLanguage(text: string): string {
  const japaneseCharCount = (text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) ?? []).length
  const totalCharCount = text.length
  
  if (totalCharCount === 0) return 'unknown'
  
  const japaneseRatio = japaneseCharCount / totalCharCount
  if (japaneseRatio > 0.3) return 'ja'
  
  return 'mixed'
}

/**
 * OCRエラーを分類
 */
function categorizeOcrError(error: Error): NonNullable<OcrMetadata['error']>['type'] {
  const message = error.message.toLowerCase()
  
  if (message.includes('timeout')) return 'timeout'
  if (message.includes('network') || message.includes('connection')) return 'network'
  if (message.includes('api') || message.includes('key') || message.includes('unauthorized')) return 'ai_provider'
  if (message.includes('image') || message.includes('format')) return 'image_processing'
  if (message.includes('validation') || message.includes('invalid')) return 'validation'
  
  return 'unknown'
}

/**
 * AIクライアントを使用してチャット完了を作成する
 * OpenAIまたはLM Studioのクライアントを使用してLLMとの対話を行う
 */
export async function createChatCompletion(params: {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[]
  tool_choice?: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption
  temperature?: number
  max_tokens?: number
}) {
  const provider = createAIProvider()
  
  if (USE_MOCK || aiProvider === 'mock') {
    // モックレスポンスを返す
    if (params.tools && params.tools.length > 0) {
      return {
        id: 'mock-chat-completion',
        object: 'chat.completion' as const,
        created: Date.now(),
        model: 'mock-model',
        choices: [{
          index: 0,
          message: {
            role: 'assistant' as const,
            content: null,
            tool_calls: [{
              id: 'call_mock',
              type: 'function' as const,
              function: {
                name: 'apply_yakukiho_rules',
                arguments: JSON.stringify({
                  modified: provider.getModelInfo().chatModel,
                  violations: []
                })
              }
            }]
          },
          finish_reason: 'tool_calls' as const
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      }
    } else {
      // ツールなしの通常のチャット完了 - システムのレスポンス形式に合わせる
      return {
        id: 'mock-chat-completion',
        object: 'chat.completion' as const,
        created: Date.now(),
        model: 'mock-model',
        choices: [{
          index: 0,
          message: {
            role: 'assistant' as const,
            content: JSON.stringify({
              modified: "このサプリメントは健康維持にお役立ていただけます。血圧の健康維持をサポートします。",
              violations: [
                {
                  start: 0,
                  end: 4,
                  reason: "「がん」は医薬品的効能効果表現のため「健康状態」に修正",
                  dictionaryId: 1
                }
              ]
            }),
          },
          finish_reason: 'stop' as const
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      }
    }
  }

  if (!aiClient) {
    throw ErrorFactory.createExternalServiceError(aiProvider, 'initialize', `AI client for provider '${aiProvider}' is not available`)
  }

  try {
    const completion = await aiClient.chat.completions.create({
      model: getChatModel,
      messages: params.messages,
      temperature: params.temperature ?? 0.1,
      max_tokens: params.max_tokens ?? 4000,
      tools: params.tools,
      tool_choice: params.tool_choice
    })

    // LM Studio用の特別処理
    if (aiProvider === 'lmstudio' && params.tools && completion.choices[0]) {
      const choice = completion.choices[0]
      let content = choice.message.content ?? ''
      
      // ファンクション呼び出しが期待されているが、返されていない場合
      if (!choice.message.tool_calls && params.tools.length > 0) {
        const extractedJson = extractCompleteJSON(content)
        if (extractedJson) {
          content = extractedJson
        } else {
          content = generateJSONFromPlainText('', content)
        }
        
        // tool_callsを手動で構築
        const tool = params.tools[0] as { function?: { name?: string } }
        completion.choices[0].message.tool_calls = [{
          id: 'lm_studio_fallback',
          type: 'function',
          function: {
            name: tool.function?.name ?? 'unknown',
            arguments: content
          }
        }]
      }
    }

    return completion
  } catch (error) {
    console.error(`[AI] ${aiProvider} chat completion failed:`, error)
    throw ErrorFactory.createAIServiceError(aiProvider, 'chat completion', error instanceof Error ? error.message : 'Unknown error', error instanceof Error ? error : undefined)
  }
}

/**
 * 薬機法チェック専用のチャット完了作成
 */
export async function createChatCompletionForCheck(text: string, relevantEntries: LegacyDictionaryEntry[]): Promise<{
  type: 'openai' | 'lmstudio' | 'openrouter'
  response?: OpenAI.Chat.Completions.ChatCompletion
  violations: LegacyViolationData[]
  modified: string
}> {
  // 辞書情報の表示方法を簡潔化
  const dictionaryReference = relevantEntries.length > 0
    ? `参考: ${relevantEntries.slice(0, 3).map(e => e.phrase).join(', ')}`
    : ''

  // 長い文章用の軽量プロンプト
  const messages = [
    {
      role: 'system' as const,
      content: `薬機法専門家として違反表現を検出・修正してください。

${dictionaryReference}

修正方針:
- 違反表現は薬機法に準拠した適切な表現に置き換える
- 元の文章の意味と構造を可能な限り保持する  
- 断定的な表現は推定や可能性を示す表現に変更
- 医療的・治療的効果の主張は一般的な健康支援表現に変更
- 過度な効果を暗示する表現は控えめな表現に修正

【重要】必ずJSON形式で回答してください。JSON以外のテキストは含めないでください。

出力形式（必須）:
{
  "modified": "修正されたテキスト",
  "violations": [{"start_pos": 0, "end_pos": 3, "reason": "違反理由の詳細", "dictionary_id": null}]
}

注意：
- 応答はJSON形式のみで行う
- 説明文や追加のテキストは一切含めない
- violations配列が空の場合でも配列として出力する
- 必ず有効なJSON構造を保つ`
    },
    {
      role: 'user' as const,
      content: text
    }
  ]

  try {
    if (USE_MOCK) {
      return {
        type: 'openai',
        violations: [],
        modified: text
      }
    }

    if (!aiClient) {
      throw ErrorFactory.createExternalServiceError(aiProvider, 'initialize', `AI client for provider '${aiProvider}' is not available`)
    }

    if (aiProvider === 'openai' || aiProvider === 'openrouter') {
      // Function calling を使用
      const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [{
        type: 'function',
        function: {
          name: 'apply_yakukiho_rules',
          description: '薬機法ルールを適用してテキストを修正し、違反箇所を特定',
          parameters: {
            type: 'object',
            properties: {
              modified: { type: 'string', description: '修正されたテキスト' },
              violations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    start_pos: { type: 'number' },
                    end_pos: { type: 'number' },
                    reason: { type: 'string' },
                    dictionary_id: { type: 'number' }
                  },
                  required: ['start_pos', 'end_pos', 'reason']
                }
              }
            },
            required: ['modified', 'violations']
          }
        }
      }]

      const completion = await aiClient.chat.completions.create({
        model: getChatModel,
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.1,
        max_tokens: 4000
      })

      const toolCall = completion.choices[0]?.message?.tool_calls?.[0]
      if (toolCall && 'function' in toolCall && toolCall.function) {
        const result = JSON.parse(toolCall.function.arguments)
        return {
          type: aiProvider as 'openai' | 'openrouter',
          response: completion,
          violations: (result.violations ?? []).map((v: {
            start_pos: number;
            end_pos: number;
            reason: string;
            dictionary_id?: number;
          }) => ({
            id: Math.random(),
            start_pos: v.start_pos,
            end_pos: v.end_pos,
            reason: v.reason,
            dictionary_id: v.dictionary_id ?? null
          })),
          modified: result.modified ?? text
        }
      }
    }

    // LM Studio または Function calling 失敗時のフォールバック
    const completion = await aiClient.chat.completions.create({
      model: getChatModel,
      messages,
      temperature: 0.1,
      max_tokens: 4000
    })

    const content = completion.choices[0]?.message?.content ?? ''
    const extractedJson = extractCompleteJSON(content)
    
    if (extractedJson) {
      const result = JSON.parse(extractedJson)
      return {
        type: aiProvider as 'openai' | 'lmstudio' | 'openrouter',
        response: completion,
        violations: (result.violations ?? []).map((v: {
          start_pos: number;
          end_pos: number;
          reason: string;
          dictionary_id?: number;
        }) => ({
          id: Math.random(),
          start_pos: v.start_pos,
          end_pos: v.end_pos,
          reason: v.reason,
          dictionary_id: v.dictionary_id ?? null
        })),
        modified: result.modified ?? text
      }
    } else {
      // JSON抽出失敗時は生成フォールバック
      const fallbackJson = generateJSONFromPlainText(text, content)
      const result = JSON.parse(fallbackJson)
      return {
        type: aiProvider as 'openai' | 'lmstudio' | 'openrouter',
        response: completion,
        violations: (result.violations ?? []).map((v: {
          start_pos: number;
          end_pos: number;
          reason: string;
          dictionary_id?: number;
        }) => ({
          id: Math.random(),
          start_pos: v.start_pos,
          end_pos: v.end_pos,
          reason: v.reason,
          dictionary_id: v.dictionary_id ?? null
        })),
        modified: result.modified ?? text
      }
    }

  } catch (error) {
    console.error('[AI] Chat completion for check failed:', error)
    throw ErrorFactory.createAIServiceError(aiProvider, '薬機法チェック処理', error instanceof Error ? error.message : 'Unknown error', error instanceof Error ? error : undefined)
  }
}

/**
 * 埋め込みベクトルを作成
 */
export async function createEmbedding(input: string | string[], model?: string): Promise<{
  data: Array<{ embedding: number[]; index: number }>
  usage?: { prompt_tokens: number; total_tokens: number }
}> {
  const embeddingModel = model ?? getEmbeddingModel
  
  if (USE_MOCK) {
    const inputs = Array.isArray(input) ? input : [input]
    return {
      data: inputs.map((_, index) => ({
        embedding: Array.from({ length: 1536 }, () => Math.random() - 0.5),
        index
      })),
      usage: {
        prompt_tokens: inputs.join('').length,
        total_tokens: inputs.join('').length
      }
    }
  }

  // 埋め込みプロバイダーに基づいて処理
  const embeddingProvider = getEmbeddingProvider()
  
  try {
    switch (embeddingProvider) {
      case 'openai':
        return await createOpenAIEmbedding(input, embeddingModel)
      case 'lmstudio':
        return await createLMStudioEmbedding(input, embeddingModel)
      case 'auto':
        try {
          return await createOpenAIEmbedding(input, embeddingModel)
        } catch (error) {
          console.warn('OpenAI embedding failed, falling back to LM Studio:', error)
          return await createLMStudioEmbedding(input, embeddingModel)
        }
      default:
        throw ErrorFactory.createValidationError(`Unsupported embedding provider: ${embeddingProvider}`)
    }
  } catch (error) {
    console.error('[AI] Embedding creation failed:', error)
    throw ErrorFactory.createAIServiceError(embeddingProvider, '埋め込み作成', error instanceof Error ? error.message : 'Unknown error', error instanceof Error ? error : undefined)
  }
}

/**
 * 埋め込みベクトルの次元数を取得
 */
export function getEmbeddingDimension(model: string = getEmbeddingModel): number {
  // モデル名に基づいて次元数を決定
  if (model.includes('text-embedding-3-small')) return 1536
  if (model.includes('text-embedding-3-large')) return 3072
  if (model.includes('text-embedding-ada-002')) return 1536
  if (model.includes('nomic-embed')) return 768
  
  // デフォルト
  return 1536
}

/**
 * タイムアウト付きでOCR処理を実行する
 */
async function executeOcrWithTimeout(
  imageUrl: string, 
  timeout: number
): Promise<{ text: string; provider: 'openai' | 'lmstudio' | 'openrouter'; model: string; performance?: any }> {
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`OCR処理がタイムアウトしました (${timeout}ms)`)), timeout)
  })

  const ocrPromise = executeOcrRequest(imageUrl)
  
  return Promise.race([ocrPromise, timeoutPromise])
}

/**
 * 実際のOCRリクエストを実行する
 */
async function executeOcrRequest(
  imageUrl: string
): Promise<{ text: string; provider: 'openai' | 'lmstudio' | 'openrouter'; model: string; performance?: any }> {
  
  // マルチモーダル用のユーザーコンテンツを構築（OpenAI Vision 仕様に準拠）
  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { 
      type: 'text', 
      text: '以下の画像に写っているすべての文字列を読み取り、読み順に沿って日本語で忠実に出力してください。装飾記号は必要に応じて省略して構いません。出力は純粋なテキストのみとし、説明や前置きは不要です。' 
    },
    { type: 'image_url', image_url: { url: imageUrl } }
  ]

  const messages = [
    { role: 'system' as const, content: 'あなたはOCRエンジンです。画像内の文字を正確に読み取り、プレーンテキストとして返します。可能であれば段落・改行を保ち、ノイズを除去して出力してください。' },
    { role: 'user' as const, content: userContent }
  ]

  // OpenRouterを使用する場合
  if (aiProvider === 'openrouter') {
    try {
      const response: unknown = await createChatCompletion({
        messages,
        temperature: 0,
        max_tokens: 4000
      })

      const content = (response as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content
      if (!content || typeof content !== 'string') {
        throw new Error('OpenRouterが画像リクエストに対してテキスト内容を返しませんでした')
      }
      return {
        text: sanitizePlainText(content),
        provider: 'openrouter',
        model: getChatModel
      }
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('image') ||
        error.message.toLowerCase().includes('vision') ||
        error.message.includes('not supported') ||
        error.message.includes('unsupported')
      )) {
        throw new Error('OpenRouterの現在のモデルは画像入力（Vision）をサポートしていません。Vision対応のモデル（gpt-4oやgpt-4-turbo等）を選択してください。')
      }
      throw error
    }
  }

  // 開発環境でLM Studioが設定されている場合
  if (aiProvider === 'lmstudio') {
    try {
      const response: unknown = await createChatCompletion({
        messages,
        temperature: 0,
        max_tokens: 4000
      })

      const content = (response as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content
      if (!content || typeof content !== 'string') {
        throw new Error('LM Studioが画像リクエストに対してテキスト内容を返しませんでした')
      }
      return {
        text: sanitizePlainText(content),
        provider: 'lmstudio',
        model: getChatModel
      }
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('image') ||
        error.message.toLowerCase().includes('vision') ||
        error.message.includes('not supported') ||
        error.message.includes('unsupported')
      )) {
        throw new Error('LM Studioの現在のモデルは画像入力（Vision）をサポートしていません。Vision対応のモデル（llava、cogvlm等）を選択してください。')
      }
      throw error
    }
  }

  // OpenAI（デフォルト）
  try {
    const response: unknown = await createChatCompletion({
      messages,
      temperature: 0,
      max_tokens: 4000
    })

    const content = (response as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content
    if (!content || typeof content !== 'string') {
      throw new Error('OpenAIが画像リクエストに対してテキスト内容を返しませんでした')
    }
    return {
      text: sanitizePlainText(content),
      provider: 'openai',
      model: getChatModel
    }
  } catch (error) {
    console.error('[OCR] OpenAI OCR request failed:', error)
    throw error
  }
}

/**
 * LLMを使用して画像からテキストを抽出する（OCR処理）
 * 
 * 強化された機能:
 * - 自動画像前処理（リサイズ、形式変換）
 * - 複数プロバイダー対応（OpenAI、LM Studio、OpenRouter）
 * - 信頼度推定
 * - 包括的エラーハンドリング
 * - メタデータ記録
 * - パフォーマンス監視
 * 
 * @param imageInput 画像データ（URL、File、Blob、Buffer）
 * @param options OCR処理オプション
 * @returns OCR処理の詳細結果
 */
export async function extractTextFromImageWithLLM(
  imageInput: string | File | Blob | Buffer,
  options: OcrOptions = {}
): Promise<OcrResult> {
  const startTime = Date.now()
  let processedImageUrl = ''
  let imageInfo: OcrResult['imageInfo']
  let metadataId: string | undefined

  const {
    preprocessing = {},
    skipPreprocessing = false,
    maxRetries = 2,
    timeout = 60000,
    disableMetadata = false,
    enableDebug = process.env.NODE_ENV === 'development'
  } = options

  try {
    // モックレスポンス
    if (USE_MOCK) {
      return {
        text: '模擬的に抽出されたテキストです。このサプリメントはがんに効果があります。',
        provider: 'openai',
        model: 'mock-model',
        confidence: 0.95,
        processingTimeMs: 1000,
        imageInfo: {
          originalSize: 100000,
          processedSize: 50000,
          dimensions: { width: 1024, height: 768 },
          wasPreprocessed: true
        }
      }
    }

    // 入力画像の検証
    if (typeof imageInput === 'string' && !imageInput.startsWith('data:') && !imageInput.startsWith('http')) {
      throw new Error('無効な画像URLです。データURL、HTTP(S)URL、またはファイルオブジェクトを指定してください。')
    }

    // Buffer対応
    let inputForValidation: File | Blob | string = imageInput as string | File | Blob
    if (Buffer.isBuffer(imageInput)) {
      inputForValidation = new Blob([imageInput], { type: 'image/jpeg' })
    }

    if (typeof inputForValidation !== 'string') {
      const validation = validateImageForProcessing(inputForValidation)
      
      if (validation && !validation.isValid) {
        throw new Error(`画像検証エラー: ${validation.reason}`)
      }
      
      if (!validation) {
        console.warn('[OCR] 画像検証関数が無効な結果を返しました')
        
        if (process.env.NODE_ENV === 'production') {
          throw new Error('画像検証エラー: 検証関数の実行に失敗しました')
        }
      }
    }

    // 画像前処理の実行
    let preprocessingResult = null
    if (!skipPreprocessing && typeof imageInput !== 'string') {
      try {
        console.log('[OCR] 画像前処理を開始...')
        
        let imageForPreprocessing: File | Blob | string
        if (Buffer.isBuffer(imageInput)) {
          imageForPreprocessing = new Blob([imageInput], { type: 'image/jpeg' })
        } else {
          imageForPreprocessing = imageInput
        }
        
        preprocessingResult = await preprocessImage(imageForPreprocessing, {
          maxWidth: 2048,
          maxHeight: 2048,
          quality: 85,
          format: 'jpeg',
          asDataUrl: true,
          ...preprocessing
        })
        processedImageUrl = preprocessingResult.data as string
        
        imageInfo = {
          originalSize: preprocessingResult.originalSize,
          processedSize: preprocessingResult.processedSize,
          dimensions: preprocessingResult.processedDimensions,
          wasPreprocessed: true
        }
        
        console.log(`[OCR] 画像前処理完了: ${preprocessingResult.originalSize}B → ${preprocessingResult.processedSize}B (${Math.round(preprocessingResult.compressionRatio * 100)}%)`)
      } catch (preprocessError) {
        console.warn('[OCR] 画像前処理に失敗、元の画像を使用:', preprocessError)
        // 前処理に失敗した場合は元の画像を使用
        if (Buffer.isBuffer(imageInput)) {
          processedImageUrl = `data:image/jpeg;base64,${imageInput.toString('base64')}`
          imageInfo = {
            originalSize: imageInput.length,
            wasPreprocessed: false
          }
        } else if (typeof imageInput === 'string') {
          processedImageUrl = imageInput
          imageInfo = {
            originalSize: 0,
            wasPreprocessed: false
          }
        } else {
          processedImageUrl = URL.createObjectURL(imageInput)
          imageInfo = {
            originalSize: imageInput.size,
            wasPreprocessed: false
          }
        }
      }
    } else {
      // 前処理をスキップ
      if (Buffer.isBuffer(imageInput)) {
        processedImageUrl = `data:image/jpeg;base64,${imageInput.toString('base64')}`
        imageInfo = {
          originalSize: imageInput.length,
          wasPreprocessed: false
        }
      } else if (typeof imageInput === 'string') {
        processedImageUrl = imageInput
        imageInfo = {
          originalSize: 0,
          wasPreprocessed: false
        }
      } else {
        processedImageUrl = URL.createObjectURL(imageInput)
        imageInfo = {
          originalSize: imageInput.size,
          wasPreprocessed: false
        }
      }
    }

    // メタデータ記録開始
    if (!disableMetadata) {
      function isValidProvider(provider: string): provider is 'openai' | 'lmstudio' | 'openrouter' {
        return ['openai', 'lmstudio', 'openrouter'].includes(provider)
      }
      
      const validProvider = isValidProvider(aiProvider) ? aiProvider : 'openai'
      
      metadataId = defaultOcrMetadataManager.startProcessing(validProvider, getChatModel, {
        originalSize: imageInfo.originalSize,
        processedSize: imageInfo.processedSize,
        dimensions: imageInfo.dimensions || { width: 0, height: 0 },
        format: Buffer.isBuffer(imageInput) ? 'image/jpeg' : typeof imageInput !== 'string' ? imageInput.type : 'unknown',
        wasPreprocessed: imageInfo.wasPreprocessed
      })
    }

    // OCR処理の実行（リトライ付き）
    let lastError: Error | null = null
    let result: OcrResult | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[OCR] 試行 ${attempt}/${maxRetries}: ${aiProvider} (${getChatModel})`)
        
        const ocrResult = await executeOcrWithTimeout(processedImageUrl, timeout)
        const processingTimeMs = Date.now() - startTime
        
        // 信頼度の計算
        const confidence = estimateOcrConfidence(ocrResult.text, {
          dimensions: imageInfo.dimensions,
          wasPreprocessed: imageInfo.wasPreprocessed
        })
        
        result = {
          text: ocrResult.text,
          provider: ocrResult.provider,
          model: ocrResult.model,
          confidence,
          processingTimeMs,
          imageInfo,
          metadataId,
          performance: ocrResult.performance
        }

        // 成功をメタデータに記録
        if (!disableMetadata && metadataId) {
          await defaultOcrMetadataManager.recordSuccess(
            metadataId,
            {
              text: result.text,
              confidence: result.confidence,
              characterCount: result.text.length,
              estimatedLines: result.text.split('\n').length,
              detectedLanguage: detectTextLanguage(result.text)
            },
            result.performance,
            enableDebug ? {
              requestPayloadSize: processedImageUrl.length,
              retryCount: attempt - 1
            } : undefined
          )
        }

        console.log(`[OCR] 成功: ${result.text.length}文字抽出, 信頼度: ${confidence.toFixed(2)}`)
        break

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.warn(`[OCR] 試行 ${attempt} 失敗:`, lastError.message)
        
        if (attempt === maxRetries) {
          // 最後の試行で失敗した場合、エラーを記録
          if (!disableMetadata && metadataId) {
            await defaultOcrMetadataManager.recordError(
              metadataId,
              {
                message: lastError.message,
                type: categorizeOcrError(lastError),
                technicalDetails: enableDebug ? { attempts: attempt, aiProvider, model: getChatModel } : undefined
              } as OcrMetadata['error'],
              undefined,
              enableDebug ? {
                retryCount: attempt - 1,
                requestPayloadSize: processedImageUrl.length
              } : undefined
            )
          }
          throw lastError
        }
        
        // リトライ前の待機時間（指数バックオフ）
        if (attempt < maxRetries) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
          console.log(`[OCR] ${waitTime}ms 待機後にリトライします...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      }
    }

    if (!result) {
      throw lastError || new Error('OCR処理が完了しませんでした')
    }

    return result

  } finally {
    // リソースクリーンアップ
    if (!Buffer.isBuffer(imageInput) && typeof imageInput !== 'string' && processedImageUrl && !processedImageUrl.startsWith('data:')) {
      URL.revokeObjectURL(processedImageUrl)
    }
  }
}

/**
 * 画像からテキストを抽出（後方互換性）
 */
export async function extractTextFromImage(
  imageBuffer: Buffer, 
  _prompt = 'この画像に含まれるテキストを日本語で正確に抽出してください。'
): Promise<string> {
  if (USE_MOCK) {
    return '模擬的に抽出されたテキストです。このサプリメントはがんに効果があります。'
  }

  try {
    const result = await extractTextFromImageWithLLM(imageBuffer, {
      skipPreprocessing: false,
      maxRetries: 1,
      timeout: 30000
    })
    
    return result.text
  } catch (error) {
    console.error('[AI] Image text extraction failed:', error)
    throw ErrorFactory.createAIServiceError(aiProvider, 'image text extraction', error instanceof Error ? error.message : 'Unknown error', error instanceof Error ? error : undefined)
  }
}

// 既存関数のエクスポート（後方互換性）
export { AI_MODELS, aiProvider, isUsingMock, hasValidApiKey } from './config'