/**
 * OpenAI Client 実装
 * OpenAI API との統合処理
 */

import OpenAI from 'openai'
import { AIProvider, ChatCompletionRequest, ChatCompletionResponse, EmbeddingRequest, EmbeddingResponse } from './types'
import { aiProvider, getApiKey, getChatModel, getEmbeddingModel, legacyOpenAIKey } from './config'
import { ErrorFactory } from '@/lib/errors'

/**
 * OpenAI クライアント（チャット用）
 */
export const openaiClient = (aiProvider === 'openai' && getApiKey()) ? new OpenAI({
  apiKey: getApiKey()!,
}) : null

/**
 * OpenAI クライアント（埋め込み用 - メインプロバイダーと独立して初期化）
 * OPENAI_API_KEY が存在する場合、または AI_PROVIDER が openai で AI_API_KEY が設定されている場合に作成
 */
let openaiEmbeddingClient: OpenAI | null = (() => {
  // OPENAI専用キー（推奨）
  const explicitOpenAIKey = legacyOpenAIKey ? process.env.OPENAI_API_KEY! : null
  // AI_PROVIDER が openai の場合は統一キーも利用可能
  const providerOpenAIKey = (aiProvider === 'openai' && getApiKey()) ? getApiKey() : null
  const key = explicitOpenAIKey ?? providerOpenAIKey
  return key ? new OpenAI({ apiKey: key }) : null
})()

/**
 * 埋め込み用のOpenAIクライアントをオンデマンドで初期化して取得
 */
export function ensureOpenAIEmbeddingClient(): OpenAI | null {
  if (openaiEmbeddingClient) return openaiEmbeddingClient

  // 優先: 明示的な OPENAI_API_KEY
  const openaiKey = (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here')
    ? process.env.OPENAI_API_KEY!
    : null

  // 次点: メインプロバイダーが OpenAI の場合は AI_API_KEY
  const providerKey = (aiProvider === 'openai' && getApiKey()) ? getApiKey() : null

  const keyToUse = openaiKey ?? providerKey
  if (keyToUse) {
    openaiEmbeddingClient = new OpenAI({ apiKey: keyToUse })
    return openaiEmbeddingClient
  }

  return null
}

/**
 * OpenAI埋め込み作成
 */
export async function createOpenAIEmbedding(
  input: string | string[], 
  model: string = getEmbeddingModel
): Promise<EmbeddingResponse> {
  const client = ensureOpenAIEmbeddingClient()
  if (!client) {
    throw ErrorFactory.createExternalServiceError('OpenAI', 'embedding', 'OpenAI embedding client is not available')
  }

  try {
    const response = await client.embeddings.create({
      model,
      input,
      encoding_format: 'float'
    })

    return {
      data: response.data.map((item, index) => ({
        embedding: item.embedding,
        index
      })),
      usage: response.usage ? {
        prompt_tokens: response.usage.prompt_tokens,
        total_tokens: response.usage.total_tokens
      } : undefined
    }
  } catch (error) {
    console.error('OpenAI embedding creation failed:', error)
    throw ErrorFactory.createAIServiceError('OpenAI', 'embedding', error instanceof Error ? error.message : 'Unknown error', error instanceof Error ? error : undefined)
  }
}

/**
 * OpenAI Provider実装
 */
export class OpenAIProvider implements AIProvider {
  private client: OpenAI
  private chatModel: string
  private embeddingModel: string

  constructor(apiKey: string, chatModel: string = getChatModel, embeddingModel: string = getEmbeddingModel) {
    this.client = new OpenAI({ apiKey })
    this.chatModel = chatModel
    this.embeddingModel = embeddingModel
  }

  async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.chatModel,
        messages: request.messages,
        temperature: request.temperature ?? 0.1,
        max_tokens: request.max_tokens ?? 4000,
        functions: request.functions,
        function_call: request.functions ? 'auto' : undefined
      })

      const choice = completion.choices[0]
      if (!choice) {
        throw ErrorFactory.createAIServiceError('OpenAI', 'chat completion', 'No response received from OpenAI')
      }

      return {
        content: choice.message.content || '',
        function_call: choice.message.function_call ? {
          name: choice.message.function_call.name,
          arguments: choice.message.function_call.arguments
        } : undefined,
        usage: completion.usage ? {
          prompt_tokens: completion.usage.prompt_tokens,
          completion_tokens: completion.usage.completion_tokens,
          total_tokens: completion.usage.total_tokens
        } : undefined
      }
    } catch (error) {
      console.error('OpenAI chat completion failed:', error)
      throw ErrorFactory.createAIServiceError('OpenAI', 'chat completion', error instanceof Error ? error.message : 'Unknown error', error instanceof Error ? error : undefined)
    }
  }

  async createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return createOpenAIEmbedding(request.input, request.model ?? this.embeddingModel)
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.client.models.list()
      return true
    } catch {
      return false
    }
  }

  getModelInfo() {
    return {
      chatModel: this.chatModel,
      embeddingModel: this.embeddingModel
    }
  }
}