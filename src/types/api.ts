import { Database } from './database.types'

// 辞書カテゴリ（NG・ALLOW等）
export type DictionaryCategory = Database['public']['Enums']['dictionary_category']

// 辞書フレーズのメタデータ付き型（検索結果に使用）
export interface CombinedPhrase {
  id: string
  phrase: string
  phrase_reading: string | null
  category: DictionaryCategory
  description: string | null
  is_active: boolean
  created_at: string
  embedding: number[] | null
  similarity: number
  match_type: 'exact' | 'semantic' | 'both'
  original_phrase?: string
}

// レガシー辞書フレーズ型（チェックプロセッサー用）
export interface LegacyCombinedPhrase {
  id: number
  phrase: string
  category: DictionaryCategory
  trgm_similarity?: number
  vector_similarity?: number
  combined_score?: number
}

// 違反データ（フロントエンド表示用）
export interface ViolationData {
  phrase: string
  category: DictionaryCategory
  description: string | null
  startIndex: number
  endIndex: number
  suggestion?: string
  reason?: string
}

// レガシー違反データ型（バックエンド処理用）
export interface LegacyViolationData {
  start_pos: number
  end_pos: number
  reason: string
  dictionary_id?: number
}

// 辞書エントリーの基本型
export interface DictionaryEntry {
  id: string
  phrase: string
  phrase_reading: string | null
  category: DictionaryCategory
  description: string | null
}

// キャッシュアイテムの汎用型
export interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number
}

// 汎用キューアイテム型
export interface QueueItem {
  id: string
  priority: number
  payload: unknown
  attempts: number
  maxAttempts: number
  scheduledAt: Date
  createdAt: Date
}

// 埋め込みベクトル生成キューのアイテム型
export interface EmbeddingQueueItem {
  dictionaryId: string
  phrase: string
  priority?: number
}

// テキストチェックAPIリクエストの型
export interface CheckRequestBody {
  text: string
}

// OpenAI APIリクエストの型
export interface OpenAIRequestBody {
  model: string
  messages: Array<{ role: string; content: string }>
}

// LM Studio APIリクエストの型
export interface LMStudioRequestBody {
  model: string
  messages: Array<{ role: string; content: string }>
  temperature: number
  max_tokens: number
  stream: boolean
}