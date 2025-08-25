/**
 * AI Client 共通型定義
 * 各プロバイダー実装で使用される共通インターフェース
 */

export interface AIClientConfig {
  apiKey: string
  baseURL?: string
  model: string
  timeout?: number
}

export interface ChatCompletionRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  temperature?: number
  max_tokens?: number
  functions?: Array<{
    name: string
    description: string
    parameters: Record<string, unknown>
  }>
}

export interface ChatCompletionResponse {
  content: string
  function_call?: {
    name: string
    arguments: string
  }
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface EmbeddingRequest {
  input: string | string[]
  model?: string
  dimensions?: number
}

export interface EmbeddingResponse {
  data: Array<{
    embedding: number[]
    index: number
  }>
  usage?: {
    prompt_tokens: number
    total_tokens: number
  }
}

export interface AIProvider {
  createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>
  createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse>
  validateConfig(): Promise<boolean>
  getModelInfo(): { chatModel: string; embeddingModel: string }
}

export type SupportedProvider = 'openai' | 'openrouter' | 'lmstudio' | 'mock'

export interface ModelConfiguration {
  provider: SupportedProvider
  chatModel: string
  embeddingModel: string
  apiKey?: string
  baseURL?: string
}

// Legacy types for backward compatibility
export interface LegacyDictionaryEntry {
  id: number
  phrase: string
  category: 'NG' | 'ALLOW'
  notes?: string
  reason?: string
}

export interface LegacyViolationData {
  id: number
  start_pos: number
  end_pos: number
  reason: string
  dictionary_id?: number
  type?: string
}