import { Database } from '@/types/database.types'

import { BaseRepository, FindManyOptions } from './base'

// Helper types using Supabase generated types
export type Dictionary = Database['public']['Tables']['dictionaries']['Row']
export type DictionaryInsert = Database['public']['Tables']['dictionaries']['Insert']
export type DictionaryUpdate = Database['public']['Tables']['dictionaries']['Update']
export type DictionaryCategory = Database['public']['Enums']['dictionary_category']

/**
 * Dictionary search options for the API
 */
export interface DictionarySearchOptions {
  organizationId: number
  search?: string
  category?: DictionaryCategory | 'ALL'
}

/**
 * Dictionary creation response
 */
export interface DictionaryCreateResponse {
  dictionary: Dictionary
  warning?: string
}

/**
 * Dictionaries repository interface with dictionary-specific methods
 */
export interface DictionariesRepository extends BaseRepository<Dictionary, DictionaryInsert, DictionaryUpdate> {
  /**
   * Find dictionaries by organization ID
   */
  findByOrganizationId(organizationId: number, options?: FindManyOptions<Dictionary>): Promise<Dictionary[]>

  /**
   * Find dictionaries by category
   */
  findByCategory(category: DictionaryCategory, options?: FindManyOptions<Dictionary>): Promise<Dictionary[]>

  /**
   * Find dictionaries by organization and category
   */
  findByOrganizationAndCategory(
    organizationId: number,
    category: DictionaryCategory,
    options?: FindManyOptions<Dictionary>
  ): Promise<Dictionary[]>

  /**
   * Search dictionaries by phrase (text similarity)
   */
  searchByPhrase(phrase: string, organizationId?: number, options?: FindManyOptions<Dictionary>): Promise<Dictionary[]>

  /**
   * Search dictionaries with filters (for API routes)
   */
  searchDictionaries(searchOptions: DictionarySearchOptions): Promise<Dictionary[]>

  /**
   * Find similar phrases using vector similarity
   */
  findSimilarPhrases(
    vector: number[],
    threshold?: number,
    organizationId?: number,
    options?: FindManyOptions<Dictionary>
  ): Promise<Dictionary[]>

  /**
   * Count dictionaries by organization
   */
  countByOrganizationId(organizationId: number): Promise<number>

  /**
   * Count dictionaries by category
   */
  countByCategory(category: DictionaryCategory): Promise<number>

  /**
   * Bulk insert dictionaries
   */
  bulkCreate(data: DictionaryInsert[]): Promise<Dictionary[]>

  /**
   * Update dictionary vector
   */
  updateVector(id: number, vector: number[]): Promise<Dictionary | null>

  /**
   * Create dictionary with automatic embedding generation
   */
  createWithEmbedding(data: Omit<DictionaryInsert, 'vector'>): Promise<DictionaryCreateResponse>

  /**
   * Update dictionary with automatic embedding regeneration if phrase changes
   */
  updateWithEmbedding(id: number, organizationId: number, data: {
    phrase: string
    category: DictionaryCategory
    notes?: string | null
  }): Promise<DictionaryCreateResponse>

  /**
   * Find dictionary by ID and organization
   */
  findByIdAndOrganization(id: number, organizationId: number): Promise<Dictionary | null>
}