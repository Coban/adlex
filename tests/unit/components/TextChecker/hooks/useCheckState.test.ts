import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useCheckState } from '@/components/TextChecker/hooks/useCheckState'
import { CheckItem } from '@/types'

describe('useCheckState', () => {
  const mockCheckItem: CheckItem = {
    id: 'check-123',
    originalText: 'テストテキスト',
    status: 'queued',
    statusMessage: '処理待ち',
    timestamp: Date.now(),
    result: null
  }

  const mockCompletedCheckItem: CheckItem = {
    id: 'check-456',
    originalText: '元のテキスト',
    status: 'completed',
    statusMessage: '完了',
    timestamp: Date.now(),
    result: {
      id: 456,
      original_text: '元のテキスト',
      modified_text: '修正されたテキスト',
      status: 'completed',
      violations: []
    }
  }

  beforeEach(() => {
    // 各テスト前にクリーンアップ
  })

  describe('初期状態', () => {
    it('初期値が正しく設定されていること', () => {
      const { result } = renderHook(() => useCheckState())

      expect(result.current.checks).toEqual([])
      expect(result.current.activeCheckId).toBe(null)
      expect(result.current.text).toBe('')
      expect(result.current.activeCheck).toBe(null)
      expect(result.current.hasActiveCheck).toBe(false)
    })
  })

  describe('テキスト管理', () => {
    it('テキストを設定できること', () => {
      const { result } = renderHook(() => useCheckState())

      act(() => {
        result.current.setText('新しいテキスト')
      })

      expect(result.current.text).toBe('新しいテキスト')
    })
  })

  describe('チェック追加', () => {
    it('新しいチェックを追加できること', () => {
      const { result } = renderHook(() => useCheckState())

      act(() => {
        result.current.addCheck(mockCheckItem)
      })

      expect(result.current.checks).toHaveLength(1)
      expect(result.current.checks[0]).toEqual(mockCheckItem)
      expect(result.current.activeCheckId).toBe('check-123')
    })

    it('複数のチェックを追加できること', () => {
      const { result } = renderHook(() => useCheckState())

      act(() => {
        result.current.addCheck(mockCheckItem)
        result.current.addCheck(mockCompletedCheckItem)
      })

      expect(result.current.checks).toHaveLength(2)
      expect(result.current.activeCheckId).toBe('check-456') // 最後に追加されたものがアクティブ
    })
  })

  describe('チェック更新', () => {
    it('既存のチェックを更新できること', () => {
      const { result } = renderHook(() => useCheckState())

      act(() => {
        result.current.addCheck(mockCheckItem)
      })

      act(() => {
        result.current.updateCheck('check-123', {
          status: 'processing',
          statusMessage: '処理中...'
        })
      })

      expect(result.current.checks[0].status).toBe('processing')
      expect(result.current.checks[0].statusMessage).toBe('処理中...')
      expect(result.current.checks[0].id).toBe('check-123') // 他のプロパティは保持
    })

    it('存在しないチェックIDの更新は無視されること', () => {
      const { result } = renderHook(() => useCheckState())

      act(() => {
        result.current.addCheck(mockCheckItem)
      })

      act(() => {
        result.current.updateCheck('non-existent', {
          status: 'completed'
        })
      })

      expect(result.current.checks).toHaveLength(1)
      expect(result.current.checks[0]).toEqual(mockCheckItem) // 変更されない
    })

    it('resultを含む更新ができること', () => {
      const { result } = renderHook(() => useCheckState())

      act(() => {
        result.current.addCheck(mockCheckItem)
      })

      const mockResult = {
        id: 123,
        original_text: '元のテキスト',
        modified_text: '修正されたテキスト',
        status: 'completed' as const,
        violations: []
      }

      act(() => {
        result.current.updateCheck('check-123', {
          result: mockResult,
          status: 'completed'
        })
      })

      expect(result.current.checks[0].result).toEqual(mockResult)
      expect(result.current.checks[0].status).toBe('completed')
    })
  })

  describe('チェック削除', () => {
    it('指定されたチェックを削除できること', () => {
      const { result } = renderHook(() => useCheckState())

      act(() => {
        result.current.addCheck(mockCheckItem)
        result.current.addCheck(mockCompletedCheckItem)
      })

      act(() => {
        result.current.removeCheck('check-123')
      })

      expect(result.current.checks).toHaveLength(1)
      expect(result.current.checks[0].id).toBe('check-456')
    })

    it('アクティブチェックを削除した場合activeCheckIdがnullになること', () => {
      const { result } = renderHook(() => useCheckState())

      act(() => {
        result.current.addCheck(mockCheckItem)
      })

      expect(result.current.activeCheckId).toBe('check-123')

      act(() => {
        result.current.removeCheck('check-123')
      })

      expect(result.current.activeCheckId).toBe(null)
      expect(result.current.checks).toHaveLength(0)
    })

    it('アクティブでないチェックを削除してもactiveCheckIdは保持されること', () => {
      const { result } = renderHook(() => useCheckState())

      act(() => {
        result.current.addCheck(mockCheckItem)
        result.current.addCheck(mockCompletedCheckItem)
      })

      expect(result.current.activeCheckId).toBe('check-456')

      act(() => {
        result.current.removeCheck('check-123')
      })

      expect(result.current.activeCheckId).toBe('check-456')
      expect(result.current.checks).toHaveLength(1)
    })
  })

  describe('全チェッククリア', () => {
    it('全てのチェックをクリアできること', () => {
      const { result } = renderHook(() => useCheckState())

      act(() => {
        result.current.addCheck(mockCheckItem)
        result.current.addCheck(mockCompletedCheckItem)
      })

      act(() => {
        result.current.clearAllChecks()
      })

      expect(result.current.checks).toEqual([])
      expect(result.current.activeCheckId).toBe(null)
    })
  })

  describe('activeCheck computed property', () => {
    it('activeCheckIdに対応するチェックを取得できること', () => {
      const { result } = renderHook(() => useCheckState())

      act(() => {
        result.current.addCheck(mockCheckItem)
        result.current.addCheck(mockCompletedCheckItem)
        result.current.setActiveCheckId('check-123')
      })

      expect(result.current.activeCheck).toEqual(mockCheckItem)
    })

    it('activeCheckIdがnullの場合nullを返すこと', () => {
      const { result } = renderHook(() => useCheckState())

      act(() => {
        result.current.addCheck(mockCheckItem)
        result.current.setActiveCheckId(null)
      })

      expect(result.current.activeCheck).toBe(null)
    })

    it('存在しないactiveCheckIdの場合nullを返すこと', () => {
      const { result } = renderHook(() => useCheckState())

      act(() => {
        result.current.addCheck(mockCheckItem)
        result.current.setActiveCheckId('non-existent')
      })

      expect(result.current.activeCheck).toBe(null)
    })
  })

  describe('hasActiveCheck computed property', () => {
    it('結果を持つアクティブチェックがある場合trueを返すこと', () => {
      const { result } = renderHook(() => useCheckState())

      act(() => {
        result.current.addCheck(mockCompletedCheckItem)
        result.current.setActiveCheckId('check-456')
      })

      expect(result.current.hasActiveCheck).toBe(true)
    })

    it('結果を持たないアクティブチェックの場合falseを返すこと', () => {
      const { result } = renderHook(() => useCheckState())

      act(() => {
        result.current.addCheck(mockCheckItem) // result: null
        result.current.setActiveCheckId('check-123')
      })

      expect(result.current.hasActiveCheck).toBe(false)
    })

    it('アクティブチェックがない場合falseを返すこと', () => {
      const { result } = renderHook(() => useCheckState())

      act(() => {
        result.current.addCheck(mockCompletedCheckItem)
        result.current.setActiveCheckId(null)
      })

      expect(result.current.hasActiveCheck).toBe(false)
    })
  })

  describe('setChecks', () => {
    it('チェック配列を直接設定できること', () => {
      const { result } = renderHook(() => useCheckState())

      const newChecks = [mockCheckItem, mockCompletedCheckItem]

      act(() => {
        result.current.setChecks(newChecks)
      })

      expect(result.current.checks).toEqual(newChecks)
    })

    it('関数形式でチェック配列を更新できること', () => {
      const { result } = renderHook(() => useCheckState())

      act(() => {
        result.current.addCheck(mockCheckItem)
      })

      act(() => {
        result.current.setChecks(prev => [...prev, mockCompletedCheckItem])
      })

      expect(result.current.checks).toHaveLength(2)
      expect(result.current.checks[1]).toEqual(mockCompletedCheckItem)
    })
  })

  describe('setActiveCheckId', () => {
    it('アクティブチェックIDを直接設定できること', () => {
      const { result } = renderHook(() => useCheckState())

      act(() => {
        result.current.setActiveCheckId('check-789')
      })

      expect(result.current.activeCheckId).toBe('check-789')
    })

    it('関数形式でアクティブチェックIDを更新できること', () => {
      const { result } = renderHook(() => useCheckState())

      act(() => {
        result.current.setActiveCheckId('initial-id')
      })

      act(() => {
        result.current.setActiveCheckId(prev => `${prev}-updated`)
      })

      expect(result.current.activeCheckId).toBe('initial-id-updated')
    })
  })
})