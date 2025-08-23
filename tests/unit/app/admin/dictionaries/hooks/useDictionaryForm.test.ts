import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDictionaryForm } from '@/app/admin/dictionaries/hooks/useDictionaryForm'
import { Dictionary, Organization } from '@/app/admin/dictionaries/types'

// authFetch のモック
const { authFetch } = vi.hoisted(() => ({
  authFetch: vi.fn()
}))

vi.mock('@/lib/api-client', () => ({
  authFetch
}))

// alert のモック
const mockAlert = vi.fn()
Object.assign(window, { alert: mockAlert })

describe('useDictionaryForm', () => {
  const mockOrganization: Organization = {
    id: 1,
    name: 'テスト組織',
    created_at: '2024-01-01',
    max_users: 10,
    max_checks_per_month: 1000
  }

  const mockDictionary: Dictionary = {
    id: 1,
    phrase: 'テスト表現',
    category: 'NG',
    notes: 'テスト備考',
    organization_id: 1,
    created_at: '2024-01-01'
  }

  const mockOnSuccess = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('初期状態', () => {
    it('初期値が正しく設定されていること', () => {
      const { result } = renderHook(() => 
        useDictionaryForm(mockOrganization, null, mockOnSuccess)
      )

      expect(result.current.editingDictionary).toBe(null)
      expect(result.current.showAddForm).toBe(false)
      expect(result.current.formData).toEqual({
        phrase: '',
        category: 'NG',
        notes: ''
      })
      expect(result.current.message).toBe('')
    })
  })

  describe('フォーム操作', () => {
    it('編集開始時にフォームデータが設定されること', () => {
      const { result } = renderHook(() => 
        useDictionaryForm(mockOrganization, null, mockOnSuccess)
      )

      act(() => {
        result.current.startEdit(mockDictionary)
      })

      expect(result.current.editingDictionary).toEqual(mockDictionary)
      expect(result.current.formData).toEqual({
        phrase: 'テスト表現',
        category: 'NG',
        notes: 'テスト備考'
      })
      expect(result.current.showAddForm).toBe(false)
    })

    it('編集キャンセル時にフォームがリセットされること', () => {
      const { result } = renderHook(() => 
        useDictionaryForm(mockOrganization, null, mockOnSuccess)
      )

      act(() => {
        result.current.startEdit(mockDictionary)
      })

      act(() => {
        result.current.cancelEdit()
      })

      expect(result.current.editingDictionary).toBe(null)
      expect(result.current.formData).toEqual({
        phrase: '',
        category: 'NG',
        notes: ''
      })
    })

    it('フォームデータを更新できること', () => {
      const { result } = renderHook(() => 
        useDictionaryForm(mockOrganization, null, mockOnSuccess)
      )

      act(() => {
        result.current.setFormData({
          phrase: '新しい表現',
          category: 'ALLOW',
          notes: '新しい備考'
        })
      })

      expect(result.current.formData).toEqual({
        phrase: '新しい表現',
        category: 'ALLOW',
        notes: '新しい備考'
      })
    })

    it('追加フォームの表示状態を切り替えできること', () => {
      const { result } = renderHook(() => 
        useDictionaryForm(mockOrganization, null, mockOnSuccess)
      )

      act(() => {
        result.current.setShowAddForm(true)
      })

      expect(result.current.showAddForm).toBe(true)

      act(() => {
        result.current.setShowAddForm(false)
      })

      expect(result.current.showAddForm).toBe(false)
    })
  })

  describe('handleCreate', () => {
    it('新規作成が成功すること', async () => {
      authFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 2 })
      })

      const { result } = renderHook(() => 
        useDictionaryForm(mockOrganization, null, mockOnSuccess)
      )

      // フォームデータを設定
      act(() => {
        result.current.setFormData({
          phrase: '新しい表現',
          category: 'NG',
          notes: '新しい備考'
        })
        result.current.setShowAddForm(true)
      })

      // フォーム送信をシミュレート
      const mockEvent = { preventDefault: vi.fn() } as any

      await act(async () => {
        await result.current.handleCreate(mockEvent)
      })

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(authFetch).toHaveBeenCalledWith('/api/dictionaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phrase: '新しい表現',
          category: 'NG',
          notes: '新しい備考'
        })
      })
      expect(result.current.showAddForm).toBe(false)
      expect(result.current.formData.phrase).toBe('')
      expect(mockOnSuccess).toHaveBeenCalled()
    })

    it('空白の備考がnullとして送信されること', async () => {
      authFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 2 })
      })

      const { result } = renderHook(() => 
        useDictionaryForm(mockOrganization, null, mockOnSuccess)
      )

      act(() => {
        result.current.setFormData({
          phrase: 'テスト表現',
          category: 'NG',
          notes: '   '
        })
      })

      const mockEvent = { preventDefault: vi.fn() } as any

      await act(async () => {
        await result.current.handleCreate(mockEvent)
      })

      expect(authFetch).toHaveBeenCalledWith('/api/dictionaries', 
        expect.objectContaining({
          body: JSON.stringify({
            phrase: 'テスト表現',
            category: 'NG',
            notes: null
          })
        })
      )
    })

    it('組織が存在しない場合は何も実行されないこと', async () => {
      const { result } = renderHook(() => 
        useDictionaryForm(null, null, mockOnSuccess)
      )

      const mockEvent = { preventDefault: vi.fn() } as any

      await act(async () => {
        await result.current.handleCreate(mockEvent)
      })

      expect(authFetch).not.toHaveBeenCalled()
    })

    it('API エラーが発生した場合適切に処理されること', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      authFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Duplicate entry' })
      })

      const { result } = renderHook(() => 
        useDictionaryForm(mockOrganization, null, mockOnSuccess)
      )

      act(() => {
        result.current.setFormData({
          phrase: '重複表現',
          category: 'NG',
          notes: ''
        })
      })

      const mockEvent = { preventDefault: vi.fn() } as any

      await act(async () => {
        await result.current.handleCreate(mockEvent)
      })

      expect(mockAlert).toHaveBeenCalled()
      expect(mockOnSuccess).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('警告メッセージがある場合アラートが表示されること', async () => {
      authFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          id: 2, 
          warning: '類似する表現が既に存在します' 
        })
      })

      const { result } = renderHook(() => 
        useDictionaryForm(mockOrganization, null, mockOnSuccess)
      )

      act(() => {
        result.current.setFormData({
          phrase: '類似表現',
          category: 'NG',
          notes: ''
        })
      })

      const mockEvent = { preventDefault: vi.fn() } as any

      await act(async () => {
        await result.current.handleCreate(mockEvent)
      })

      expect(mockAlert).toHaveBeenCalledWith('類似する表現が既に存在します')
      expect(mockOnSuccess).toHaveBeenCalled()
    })
  })

  describe('handleUpdate', () => {
    it('更新が成功すること', async () => {
      authFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })

      const { result } = renderHook(() => 
        useDictionaryForm(mockOrganization, null, mockOnSuccess)
      )

      // 編集状態を設定
      act(() => {
        result.current.startEdit(mockDictionary)
        result.current.setFormData({
          phrase: '更新された表現',
          category: 'ALLOW',
          notes: '更新された備考'
        })
      })

      const mockEvent = { preventDefault: vi.fn() } as any

      await act(async () => {
        await result.current.handleUpdate(mockEvent)
      })

      expect(authFetch).toHaveBeenCalledWith('/api/dictionaries/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phrase: '更新された表現',
          category: 'ALLOW',
          notes: '更新された備考'
        })
      })
      expect(result.current.editingDictionary).toBe(null)
      expect(result.current.formData.phrase).toBe('')
      expect(mockOnSuccess).toHaveBeenCalled()
    })

    it('編集中でない場合は何も実行されないこと', async () => {
      const { result } = renderHook(() => 
        useDictionaryForm(mockOrganization, null, mockOnSuccess)
      )

      const mockEvent = { preventDefault: vi.fn() } as any

      await act(async () => {
        await result.current.handleUpdate(mockEvent)
      })

      expect(authFetch).not.toHaveBeenCalled()
    })
  })

  describe('メッセージ表示', () => {
    it('メッセージが指定時間後にクリアされること', async () => {
      authFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 2 })
      })

      const { result } = renderHook(() => 
        useDictionaryForm(mockOrganization, null, mockOnSuccess)
      )

      act(() => {
        result.current.setFormData({
          phrase: 'テスト',
          category: 'NG',
          notes: ''
        })
      })

      const mockEvent = { preventDefault: vi.fn() } as any

      await act(async () => {
        await result.current.handleCreate(mockEvent)
      })

      expect(result.current.message).toBe('辞書に追加しました')

      // 3秒後にメッセージがクリアされることを確認
      act(() => {
        vi.advanceTimersByTime(3000)
      })

      expect(result.current.message).toBe('')
    })
  })
})