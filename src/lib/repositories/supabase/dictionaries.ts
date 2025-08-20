import { SupabaseClient } from '@supabase/supabase-js'

import { createEmbedding } from '@/lib/ai-client'
import { Database } from '@/types/database.types'

import { FindManyOptions } from '../interfaces/base'
import {
  Dictionary,
  DictionaryInsert,
  DictionaryUpdate,
  DictionaryCategory,
  DictionarySearchOptions,
  DictionaryCreateResponse,
  DictionariesRepository,
} from '../interfaces/dictionaries'

import { SupabaseBaseRepository } from './base'

/**
 * Supabase implementation of DictionariesRepository
 */
export class SupabaseDictionariesRepository
  extends SupabaseBaseRepository<Dictionary, DictionaryInsert, DictionaryUpdate>
  implements DictionariesRepository
{
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'dictionaries')
  }

  async findByOrganizationId(organizationId: number, options?: FindManyOptions<Dictionary>): Promise<Dictionary[]> {
    return this.findMany({ 
      ...options, 
      where: { ...options?.where, organization_id: organizationId } 
    })
  }

  async findByCategory(category: DictionaryCategory, options?: FindManyOptions<Dictionary>): Promise<Dictionary[]> {
    return this.findMany({ 
      ...options, 
      where: { ...options?.where, category } 
    })
  }

  async findByOrganizationAndCategory(
    organizationId: number,
    category: DictionaryCategory,
    options?: FindManyOptions<Dictionary>
  ): Promise<Dictionary[]> {
    return this.findMany({ 
      ...options, 
      where: { ...options?.where, organization_id: organizationId, category } 
    })
  }

  async searchByPhrase(phrase: string, organizationId?: number, options?: FindManyOptions<Dictionary>): Promise<Dictionary[]> {
    try {
      let query = this.supabase
        .from('dictionaries')
        .select('*')
        .ilike('phrase', `%${phrase}%`)

      if (organizationId) {
        query = query.eq('organization_id', organizationId)
      }

      // Apply options
      if (options?.orderBy) {
        options.orderBy.forEach(({ field, direction }) => {
          query = query.order(field as string, { ascending: direction === 'asc' })
        })
      }

      if (options?.limit) {
        query = query.limit(options.limit)
      }

      const { data, error } = await query

      if (error) {
        throw this.createRepositoryError('Failed to search dictionaries by phrase', error)
      }

      return (data || []) as Dictionary[]
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw this.createRepositoryError('Unexpected error searching by phrase', error as Error)
    }
  }

  async findSimilarPhrases(
    vector: number[],
    _threshold = 0.75,
    organizationId?: number,
    options?: FindManyOptions<Dictionary>
  ): Promise<Dictionary[]> {
    try {
      // Convert vector to string format expected by pgvector
      // Note: Currently not used but keeping for future pgvector implementation
      // const vectorString = `[${vector.join(',')}]`
      
      let query = this.supabase
        .from('dictionaries')
        .select('*')
        .not('vector', 'is', null)

      if (organizationId) {
        query = query.eq('organization_id', organizationId)
      }

      // Apply options
      if (options?.limit) {
        query = query.limit(options.limit)
      }

      const { data, error } = await query

      if (error) {
        throw this.createRepositoryError('Failed to find similar phrases', error)
      }

      // Filter by similarity threshold (this would be better done with pgvector similarity functions)
      // For now, returning all results - in production, you'd use RPC with similarity functions
      return (data || []) as Dictionary[]
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw this.createRepositoryError('Unexpected error finding similar phrases', error as Error)
    }
  }

  async countByOrganizationId(organizationId: number): Promise<number> {
    return this.count({ organization_id: organizationId })
  }

  async countByCategory(category: DictionaryCategory): Promise<number> {
    return this.count({ category })
  }

  async bulkCreate(data: DictionaryInsert[]): Promise<Dictionary[]> {
    try {
      const { data: result, error } = await this.supabase
        .from('dictionaries')
        .insert(data)
        .select()

      if (error) {
        throw this.createRepositoryError('Failed to bulk create dictionaries', error)
      }

      return (result || []) as Dictionary[]
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw this.createRepositoryError('Unexpected error bulk creating dictionaries', error as Error)
    }
  }

  async updateVector(id: number, vector: number[]): Promise<Dictionary | null> {
    try {
      const vectorString = `[${vector.join(',')}]`
      return this.update(id, { vector: vectorString })
    } catch (error) {
      throw this.createRepositoryError('Failed to update dictionary vector', error as Error)
    }
  }

  async searchDictionaries(searchOptions: DictionarySearchOptions): Promise<Dictionary[]> {
    try {
      const { organizationId, search, category } = searchOptions

      let query = this.supabase
        .from('dictionaries')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      // カテゴリフィルター
      if (category !== 'ALL' && (category === 'NG' || category === 'ALLOW')) {
        query = query.eq('category', category)
      }

      // 検索フィルター
      if (search) {
        query = query.or(`phrase.ilike.%${search}%,notes.ilike.%${search}%`)
      }

      const { data, error } = await query

      if (error) {
        throw this.createRepositoryError('Failed to search dictionaries', error)
      }

      return (data || []) as Dictionary[]
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw this.createRepositoryError('Unexpected error searching dictionaries', error as Error)
    }
  }

  async createWithEmbedding(data: Omit<DictionaryInsert, 'vector'>): Promise<DictionaryCreateResponse> {
    try {
      // Embedding生成
      let vector: number[] | null = null
      try {
        vector = await createEmbedding(data.phrase.trim())
      } catch (embeddingError) {
        console.warn('Embedding生成に失敗しました:', embeddingError)
        // Embedding生成に失敗してもアイテム作成は続行
      }

      const newDictionary: DictionaryInsert = {
        ...data,
        phrase: data.phrase.trim(),
        notes: data.notes?.trim() ?? null,
        vector: vector ? JSON.stringify(vector) : null,
      }

      const dictionary = await this.create(newDictionary)

      // Embedding生成に失敗した場合は警告を含める
      const response: DictionaryCreateResponse = { dictionary }
      if (!vector) {
        response.warning =
          '辞書項目は作成されましたが、Embedding生成に失敗しました。後で手動で再生成することができます。'
      }

      return response
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw this.createRepositoryError('Failed to create dictionary with embedding', error as Error)
    }
  }

  async updateWithEmbedding(id: number, organizationId: number, data: {
    phrase: string
    category: DictionaryCategory
    notes?: string | null
  }): Promise<DictionaryCreateResponse> {
    try {
      // 既存の辞書項目を取得
      const existingDictionary = await this.findByIdAndOrganization(id, organizationId)
      if (!existingDictionary) {
        throw this.createRepositoryError('Dictionary not found', new Error('Dictionary not found'))
      }

      // フレーズが変更された場合のみembedding再生成
      let vector: string | null = null
      const phraseChanged = existingDictionary.phrase !== data.phrase.trim()

      if (phraseChanged) {
        try {
          const newVector = await createEmbedding(data.phrase.trim())
          vector = JSON.stringify(newVector)
        } catch (embeddingError) {
          console.warn('Embedding再生成に失敗しました:', embeddingError)
          // Embedding生成に失敗してもアイテム更新は続行
        }
      }

      const updates: DictionaryUpdate = {
        phrase: data.phrase.trim(),
        category: data.category,
        notes: data.notes?.trim() ?? null,
        updated_at: new Date().toISOString(),
      }

      // フレーズが変更された場合のみvectorを更新
      if (phraseChanged && vector !== null) {
        (updates as DictionaryUpdate & { vector: string }).vector = vector
      }

      const dictionary = await this.update(id, updates)
      if (!dictionary) {
        throw this.createRepositoryError('Failed to update dictionary', new Error('Update failed'))
      }

      // Embedding生成に失敗した場合は警告を含める
      const response: DictionaryCreateResponse = { dictionary }
      if (phraseChanged && vector === null) {
        response.warning =
          '辞書項目は更新されましたが、Embedding再生成に失敗しました。後で手動で再生成することができます。'
      }

      return response
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw this.createRepositoryError('Failed to update dictionary with embedding', error as Error)
    }
  }

  async findByIdAndOrganization(id: number, organizationId: number): Promise<Dictionary | null> {
    try {
      const { data, error } = await this.supabase
        .from('dictionaries')
        .select('*')
        .eq('id', id)
        .eq('organization_id', organizationId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // No rows found
        throw this.createRepositoryError('Failed to find dictionary by ID and organization', error)
      }

      return data as Dictionary
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw this.createRepositoryError('Unexpected error finding dictionary', error as Error)
    }
  }
}