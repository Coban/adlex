import { vi } from 'vitest'

import { FindManyOptions } from '@/lib/repositories/interfaces/base'
import {
  Dictionary,
  DictionaryInsert,
  DictionaryUpdate,
  DictionaryCategory,
  DictionarySearchOptions,
  DictionaryCreateResponse,
  DictionariesRepository,
} from '@/lib/repositories/interfaces/dictionaries'

/**
 * Mock implementation of DictionariesRepository for testing
 */
export class MockDictionariesRepository implements DictionariesRepository {
  // Mock data storage
  private dictionaries: Dictionary[] = [
    {
      id: 1,
      organization_id: 1,
      phrase: 'がんが治る',
      category: 'NG',
      notes: '薬機法に抵触する表現',
      vector: null,
      created_at: '2024-01-20T10:00:00Z',
      updated_at: '2024-01-20T10:00:00Z',
    },
    {
      id: 2,
      organization_id: 1,
      phrase: '健康をサポート',
      category: 'ALLOW',
      notes: '推奨される表現',
      vector: null,
      created_at: '2024-01-20T09:00:00Z',
      updated_at: '2024-01-20T09:00:00Z',
    },
  ]

  // Spy on methods for testing
  findById = vi.fn(async (id: number): Promise<Dictionary | null> => {
    return this.dictionaries.find(dict => dict.id === id) ?? null
  })

  findMany = vi.fn(async (options?: FindManyOptions<Dictionary>): Promise<Dictionary[]> => {
    let result = [...this.dictionaries]

    if (options?.where) {
      result = result.filter(dict => {
        return Object.entries(options.where!).every(([key, value]) => {
          return dict[key as keyof Dictionary] === value
        })
      })
    }

    if (options?.orderBy) {
      result.sort((a, b) => {
        for (const { field, direction } of options.orderBy!) {
          const aVal = a[field as keyof Dictionary]
          const bVal = b[field as keyof Dictionary]
          
          if (aVal === null || aVal === undefined) return 1
          if (bVal === null || bVal === undefined) return -1
          
          const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
          if (comparison !== 0) {
            return direction === 'asc' ? comparison : -comparison
          }
        }
        return 0
      })
    }

    if (options?.limit) {
      result = result.slice(0, options.limit)
    }

    return result
  })

  create = vi.fn(async (data: DictionaryInsert): Promise<Dictionary> => {
    const newDict: Dictionary = {
      id: Date.now(),
      organization_id: data.organization_id,
      phrase: data.phrase,
      category: data.category as DictionaryCategory,
      notes: data.notes ?? null,
      vector: data.vector ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    this.dictionaries.push(newDict)
    return newDict
  })

  update = vi.fn(async (id: number, data: DictionaryUpdate): Promise<Dictionary | null> => {
    const dictIndex = this.dictionaries.findIndex(dict => dict.id === id)
    if (dictIndex === -1) return null

    this.dictionaries[dictIndex] = {
      ...this.dictionaries[dictIndex],
      ...data,
      updated_at: new Date().toISOString(),
    }
    return this.dictionaries[dictIndex]
  })

  delete = vi.fn(async (id: number): Promise<boolean> => {
    const initialLength = this.dictionaries.length
    this.dictionaries = this.dictionaries.filter(dict => dict.id !== id)
    return this.dictionaries.length < initialLength
  })

  count = vi.fn(async (filter?: Partial<Dictionary>): Promise<number> => {
    if (!filter) return this.dictionaries.length

    return this.dictionaries.filter(dict => {
      return Object.entries(filter).every(([key, value]) => {
        return dict[key as keyof Dictionary] === value
      })
    }).length
  })

  findByOrganizationId = vi.fn(async (organizationId: number, options?: FindManyOptions<Dictionary>): Promise<Dictionary[]> => {
    return this.findMany({ ...options, where: { ...options?.where, organization_id: organizationId } })
  })

  findByCategory = vi.fn(async (category: DictionaryCategory, options?: FindManyOptions<Dictionary>): Promise<Dictionary[]> => {
    return this.findMany({ ...options, where: { ...options?.where, category } })
  })

  findByOrganizationAndCategory = vi.fn(async (
    organizationId: number,
    category: DictionaryCategory,
    options?: FindManyOptions<Dictionary>
  ): Promise<Dictionary[]> => {
    return this.findMany({ ...options, where: { ...options?.where, organization_id: organizationId, category } })
  })

  searchByPhrase = vi.fn(async (phrase: string, organizationId?: number, options?: FindManyOptions<Dictionary>): Promise<Dictionary[]> => {
    let filtered = this.dictionaries.filter(dict => 
      dict.phrase?.includes(phrase) || dict.notes?.includes(phrase)
    )

    if (organizationId) {
      filtered = filtered.filter(dict => dict.organization_id === organizationId)
    }

    return filtered.slice(0, options?.limit ?? filtered.length)
  })

  searchDictionaries = vi.fn(async (searchOptions: DictionarySearchOptions): Promise<Dictionary[]> => {
    const { organizationId, search, category } = searchOptions

    const filtered = this.dictionaries.filter(dict => {
      // Organization filter
      if (dict.organization_id !== organizationId) return false

      // Category filter
      if (category !== 'ALL' && dict.category !== category) return false

      // Search filter
      if (search && !dict.phrase?.includes(search) && !dict.notes?.includes(search)) {
        return false
      }

      return true
    })

    // Sort by created_at desc
    filtered.sort((a, b) => {
      const aDate = a.created_at ? new Date(a.created_at).getTime() : 0
      const bDate = b.created_at ? new Date(b.created_at).getTime() : 0
      return bDate - aDate
    })

    return filtered
  })

  findSimilarPhrases = vi.fn(async (
    _vector: number[],
    _threshold = 0.75,
    organizationId?: number,
    options?: FindManyOptions<Dictionary>
  ): Promise<Dictionary[]> => {
    // Mock implementation - just return dictionaries with vectors
    let filtered = this.dictionaries.filter(dict => dict.vector !== null)
    
    if (organizationId) {
      filtered = filtered.filter(dict => dict.organization_id === organizationId)
    }

    return filtered.slice(0, options?.limit ?? 5)
  })

  countByOrganizationId = vi.fn(async (organizationId: number): Promise<number> => {
    return this.dictionaries.filter(dict => dict.organization_id === organizationId).length
  })

  countByCategory = vi.fn(async (category: DictionaryCategory): Promise<number> => {
    return this.dictionaries.filter(dict => dict.category === category).length
  })

  bulkCreate = vi.fn(async (data: DictionaryInsert[]): Promise<Dictionary[]> => {
    const newDicts = data.map((item, index) => ({
      id: Date.now() + index,
      organization_id: item.organization_id,
      phrase: item.phrase,
      category: (item.category ?? 'NG') as DictionaryCategory,
      notes: item.notes ?? null,
      vector: item.vector ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
    
    this.dictionaries.push(...newDicts)
    return newDicts
  })

  updateVector = vi.fn(async (id: number, vector: number[]): Promise<Dictionary | null> => {
    return this.update(id, { vector: JSON.stringify(vector) })
  })

  createWithEmbedding = vi.fn(async (data: Omit<DictionaryInsert, 'vector'>): Promise<DictionaryCreateResponse> => {
    const dictionary = await this.create({ ...data, vector: '[]' }) // Mock vector
    return {
      dictionary,
      warning: undefined, // No warning in mock
    }
  })

  updateWithEmbedding = vi.fn(async (id: number, organizationId: number, data: {
    phrase: string
    category: DictionaryCategory
    notes?: string | null
  }): Promise<DictionaryCreateResponse> => {
    const dictionary = await this.update(id, { ...data, vector: '[]' })
    if (!dictionary) {
      throw new Error('Dictionary not found')
    }
    return {
      dictionary,
      warning: undefined
    }
  })

  findByIdAndOrganization = vi.fn(async (id: number, organizationId: number): Promise<Dictionary | null> => {
    return this.dictionaries.find(dict => dict.id === id && dict.organization_id === organizationId) ?? null
  })

  // Helper methods for test setup
  setMockDictionaries(dictionaries: Dictionary[]) {
    this.dictionaries = [...dictionaries]
  }

  reset() {
    vi.clearAllMocks()
    // Reset to default data
    this.dictionaries = [
      {
        id: 1,
        organization_id: 1,
        phrase: 'がんが治る',
        category: 'NG',
        notes: '薬機法に抵触する表現',
        vector: null,
        created_at: '2024-01-20T10:00:00Z',
        updated_at: '2024-01-20T10:00:00Z',
      },
      {
        id: 2,
        organization_id: 1,
        phrase: '健康をサポート',
        category: 'ALLOW',
        notes: '推奨される表現',
        vector: null,
        created_at: '2024-01-20T09:00:00Z',
        updated_at: '2024-01-20T09:00:00Z',
      },
    ]
  }
}