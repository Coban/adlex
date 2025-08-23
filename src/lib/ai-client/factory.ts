/**
 * AI Client Factory
 * プロバイダー選択とクライアント生成
 */

import { ErrorFactory } from '@/lib/errors'

import { aiProvider, getApiKey, getChatModel, getEmbeddingModel, isUsingMock } from './config'
import { LMStudioProvider, lmStudioClient } from './lmstudio-client'
import { MockProvider } from './mock-client'
import { OpenAIProvider, openaiClient } from './openai-client'
import { OpenRouterProvider, openRouterClient } from './openrouter-client'
import { AIProvider, SupportedProvider } from './types'


/**
 * 適切なクライアントを選択
 */
export const aiClient = (() => {
  switch (aiProvider) {
    case 'lmstudio':
      return lmStudioClient
    case 'openrouter':
      return openRouterClient
    case 'openai':
    default:
      return openaiClient
  }
})()

/**
 * AIプロバイダーファクトリー
 */
export function createAIProvider(provider?: SupportedProvider): AIProvider {
  const selectedProvider = provider ?? aiProvider
  const apiKey = getApiKey()

  if (isUsingMock() || selectedProvider === 'mock') {
    return new MockProvider()
  }

  switch (selectedProvider) {
    case 'openai':
      if (!apiKey) throw ErrorFactory.createValidationError('OpenAI API key is required')
      return new OpenAIProvider(apiKey, getChatModel, getEmbeddingModel)
      
    case 'openrouter':
      if (!apiKey) throw ErrorFactory.createValidationError('OpenRouter API key is required')
      return new OpenRouterProvider(apiKey, getChatModel, getEmbeddingModel)
      
    case 'lmstudio':
      return new LMStudioProvider(
        process.env.LM_STUDIO_BASE_URL ?? 'http://localhost:1234/v1',
        apiKey ?? 'lm-studio',
        getChatModel,
        getEmbeddingModel
      )
      
    default:
      throw ErrorFactory.createValidationError(`Unsupported AI provider: ${selectedProvider}`)
  }
}

/**
 * デフォルトプロバイダーインスタンスを取得
 */
export function getDefaultProvider(): AIProvider {
  return createAIProvider()
}