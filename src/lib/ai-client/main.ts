/**
 * AI Client メイン統合関数
 * 後方互換性を保ちつつ、分割されたモジュールを統合
 */

import OpenAI from 'openai'

import { ErrorFactory } from '@/lib/errors'

import { aiProvider, getApiKey, getChatModel, getEmbeddingModel, getEmbeddingProvider, AI_MODELS, USE_MOCK, getAIClientInfo } from './config'
import { createAIProvider, aiClient } from './factory'
import { createLMStudioEmbedding } from './lmstudio-client'
import { ensureOpenAIEmbeddingClient, createOpenAIEmbedding } from './openai-client'
import { LegacyDictionaryEntry, LegacyViolationData } from './types'
import { extractCompleteJSON, generateJSONFromPlainText, sanitizePlainText, estimateOcrConfidence, validateModelConfiguration } from './utils'

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
      let content = choice.message.content || ''
      
      // ファンクション呼び出しが期待されているが、返されていない場合
      if (!choice.message.tool_calls && params.tools.length > 0) {
        const extractedJson = extractCompleteJSON(content)
        if (extractedJson) {
          content = extractedJson
        } else {
          content = generateJSONFromPlainText('', content)
        }
        
        // tool_callsを手動で構築
        completion.choices[0].message.tool_calls = [{
          id: 'lm_studio_fallback',
          type: 'function',
          function: {
            name: params.tools[0].function.name,
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
      if (toolCall?.function) {
        const result = JSON.parse(toolCall.function.arguments)
        return {
          type: aiProvider as 'openai' | 'openrouter',
          response: completion,
          violations: (result.violations || []).map((v: any) => ({
            id: Math.random(),
            start_pos: v.start_pos,
            end_pos: v.end_pos,
            reason: v.reason,
            dictionary_id: v.dictionary_id || null
          })),
          modified: result.modified || text
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

    const content = completion.choices[0]?.message?.content || ''
    const extractedJson = extractCompleteJSON(content)
    
    if (extractedJson) {
      const result = JSON.parse(extractedJson)
      return {
        type: aiProvider as 'openai' | 'lmstudio' | 'openrouter',
        response: completion,
        violations: (result.violations || []).map((v: any) => ({
          id: Math.random(),
          start_pos: v.start_pos,
          end_pos: v.end_pos,
          reason: v.reason,
          dictionary_id: v.dictionary_id || null
        })),
        modified: result.modified || text
      }
    } else {
      // JSON抽出失敗時は生成フォールバック
      const fallbackJson = generateJSONFromPlainText(text, content)
      const result = JSON.parse(fallbackJson)
      return {
        type: aiProvider as 'openai' | 'lmstudio' | 'openrouter',
        response: completion,
        violations: (result.violations || []).map((v: any) => ({
          id: Math.random(),
          start_pos: v.start_pos,
          end_pos: v.end_pos,
          reason: v.reason,
          dictionary_id: v.dictionary_id || null
        })),
        modified: result.modified || text
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
 * 画像からテキストを抽出（LLM使用）
 */
export async function extractTextFromImageWithLLM(
  imageBuffer: Buffer, 
  prompt = 'この画像に含まれるテキストを日本語で正確に抽出してください。'
): Promise<string> {
  if (USE_MOCK) {
    return '模擬的に抽出されたテキストです。このサプリメントはがんに効果があります。'
  }

  if (!aiClient) {
    throw ErrorFactory.createExternalServiceError(aiProvider, 'image processing', 'AI client is not available for image processing')
  }

  try {
    const base64Image = imageBuffer.toString('base64')
    const completion = await aiClient.chat.completions.create({
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
      max_tokens: 1000
    })

    const extractedText = completion.choices[0]?.message?.content || ''
    return sanitizePlainText(extractedText)
    
  } catch (error) {
    console.error('[AI] Image text extraction failed:', error)
    throw ErrorFactory.createAIServiceError(aiProvider, 'image text extraction', error instanceof Error ? error.message : 'Unknown error', error instanceof Error ? error : undefined)
  }
}

// 既存関数のエクスポート（後方互換性）
export { AI_MODELS, aiProvider, isUsingMock, hasValidApiKey } from './config'