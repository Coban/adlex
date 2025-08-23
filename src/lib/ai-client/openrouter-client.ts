/**
 * OpenRouter Client 実装
 * OpenRouter API との統合処理
 */

import OpenAI from 'openai'
import { AIProvider, ChatCompletionRequest, ChatCompletionResponse, EmbeddingRequest, EmbeddingResponse } from './types'
import { aiProvider, getApiKey, getChatModel, getEmbeddingModel, getEmbeddingProvider } from './config'
import { getSanitizedReferer } from './utils'
import { ErrorFactory } from '@/lib/errors'

/**
 * OpenRouter クライアント
 */
export const openRouterClient = (aiProvider === 'openrouter' && getApiKey()) ? new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: getApiKey()!,
  defaultHeaders: {
    'HTTP-Referer': getSanitizedReferer(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
    'X-Title': 'AdLex - Pharmaceutical Law Compliance Checker',
  },
}) : null

/**
 * OpenRouter Provider実装
 */
export class OpenRouterProvider implements AIProvider {
  private client: OpenAI
  private chatModel: string
  private embeddingModel: string

  constructor(apiKey: string, chatModel: string = getChatModel, embeddingModel: string = getEmbeddingModel) {
    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
      defaultHeaders: {
        'HTTP-Referer': getSanitizedReferer(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
        'X-Title': 'AdLex - Pharmaceutical Law Compliance Checker',
      },
    })
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
        throw ErrorFactory.createAIServiceError('OpenRouter', 'chat completion', 'No response received from OpenRouter')
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
      console.error('OpenRouter chat completion failed:', error)
      throw ErrorFactory.createAIServiceError('OpenRouter', 'chat completion', error instanceof Error ? error.message : 'Unknown error', error instanceof Error ? error : undefined)
    }
  }

  async createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    // OpenRouterは埋め込みAPIをサポートしていないため、エラーを投げる
    // 実際の埋め込み処理は main.ts の createEmbedding で適切なプロバイダーが選択される
    throw ErrorFactory.createValidationError('OpenRouter does not support embeddings directly. Use createEmbedding function instead.')
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