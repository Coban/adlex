import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useDictionaries } from '@/app/admin/dictionaries/hooks/useDictionaries'

// AuthContext のモック
const { useAuth } = vi.hoisted(() => ({
  useAuth: vi.fn()
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth
}))

// Supabase クライアントのモック
const { mockSupabaseClient } = vi.hoisted(() => {
  return {
    mockSupabaseClient: {
      auth: {
        getUser: vi.fn()
      },
      from: vi.fn()
    }
  }
})

vi.mock('@/infra/supabase/clientClient', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}))

// authFetch のモック
const { authFetch } = vi.hoisted(() => ({
  authFetch: vi.fn()
}))

vi.mock('@/lib/api-client', () => ({
  authFetch
}))

describe.skip('useDictionaries', () => {
  const mockOrganization = {
    id: 'org-123',
    name: 'テスト組織',
    created_at: '2024-01-01',
    max_users: 10,
    max_checks_per_month: 1000
  }

  const mockUserProfile = {
    id: 'user-123',
    email: 'admin@test.com',
    role: 'admin' as const,
    organization_id: 'org-123'
  }

  const mockDictionaries = [
    {
      id: 1,
      phrase: 'テスト表現',
      category: 'NG' as const,
      notes: 'テスト備考',
      organization_id: 'org-123',
      created_at: '2024-01-01'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    // Real timersを使用してタイムアウト問題を回避
    vi.useRealTimers()

    // デフォルトの認証状態
    useAuth.mockReturnValue({
      organization: mockOrganization,
      userProfile: mockUserProfile,
      loading: false
    })

    // Supabase クエリチェーンのモック
    const mockSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({
          data: mockDictionaries,
          error: null
        })),
        maybeSingle: vi.fn(() => Promise.resolve({
          data: mockOrganization,
          error: null
        }))
      }))
    }))

    mockSupabaseClient.from.mockReturnValue({
      select: mockSelect
    })

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null
    })
    
    // authFetch のデフォルトモック設定
    authFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({})
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('初期状態', () => {
    it('初期値が正しく設定されていること', async () => {
      const { result } = renderHook(() => useDictionaries())

      // 初期状態を確認
      expect(result.current.dictionaries).toEqual([])
      expect(result.current.fallbackOrganization).toBe(null)
      expect(result.current.loading).toBe(true)
      expect(result.current.embeddingStats).toBe(null)
      expect(result.current.embeddingRefreshLoading).toBe(false)
      expect(result.current.dictionaryStats).toBe(null)

      // state update完了を待つ
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 3000 })
    })
  })

  describe('loadDictionaries', () => {
    it('組織が存在する場合に辞書データを読み込めること', async () => {
      const { result } = renderHook(() => useDictionaries())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 5000 })

      expect(result.current.dictionaries).toEqual(mockDictionaries)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('dictionaries')
    })

    it('組織が存在しない場合にフォールバック処理が実行されること', async () => {
      useAuth.mockReturnValue({
        organization: null,
        userProfile: null,
        loading: false
      })

      // フォールバック用のSupabaseクエリモック
      const mockUserSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({
            data: { ...mockUserProfile, organization_id: 'org-123' },
            error: null
          }))
        }))
      }))

      const mockOrgSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({
            data: mockOrganization,
            error: null
          }))
        }))
      }))

      const mockDictSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({
            data: mockDictionaries,
            error: null
          }))
        }))
      }))

      mockSupabaseClient.from
        .mockReturnValueOnce({ select: mockUserSelect })
        .mockReturnValueOnce({ select: mockOrgSelect })
        .mockReturnValueOnce({ select: mockDictSelect })

      const { result } = renderHook(() => useDictionaries())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 5000 })

      expect(result.current.fallbackOrganization).toEqual(mockOrganization)
      expect(result.current.dictionaries).toEqual(mockDictionaries)
    })

    it('データベースエラーが発生した場合適切に処理されること', async () => {
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({
            data: null,
            error: new Error('Database connection failed')
          }))
        }))
      }))

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { result } = renderHook(() => useDictionaries())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 5000 })

      expect(consoleSpy).toHaveBeenCalledWith('辞書の読み込みに失敗しました:', expect.any(Error))
      
      consoleSpy.mockRestore()
    })
  })

  describe('loadEmbeddingStats', () => {
    it('管理者ユーザーの場合埋め込み統計を読み込めること', async () => {
      const mockStats = { total: 100, pending: 5 }
      authFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStats)
      })

      const { result } = renderHook(() => useDictionaries())

      await act(async () => {
        await result.current.loadEmbeddingStats()
      })

      expect(authFetch).toHaveBeenCalledWith('/api/dictionaries/embeddings/refresh', {
        method: 'GET'
      })
      expect(result.current.embeddingStats).toEqual(mockStats)
    })

    it('一般ユーザーの場合埋め込み統計を読み込まないこと', async () => {
      useAuth.mockReturnValue({
        organization: mockOrganization,
        userProfile: { ...mockUserProfile, role: 'user' },
        loading: false
      })

      const { result } = renderHook(() => useDictionaries())

      await act(async () => {
        await result.current.loadEmbeddingStats()
      })

      expect(authFetch).not.toHaveBeenCalled()
    })
  })

  describe('loadDictionaryStats', () => {
    it('管理者ユーザーの場合辞書統計を読み込めること', async () => {
      const mockStats = { totalEntries: 500, ngCount: 300, allowCount: 200 }
      
      authFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStats)
      })

      const { result } = renderHook(() => useDictionaries())

      await act(async () => {
        await result.current.loadDictionaryStats()
      })

      expect(authFetch).toHaveBeenCalledWith('/api/dictionaries/stats', {
        method: 'GET'
      })
      expect(result.current.dictionaryStats).toEqual(mockStats)
    })

    it('統計API呼び出しでエラーが発生した場合適切に処理されること', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      authFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useDictionaries())

      await act(async () => {
        await result.current.loadDictionaryStats()
      })

      expect(consoleSpy).toHaveBeenCalledWith('辞書統計の読み込みに失敗しました:', expect.any(Error))
      
      consoleSpy.mockRestore()
    })
  })

  describe('refreshData', () => {
    it('全てのデータを再読み込みできること', async () => {
      authFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ total: 100, pending: 0 })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ totalEntries: 500 })
        })

      const { result } = renderHook(() => useDictionaries())

      // 初期読み込み完了を待つ
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 5000 })

      await act(async () => {
        await result.current.refreshData()
      })

      // refreshDataは loadDictionaries, loadEmbeddingStats, loadDictionaryStats を呼ぶ
      // 初期読み込み + refreshData でSupabaseクエリは2回実行される
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('dictionaries')
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(2)
    })
  })

  describe('タイムアウト処理', () => {
    it('5秒後にローディングが自動的に終了すること', async () => {
      useAuth.mockReturnValue({
        organization: null,
        userProfile: null,
        loading: true // ローディング中
      })

      const { result } = renderHook(() => useDictionaries())

      expect(result.current.loading).toBe(true)

      // 5秒間待機してタイムアウトを確認
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 6000 })
    })
  })
})