import { Database } from '@/types/database.types'

export type Dictionary = Database['public']['Tables']['dictionaries']['Row']
export type Organization = Database['public']['Tables']['organizations']['Row']

export interface EmbeddingStats {
  organizationId: number
  totalItems: number
  itemsWithEmbedding: number
  itemsWithoutEmbedding: number
  embeddingCoverageRate: number
}

export interface DictionaryStats {
  totals: {
    total: number
    ng: number
    allow: number
  }
  topUsed: {
    dictionary_id: number
    count: number
    phrase: string
  }[]
  since: string
}

export interface DictionaryFormData {
  phrase: string
  category: 'NG' | 'ALLOW'
  notes: string
}

export type SortOption =
  | 'created_desc'
  | 'created_asc'
  | 'updated_desc'
  | 'updated_asc'
  | 'phrase_asc'
  | 'phrase_desc'
  | 'category_asc'
  | 'category_desc'

export type CategoryFilter = 'ALL' | 'NG' | 'ALLOW'

export interface DuplicateGroup {
  phrase: string
  items: Dictionary[]
}

export interface DictionaryListProps {
  dictionaries: Dictionary[]
  selectedIds: Set<number>
  onToggleSelect: (id: number) => void
  onEdit: (dictionary: Dictionary) => void
  onDelete: (id: number) => void
}