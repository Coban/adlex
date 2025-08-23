/**
 * LM Studio Client 実装
 * ローカルLLMサーバーとの統合処理
 */

import OpenAI from 'openai'

import { ErrorFactory } from '@/lib/errors'

import { aiProvider, getApiKey, getChatModel, getEmbeddingModel } from './config'
import { AIProvider, ChatCompletionRequest, ChatCompletionResponse, EmbeddingRequest, EmbeddingResponse } from './types'
import { generateJSONFromPlainText, extractCompleteJSON } from './utils'


/**
 * LM Studio クライアント
 */
export const lmStudioClient = aiProvider === 'lmstudio' ? new OpenAI({
  baseURL: process.env.LM_STUDIO_BASE_URL ?? 'http://localhost:1234/v1',
  apiKey: getApiKey() ?? 'lm-studio',
}) : null

/**
 * LM Studio埋め込み作成
 */
export async function createLMStudioEmbedding(
  input: string | string[], 
  model: string = getEmbeddingModel
): Promise<EmbeddingResponse> {
  if (!lmStudioClient) {
    throw ErrorFactory.createExternalServiceError('LM Studio', 'embedding', 'LM Studio client is not available')
  }

  try {
    const response = await lmStudioClient.embeddings.create({
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
    console.error('LM Studio embedding creation failed:', error)
    throw ErrorFactory.createAIServiceError('LM Studio', 'embedding', error instanceof Error ? error.message : 'Unknown error', error instanceof Error ? error : undefined)
  }
}

/**
 * LM Studio Provider実装
 */
export class LMStudioProvider implements AIProvider {
  private client: OpenAI
  private chatModel: string
  private embeddingModel: string

  constructor(
    baseURL: string = process.env.LM_STUDIO_BASE_URL ?? 'http://localhost:1234/v1',
    apiKey = 'lm-studio',
    chatModel: string = getChatModel,
    embeddingModel: string = getEmbeddingModel
  ) {
    this.client = new OpenAI({ baseURL, apiKey })
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
      })

      const choice = completion.choices[0]
      if (!choice) {
        throw ErrorFactory.createAIServiceError('LM Studio', 'chat completion', 'No response received from LM Studio')
      }

      let content = choice.message.content || ''
      
      // LM Studio用JSON解析フォールバック
      if (request.functions && !choice.message.function_call) {
        const extractedJson = extractCompleteJSON(content)
        if (extractedJson) {
          content = extractedJson
        } else {
          // JSONが見つからない場合は生成
          content = generateJSONFromPlainText('', content)
        }
      }

      return {
        content,
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
      console.error('LM Studio chat completion failed:', error)
      throw ErrorFactory.createAIServiceError('LM Studio', 'chat completion', error instanceof Error ? error.message : 'Unknown error', error instanceof Error ? error : undefined)
    }
  }

  async createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return createLMStudioEmbedding(request.input, request.model ?? this.embeddingModel)
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