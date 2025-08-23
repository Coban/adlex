import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useStreamUpdates } from '@/components/TextChecker/hooks/useStreamUpdates'
import type { UseCheckStateReturn } from '@/components/TextChecker/hooks/useCheckState'

// Supabase クライアントのモック
const mockSupabaseClient = {}
vi.mock('@/infra/supabase/clientClient', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}))

// logger のモック
vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}))

// EventSource のモック
const mockEventSource = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  dispatchEvent: vi.fn(),
  onerror: null,
  onmessage: null,
  onopen: null,
  readyState: 1,
  url: '',
  withCredentials: false,
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2
}

const EventSourceConstructor = vi.fn(() => mockEventSource) as unknown as {
  new (url: string | URL, eventSourceInitDict?: EventSourceInit): EventSource
  readonly CONNECTING: 0
  readonly OPEN: 1
  readonly CLOSED: 2
  prototype: EventSource
}

Object.defineProperty(EventSourceConstructor, 'CONNECTING', { value: 0, writable: false })
Object.defineProperty(EventSourceConstructor, 'OPEN', { value: 1, writable: false })
Object.defineProperty(EventSourceConstructor, 'CLOSED', { value: 2, writable: false })

global.EventSource = EventSourceConstructor

// fetch のモック
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useStreamUpdates', () => {
  const mockUpdateCheck = vi.fn()
  const mockSetQueueStatus = vi.fn()
  const mockSetOrganizationStatus = vi.fn()
  const mockSetSystemStatus = vi.fn()
  const mockSetDictionaryInfo = vi.fn()

  const defaultProps = {
    activeCheckId: 'check-123',
    updateCheck: mockUpdateCheck,
    setQueueStatus: mockSetQueueStatus,
    setOrganizationStatus: mockSetOrganizationStatus,
    setSystemStatus: mockSetSystemStatus,
    setDictionaryInfo: mockSetDictionaryInfo
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  describe('グローバルストリーム管理', () => {
    it('グローバルストリームを開始できること', async () => {
      const { result } = renderHook(() => useStreamUpdates(defaultProps))

      act(() => {
        result.current.startGlobalStream()
      })

      // デバウンス時間を進める
      act(() => {
        vi.advanceTimersByTime(300)
      })

      await act(async () => {
        // EventSource が作成されることを確認
        expect(EventSourceConstructor).toHaveBeenCalledWith('/api/checks/stream')
      })
    })

    it('グローバルストリームを停止できること', () => {
      const { result } = renderHook(() => useStreamUpdates(defaultProps))

      act(() => {
        result.current.startGlobalStream()
        vi.advanceTimersByTime(300)
      })

      act(() => {
        result.current.stopGlobalStream()
      })

      expect(mockEventSource.close).toHaveBeenCalled()
    })

    it('キューステータスメッセージを正しく処理できること', async () => {
      const { result } = renderHook(() => useStreamUpdates(defaultProps))

      act(() => {
        result.current.startGlobalStream()
        vi.advanceTimersByTime(300)
      })

      const mockQueueData = {
        type: 'queue_status',
        queue: { pending: 2, processing: 1 },
        organization: { limit: 1000, used: 150 },
        system: { healthy: true }
      }

      // onmessage イベントをシミュレート
      act(() => {
        const onMessageHandler = mockEventSource.addEventListener.mock.calls
          .find(call => call[0] === 'message')?.[1]
        
        if (!onMessageHandler) {
          // 直接 onmessage を呼び出す
          const messageEvent = new MessageEvent('message', {
            data: JSON.stringify(mockQueueData)
          })
          if (mockEventSource.onmessage) {
            mockEventSource.onmessage(messageEvent)
          }
        }
      })

      expect(mockSetQueueStatus).toHaveBeenCalledWith(mockQueueData.queue)
      expect(mockSetOrganizationStatus).toHaveBeenCalledWith(mockQueueData.organization)
      expect(mockSetSystemStatus).toHaveBeenCalledWith(mockQueueData.system)
    })

    it('ハートビートメッセージを適切にスキップすること', async () => {
      const { result } = renderHook(() => useStreamUpdates(defaultProps))

      act(() => {
        result.current.startGlobalStream()
        vi.advanceTimersByTime(300)
      })

      // ハートビートメッセージをシミュレート
      act(() => {
        const messageEvent = new MessageEvent('message', {
          data: ': heartbeat'
        })
        if (mockEventSource.onmessage) {
          mockEventSource.onmessage(messageEvent)
        }
      })

      expect(mockSetQueueStatus).not.toHaveBeenCalled()
    })
  })

  describe('個別チェックストリーム管理', () => {
    it('チェックストリームを開始できること', async () => {
      const { result } = renderHook(() => useStreamUpdates(defaultProps))

      await act(async () => {
        const eventSource = await result.current.startCheckStream('check-123', 'db-456')
        expect(eventSource).toBeDefined()
        expect(EventSourceConstructor).toHaveBeenCalledWith('/api/checks/db-456/stream')
      })
    })

    it('progressイベントを正しく処理できること', async () => {
      const { result } = renderHook(() => useStreamUpdates(defaultProps))

      await act(async () => {
        await result.current.startCheckStream('check-123', 'db-456')
      })

      const progressData = {
        ocr_status: 'processing'
      }

      // progress イベントをシミュレート
      act(() => {
        const addEventListener = mockEventSource.addEventListener
        const progressHandler = addEventListener.mock.calls
          .find(call => call[0] === 'progress')?.[1]
        
        if (progressHandler) {
          const progressEvent = new MessageEvent('progress', {
            data: JSON.stringify(progressData)
          })
          progressHandler(progressEvent)
        }
      })

      expect(mockUpdateCheck).toHaveBeenCalledWith('check-123', {
        status: 'processing',
        statusMessage: 'OCR処理中...'
      })
    })

    it('completeイベントを正しく処理できること', async () => {
      const { result } = renderHook(() => useStreamUpdates(defaultProps))

      await act(async () => {
        await result.current.startCheckStream('check-123', 'db-456')
      })

      const completeData = {
        id: 456,
        original_text: '元のテキスト',
        modified_text: '修正されたテキスト',
        status: 'completed',
        violations: [{
          id: 'v1',
          start_pos: 0,
          end_pos: 5,
          reason: 'テスト違反',
          dictionary_id: 1
        }]
      }

      // complete イベントをシミュレート
      act(() => {
        const addEventListener = mockEventSource.addEventListener
        const completeHandler = addEventListener.mock.calls
          .find(call => call[0] === 'complete')?.[1]
        
        if (completeHandler) {
          const completeEvent = new MessageEvent('complete', {
            data: JSON.stringify(completeData)
          })
          completeHandler(completeEvent)
        }
      })

      expect(mockUpdateCheck).toHaveBeenCalledWith('check-123', {
        result: {
          id: 456,
          original_text: '元のテキスト',
          modified_text: '修正されたテキスト',
          status: 'completed',
          violations: [{
            id: 'v1',
            startPos: 0,
            endPos: 5,
            reason: 'テスト違反',
            dictionary_id: 1
          }]
        },
        status: 'completed',
        statusMessage: 'チェック完了'
      })
    })

    it('errorイベントを正しく処理できること', async () => {
      const { result } = renderHook(() => useStreamUpdates(defaultProps))

      await act(async () => {
        await result.current.startCheckStream('check-123', 'db-456')
      })

      const errorData = {
        error: 'AI処理でエラーが発生しました'
      }

      // error イベントをシミュレート
      act(() => {
        const addEventListener = mockEventSource.addEventListener
        const errorHandler = addEventListener.mock.calls
          .find(call => call[0] === 'error')?.[1]
        
        if (errorHandler) {
          const errorEvent = new MessageEvent('error', {
            data: JSON.stringify(errorData)
          })
          errorHandler(errorEvent)
        }
      })

      expect(mockUpdateCheck).toHaveBeenCalledWith('check-123', {
        status: 'failed',
        statusMessage: 'エラー: AI処理でエラーが発生しました'
      })
    })
  })

  describe('cancelCheck', () => {
    it('チェックをキャンセルできること', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      const { result } = renderHook(() => useStreamUpdates(defaultProps))

      await act(async () => {
        await result.current.cancelCheck('check-123-db-456')
      })

      expect(mockUpdateCheck).toHaveBeenCalledWith('check-123-db-456', {
        status: 'cancelled',
        statusMessage: 'チェックがキャンセルされました'
      })
      expect(mockFetch).toHaveBeenCalledWith('/api/checks/456/cancel', {
        method: 'POST',
        credentials: 'same-origin'
      })
    })

    it('無効なcheckIdの場合サーバーキャンセルをスキップすること', async () => {
      const { result } = renderHook(() => useStreamUpdates(defaultProps))

      await act(async () => {
        await result.current.cancelCheck('invalid-check-id')
      })

      expect(mockUpdateCheck).toHaveBeenCalledWith('invalid-check-id', {
        status: 'cancelled',
        statusMessage: 'チェックがキャンセルされました'
      })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('サーバーキャンセルが失敗してもクライアント状態は更新されること', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useStreamUpdates(defaultProps))

      await act(async () => {
        await result.current.cancelCheck('check-123-db-456')
      })

      expect(mockUpdateCheck).toHaveBeenCalledWith('check-123-db-456', {
        status: 'cancelled',
        statusMessage: 'チェックがキャンセルされました'
      })
      expect(consoleSpy).toHaveBeenCalledWith('Failed to cancel on server:', expect.any(Error))
      
      consoleSpy.mockRestore()
    })
  })

  describe('stopCheckStream', () => {
    it('チェックストリームを停止できること', async () => {
      const { result } = renderHook(() => useStreamUpdates(defaultProps))

      await act(async () => {
        result.current.stopCheckStream('check-123')
      })

      expect(mockUpdateCheck).toHaveBeenCalledWith('check-123', {
        status: 'cancelled',
        statusMessage: 'チェックがキャンセルされました'
      })
    })
  })

  describe('クリーンアップ', () => {
    it('コンポーネントアンマウント時にストリームがクリーンアップされること', () => {
      const { unmount } = renderHook(() => useStreamUpdates(defaultProps))

      act(() => {
        unmount()
      })

      // EventSource の close が呼ばれることを期待
      // 実際のクリーンアップ処理は useEffect の return で実行される
    })
  })

  describe('safeCloseEventSource', () => {
    it('有効なEventSourceを安全にクローズできること', async () => {
      const { result } = renderHook(() => useStreamUpdates(defaultProps))

      await act(async () => {
        await result.current.startCheckStream('check-123', 'db-456')
        result.current.stopCheckStream('check-123')
      })

      expect(mockEventSource.close).toHaveBeenCalled()
    })

    it('無効なEventSourceに対してもエラーを発生させないこと', () => {
      const { result } = renderHook(() => useStreamUpdates(defaultProps))

      // null や undefined を渡してもエラーが発生しないことを確認
      act(() => {
        result.current.stopCheckStream('non-existent')
      })

      // エラーが発生しないことを確認（テストが完了すれば成功）
    })
  })

  describe('JSON パースエラー処理', () => {
    it('無効なJSONメッセージを適切に処理すること', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { result } = renderHook(() => useStreamUpdates(defaultProps))

      act(() => {
        result.current.startGlobalStream()
        vi.advanceTimersByTime(300)
      })

      // 無効なJSONメッセージをシミュレート
      act(() => {
        const messageEvent = new MessageEvent('message', {
          data: 'invalid json'
        })
        if (mockEventSource.onmessage) {
          mockEventSource.onmessage(messageEvent)
        }
      })

      expect(consoleSpy).toHaveBeenCalledWith('Failed to parse global SSE data:', expect.any(Error))
      
      consoleSpy.mockRestore()
    })
  })

  describe('タイムアウト処理', () => {
    it('デバウンス遅延後にEventSourceが作成されること', () => {
      const { result } = renderHook(() => useStreamUpdates(defaultProps))

      act(() => {
        result.current.startGlobalStream()
      })

      // まだEventSourceは作成されていない
      expect(EventSourceConstructor).not.toHaveBeenCalled()

      // デバウンス時間を進める
      act(() => {
        vi.advanceTimersByTime(300)
      })

      // EventSourceが作成される
      expect(EventSourceConstructor).toHaveBeenCalledWith('/api/checks/stream')
    })
  })
})