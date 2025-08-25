import { Dictionary, SortOption } from '../types'

/**
 * 辞書項目のソート機能
 */
export function sortDictionaries(dictionaries: Dictionary[], sortOption: SortOption): Dictionary[] {
  return [...dictionaries].sort((a, b) => {
    switch (sortOption) {
      case 'created_desc':
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      case 'created_asc':
        return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
      case 'updated_desc': {
        const au = a.updated_at ?? a.created_at ?? ''
        const bu = b.updated_at ?? b.created_at ?? ''
        return new Date(bu).getTime() - new Date(au).getTime()
      }
      case 'updated_asc': {
        const au = a.updated_at ?? a.created_at ?? ''
        const bu = b.updated_at ?? b.created_at ?? ''
        return new Date(au).getTime() - new Date(bu).getTime()
      }
      case 'phrase_asc':
        return (a.phrase ?? '').localeCompare(b.phrase ?? '', 'ja', { sensitivity: 'base' })
      case 'phrase_desc':
        return (b.phrase ?? '').localeCompare(a.phrase ?? '', 'ja', { sensitivity: 'base' })
      case 'category_asc': {
        const order = { NG: 0, ALLOW: 1 } as const
        return order[a.category] - order[b.category]
      }
      case 'category_desc': {
        const order = { NG: 0, ALLOW: 1 } as const
        return order[b.category] - order[a.category]
      }
      default:
        return 0
    }
  })
}