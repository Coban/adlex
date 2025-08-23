/**
 * TextChecker SSEストリーム更新管理Hook
 * Server-Sent Eventsによるリアルタイム更新を管理
 */

import { useEffect, useRef, useCallback } from 'react'

import { TIMEOUTS } from '@/constants/timeouts'
import { createClient } from '@/infra/supabase/clientClient'
import { logger } from '@/lib/logger'
import { CheckStreamData, QueueStatus, OrganizationStatus, SystemStatus } from '@/types'

import type { UseCheckStateReturn } from './useCheckState'

interface UseStreamUpdatesProps {
  activeCheckId: string | null
  updateCheck: UseCheckStateReturn['updateCheck']
  setQueueStatus: (status: QueueStatus) => void
  setOrganizationStatus: (status: OrganizationStatus) => void
  setSystemStatus: (status: SystemStatus) => void
  setDictionaryInfo: React.Dispatch<React.SetStateAction<{ [key: number]: { phrase: string; category: 'NG' | 'ALLOW'; notes: string | null } }>>
}

export interface UseStreamUpdatesReturn {
  // グローバルSSE接続管理
  startGlobalStream: () => void
  stopGlobalStream: () => void
  
  // 個別チェック用SSE接続管理
  startCheckStream: (checkId: string, dbCheckId: string) => Promise<EventSource>
  stopCheckStream: (checkId: string) => void
  
  // キャンセル機能
  cancelCheck: (checkId: string) => void
}

export function useStreamUpdates({
  activeCheckId,
  updateCheck,
  setQueueStatus,
  setOrganizationStatus,
  setSystemStatus,
  setDictionaryInfo
}: UseStreamUpdatesProps): UseStreamUpdatesReturn {
  const supabase = createClient()
  const globalStreamRef = useRef<EventSource | null>(null)
  const cancelControllers = useRef<Map<string, { 
    eventSource: EventSource
    pollInterval: NodeJS.Timeout
    timeout: NodeJS.Timeout 
  }>>(new Map())

  // EventSource を安全にクローズするユーティリティ
  const safeCloseEventSource = useCallback((source: EventSource | null | undefined) => {
    try {
      const maybeClose = (source as unknown as { close?: unknown })?.close
      if (typeof maybeClose === 'function') {
        maybeClose.call(source)
      }
    } catch (error) {
      logger.warn('EventSource cleanup failed', {
        operation: 'safeCloseEventSource',
        error: error instanceof Error ? error.message : 'Unknown error',
        readyState: source instanceof EventSource ? source.readyState : 'N/A'
      })
    }
  }, [])

  // グローバルSSE接続を開始（キューステータス監視用）
  const startGlobalStream = useCallback(() => {
    if (globalStreamRef.current) {
      safeCloseEventSource(globalStreamRef.current)
    }

    const timer = setTimeout(() => {
      const connectGlobalSSE = async () => new EventSource('/api/checks/stream')
      connectGlobalSSE().then((eventSource) => {
        globalStreamRef.current = eventSource
        
        eventSource.onmessage = (event) => {
          try {
            // ハートビートメッセージをスキップ
            if (event.data.startsWith(': heartbeat')) {
              return
            }

            const data = JSON.parse(event.data)

            if (data.type === 'queue_status') {
              // キュー状況の更新
              setQueueStatus(data.queue)
              setOrganizationStatus(data.organization)
              setSystemStatus(data.system)
            }
          } catch (error) {
            console.error('Failed to parse global SSE data:', error)
          }
        }

        eventSource.onerror = (error) => {
          console.error('Global SSE connection error:', error)
          globalStreamRef.current = null
        }
      })
    }, TIMEOUTS.DEBOUNCE_INPUT)

    return () => {
      clearTimeout(timer)
      if (globalStreamRef.current) {
        safeCloseEventSource(globalStreamRef.current)
      }
      globalStreamRef.current = null
    }
  }, [safeCloseEventSource, setQueueStatus, setOrganizationStatus, setSystemStatus])

  // グローバルSSE接続を停止
  const stopGlobalStream = useCallback(() => {
    if (globalStreamRef.current) {
      safeCloseEventSource(globalStreamRef.current)
      globalStreamRef.current = null
    }
  }, [safeCloseEventSource])

  // 個別チェック用SSE接続を開始
  const startCheckStream = useCallback(async (checkId: string, dbCheckId: string) => {
    const eventSource = new EventSource(`/api/checks/${dbCheckId}/stream`)
    
    // progress イベントリスナー
    eventSource.addEventListener('progress', (event) => {
      try {
        const data: CheckStreamData = JSON.parse(event.data)
        updateCheck(checkId, {
          status: 'processing',
          statusMessage: data.ocr_status === 'processing' 
            ? 'OCR処理中...' 
            : '薬機法違反の検出と修正を実行中...'
        })
      } catch (error) {
        console.error('Failed to parse progress event:', error, event.data)
      }
    })
    
    // complete イベントリスナー  
    eventSource.addEventListener('complete', (event) => {
      try {
        const data: CheckStreamData = JSON.parse(event.data)
        
        // キャンセル制御をクリーンアップ
        const controllers = cancelControllers.current.get(checkId)
        if (controllers) {
          clearInterval(controllers.pollInterval)
          clearTimeout(controllers.timeout)
          cancelControllers.current.delete(checkId)
        }
        
        // 違反情報をマップ
        const mappedViolations = data.violations?.map((v) => ({
          id: v.id,
          startPos: v.start_pos,
          endPos: v.end_pos,
          reason: v.reason,
          dictionary_id: v.dictionary_id ?? undefined
        })) ?? []
        
        const checkResult = {
          id: data.id ?? 0,
          original_text: data.original_text ?? '',
          modified_text: data.modified_text ?? '',
          status: data.status ?? 'completed',
          violations: mappedViolations
        }
        
        updateCheck(checkId, {
          result: checkResult,
          status: 'completed',
          statusMessage: 'チェック完了'
        })
        
        safeCloseEventSource(eventSource)
      } catch (error) {
        console.error('Failed to parse complete event:', error)
      }
    })
    
    // error イベントリスナー
    eventSource.addEventListener('error', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        const controllers = cancelControllers.current.get(checkId)
        if (controllers) {
          clearInterval(controllers.pollInterval)
          clearTimeout(controllers.timeout)
          cancelControllers.current.delete(checkId)
        }
        
        const errorMessage = data.error ?? 'チェック処理が失敗しました'
        console.error('Check failed via SSE error event:', errorMessage)
        
        updateCheck(checkId, {
          status: 'failed',
          statusMessage: `エラー: ${errorMessage}`
        })
        
        safeCloseEventSource(eventSource)
      } catch (error) {
        console.error('Failed to parse error event:', error)
      }
    })

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error)
      updateCheck(checkId, {
        statusMessage: 'SSE接続に失敗しました。ポーリングで結果の取得を継続します…'
      })
    }

    return eventSource
  }, [updateCheck, safeCloseEventSource])

  // チェックをキャンセル
  const cancelCheck = useCallback(async (checkId: string) => {
    const controllers = cancelControllers.current.get(checkId)
    if (controllers) {
      // EventSource とポーリングを停止
      safeCloseEventSource(controllers.eventSource)
      clearInterval(controllers.pollInterval)
      clearTimeout(controllers.timeout)
      cancelControllers.current.delete(checkId)

      // 状態を更新
      updateCheck(checkId, {
        status: 'cancelled',
        statusMessage: 'チェックがキャンセルされました'
      })

      // サーバーサイドでのキャンセル処理
      try {
        const dbCheckId = checkId.split('-').pop()
        if (dbCheckId && !isNaN(Number(dbCheckId))) {
          await fetch(`/api/checks/${dbCheckId}/cancel`, {
            method: 'POST',
            credentials: 'same-origin'
          })
        }
      } catch (error) {
        console.error('Failed to cancel on server:', error)
      }
    }
  }, [updateCheck, safeCloseEventSource])

  // 個別チェック用SSE接続を停止
  const stopCheckStream = useCallback((checkId: string) => {
    cancelCheck(checkId)
  }, [cancelCheck])

  // コンポーネントアンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      stopGlobalStream()
      // 全ての個別ストリームを停止
      cancelControllers.current.forEach((_, checkId) => {
        cancelCheck(checkId)
      })
    }
  }, [stopGlobalStream, cancelCheck])

  return {
    startGlobalStream,
    stopGlobalStream,
    startCheckStream,
    stopCheckStream,
    cancelCheck
  }
}