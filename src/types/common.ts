import { Database } from './database.types'

// 辞書テーブルのレコード型
export type Dictionary = Database['public']['Tables']['dictionaries']['Row']

// 埋め込みベクトル処理統計
export interface EmbeddingStats {
  total: number // 総辞書エントリー数
  processed: number // 処理済み数
  pending: number // 未処理数
  failed: number // 失敗数
  lastUpdated: string | null // 最終更新日時
}

// 辞書一覧コンポーネントのプロパティ
export interface DictionaryListProps {
  initialDictionaries: Dictionary[]
  initialEmbeddingStats: EmbeddingStats
}

// テスト用モック型（SSRクライアント用）
export type SSRCreateServerClientMock = Record<string, unknown> & { mock: { calls: unknown[][] } }