/**
 * AI Client 設定管理
 * 環境変数読み込み、バリデーション、プロバイダー選択
 */

import { ModelConfiguration, SupportedProvider } from './types'

// 環境検出
export const isProduction = process.env.NODE_ENV === 'production'
export const isTest = process.env.NODE_ENV === 'test'

// 古い環境変数との後方互換性
export const legacyOpenAIKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here'
export const legacyOpenRouterKey = process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'your-openrouter-api-key'

// AIプロバイダー設定
export const aiProvider: SupportedProvider = (process.env.AI_PROVIDER as SupportedProvider) ?? (isProduction ? 'openai' : 'lmstudio')
export const hasValidApiKey = Boolean(process.env.AI_API_KEY && process.env.AI_API_KEY !== 'your-api-key')

// モック使用設定
export const USE_MOCK = isTest

/**
 * プロバイダーベースのAPIキー取得（後方互換性付き）
 */
export function getApiKey(): string | null {
  if (process.env.AI_API_KEY && process.env.AI_API_KEY !== 'your-api-key') {
    return process.env.AI_API_KEY
  }
  // 後方互換性
  if (aiProvider === 'openai' && legacyOpenAIKey) {
    return process.env.OPENAI_API_KEY!
  }
  if (aiProvider === 'openrouter' && legacyOpenRouterKey) {
    return process.env.OPENROUTER_API_KEY!
  }
  if (aiProvider === 'lmstudio') {
    return process.env.LM_STUDIO_API_KEY ?? 'lm-studio'
  }
  return null
}

/**
 * チャットモデル名を取得
 */
export const getChatModel = (() => {
  const configuredModel = process.env.AI_CHAT_MODEL
  if (configuredModel) return configuredModel

  // 後方互換性とデフォルト値
  if (aiProvider === 'lmstudio') {
    return process.env.LM_STUDIO_CHAT_MODEL ?? 'llama-3.1-8b-instruct'
  }
  
  // プロバイダー別デフォルト
  switch (aiProvider) {
    case 'openai': return 'gpt-4o'
    case 'openrouter': return 'openai/gpt-4o'
    case 'mock': return 'mock-chat-model'
    default: return 'gpt-4o'
  }
})()

/**
 * 埋め込みモデル名を取得
 */
export const getEmbeddingModel = (() => {
  const configuredModel = process.env.AI_EMBEDDING_MODEL
  if (configuredModel) return configuredModel

  // 後方互換性
  if (aiProvider === 'lmstudio') {
    return process.env.LM_STUDIO_EMBEDDING_MODEL ?? 'nomic-embed-text'
  }
  
  // プロバイダー別デフォルト
  switch (aiProvider) {
    case 'openai': return 'text-embedding-3-small'
    case 'openrouter': return 'text-embedding-3-small' // OpenRouterは埋め込み非対応
    case 'mock': return 'mock-embedding-model'
    default: return 'text-embedding-3-small'
  }
})()

/**
 * 埋め込みプロバイダーを取得（OpenRouter用）
 */
export function getEmbeddingProvider(): 'openai' | 'lmstudio' | 'auto' {
  if (aiProvider !== 'openrouter') return aiProvider as 'openai' | 'lmstudio'
  
  const embeddingProvider = process.env.AI_EMBEDDING_PROVIDER
  if (embeddingProvider === 'openai' || embeddingProvider === 'lmstudio' || embeddingProvider === 'auto') {
    return embeddingProvider
  }
  
  return 'auto' // デフォルト
}

/**
 * AI設定情報を取得
 */
export function getAIClientInfo(): ModelConfiguration {
  return {
    provider: aiProvider,
    chatModel: getChatModel,
    embeddingModel: getEmbeddingModel,
    apiKey: getApiKey() ?? undefined,
    baseURL: aiProvider === 'lmstudio' ? (process.env.LM_STUDIO_BASE_URL ?? 'http://localhost:1234/v1') : undefined
  }
}

/**
 * 使用中のモデル一覧を取得
 */
export const AI_MODELS = {
  chat: getChatModel,
  embedding: getEmbeddingModel,
  provider: aiProvider
}

/**
 * モック使用判定
 */
export function isUsingMock(): boolean {
  return USE_MOCK || aiProvider === 'mock'
}