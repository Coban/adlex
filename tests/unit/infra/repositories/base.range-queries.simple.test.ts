import { describe, it, expect, vi } from 'vitest'

import { SupabaseBaseRepository } from '@/infra/repositories/base'

// SupabaseBaseRepositoryの private applyFilters メソッドをテストするため
// 一時的にプロトタイプを拡張してテスト用に公開
class TestRepository extends SupabaseBaseRepository<{ id: number; name: string; created_at: string }> {
  constructor() {
    // @ts-ignore - テスト用なのでSupabaseクライアントをnullで初期化
    super(null, 'checks')
  }

  // テスト用にapplyFiltersメソッドを公開
  public testApplyFilters(query: any, filters: Record<string, any>): any {
    // @ts-ignore - private メソッドにアクセス
    return this.applyFilters(query, filters)
  }
}

describe('SupabaseBaseRepository Range Query Filters', () => {
  describe('applyFilters method', () => {
    it('should apply gte operator correctly', () => {
      const repository = new TestRepository()
      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        like: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis()
      }

      const filters = {
        created_at: {
          operator: 'gte',
          value: '2023-01-01T00:00:00.000Z'
        }
      }

      repository.testApplyFilters(mockQuery, filters)

      expect(mockQuery.gte).toHaveBeenCalledWith('created_at', '2023-01-01T00:00:00.000Z')
      expect(mockQuery.eq).not.toHaveBeenCalled()
    })

    it('should apply gt operator correctly', () => {
      const repository = new TestRepository()
      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        like: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis()
      }

      const filters = {
        created_at: {
          operator: 'gt',
          value: '2023-01-01T00:00:00.000Z'
        }
      }

      repository.testApplyFilters(mockQuery, filters)

      expect(mockQuery.gt).toHaveBeenCalledWith('created_at', '2023-01-01T00:00:00.000Z')
    })

    it('should apply like operator correctly', () => {
      const repository = new TestRepository()
      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        like: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis()
      }

      const filters = {
        name: {
          operator: 'like',
          value: '%test%'
        }
      }

      repository.testApplyFilters(mockQuery, filters)

      expect(mockQuery.like).toHaveBeenCalledWith('name', '%test%')
    })

    it('should maintain backward compatibility with simple equality', () => {
      const repository = new TestRepository()
      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        like: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis()
      }

      const filters = {
        id: 1,
        name: 'test'
      }

      repository.testApplyFilters(mockQuery, filters)

      expect(mockQuery.eq).toHaveBeenCalledWith('id', 1)
      expect(mockQuery.eq).toHaveBeenCalledWith('name', 'test')
    })

    it('should combine range and equality filters', () => {
      const repository = new TestRepository()
      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        like: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis()
      }

      const filters = {
        id: 1,
        created_at: {
          operator: 'gte',
          value: '2023-01-01T00:00:00.000Z'
        }
      }

      repository.testApplyFilters(mockQuery, filters)

      expect(mockQuery.eq).toHaveBeenCalledWith('id', 1)
      expect(mockQuery.gte).toHaveBeenCalledWith('created_at', '2023-01-01T00:00:00.000Z')
    })

    it('should fallback to eq for unknown operators', () => {
      const repository = new TestRepository()
      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        like: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis()
      }

      const filters = {
        name: {
          operator: 'unknown',
          value: 'test'
        }
      }

      repository.testApplyFilters(mockQuery, filters)

      expect(mockQuery.eq).toHaveBeenCalledWith('name', 'test')
    })

    it('should skip undefined values', () => {
      const repository = new TestRepository()
      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        like: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis()
      }

      const filters = {
        id: 1,
        name: undefined,
        created_at: {
          operator: 'gte',
          value: '2023-01-01T00:00:00.000Z'
        }
      }

      repository.testApplyFilters(mockQuery, filters)

      expect(mockQuery.eq).toHaveBeenCalledWith('id', 1)
      expect(mockQuery.eq).toHaveBeenCalledTimes(1) // nameは無視される
      expect(mockQuery.gte).toHaveBeenCalledWith('created_at', '2023-01-01T00:00:00.000Z')
    })
  })
})