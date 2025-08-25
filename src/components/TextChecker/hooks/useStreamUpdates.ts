/**
 * TextChecker SSEストリーム更新管理Hook
 * Server-Sent Eventsによるリアルタイム更新を管理
 */

import { useEffect, useRef, useCallback } from 'react'

import { TIMEOUTS } from '@/constants/timeouts'
import { authFetch } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { ssePool } from '@/lib/sse-pool'
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
  activeCheckId: _activeCheckId,
  updateCheck,
  setQueueStatus,
  setOrganizationStatus,
  setSystemStatus,
  setDictionaryInfo: _setDictionaryInfo
}: UseStreamUpdatesProps): UseStreamUpdatesReturn {
  // 一意なHook識別子（接続プール管理用）
  const hookId = useRef(`textchecker-${Date.now()}-${Math.random()}`).current
  const globalStreamUrl = useRef<string>('/api/checks/stream').current
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

  // グローバルSSE接続を開始（キューステータス監視用・プール管理版）
  const startGlobalStream = useCallback(() => {
    // 既存の接続を解除
    ssePool.unsubscribe(globalStreamUrl, hookId)

    const timer = setTimeout(() => {
      try {
        // プール管理されたEventSourceを取得
        const eventSource = ssePool.getConnection(globalStreamUrl, hookId)
        
        // 既存のイベントリスナーをクリーンアップ（重複登録を防止）
        const existingHandler = eventSource.onmessage
        if (existingHandler) {
          eventSource.removeEventListener('message', existingHandler)
        }
        
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
            logger.error('Failed to parse global SSE data', {
              hookId,
              error: error instanceof Error ? error.message : 'Unknown error',
              eventData: event.data
            })
          }
        }

        logger.debug('Global SSE stream started', {
          hookId,
          url: globalStreamUrl,
          poolStats: ssePool.getStats()
        })
        
      } catch (error) {
        logger.error('Failed to start global SSE stream', {
          hookId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }, TIMEOUTS.DEBOUNCE_INPUT)

    return () => {
      clearTimeout(timer)
      ssePool.unsubscribe(globalStreamUrl, hookId)
    }
  }, [hookId, setQueueStatus, setOrganizationStatus, setSystemStatus])

  // グローバルSSE接続を停止（プール管理版）
  const stopGlobalStream = useCallback(() => {
    ssePool.unsubscribe(globalStreamUrl, hookId)
    logger.debug('Global SSE stream stopped', {
      hookId,
      url: globalStreamUrl
    })
  }, [hookId])

  // 個別チェック用SSE接続を開始（プール管理版）
  const startCheckStream = useCallback(async (checkId: string, dbCheckId: string) => {
    const checkStreamUrl = `/api/checks/${dbCheckId}/stream`
    const checkSubscriberId = `${hookId}-check-${checkId}`
    
    const eventSource = ssePool.getConnection(checkStreamUrl, checkSubscriberId)
    
    try {
      // コントローラーを登録（ポーリングとタイムアウトのダミー値を設定）
      const pollInterval = setInterval(() => {}, 1000)
      const timeout = setTimeout(() => {}, 30000)
      
      cancelControllers.current.set(checkId, {
        eventSource,
        pollInterval,
        timeout
      })
      
      logger.debug('Check SSE stream started', {
        checkId,
        dbCheckId,
        hookId,
        url: checkStreamUrl
      })
    } catch (error) {
      logger.error('Failed to start check SSE stream', {
        checkId,
        dbCheckId,
        hookId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
    
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
        
        // プール管理された接続から購読を解除
        const checkStreamUrl = `/api/checks/${data.id}/stream`
        const checkSubscriberId = `${hookId}-check-${checkId}`
        ssePool.unsubscribe(checkStreamUrl, checkSubscriberId)
        
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
        
        logger.debug('Check completed via SSE', {
          checkId,
          hookId,
          violationsCount: mappedViolations.length
        })
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

  // チェックをキャンセル（プール管理版）
  const cancelCheck = useCallback(async (checkId: string) => {
    const controllers = cancelControllers.current.get(checkId)
    
    if (controllers) {
      // ポーリングとタイムアウトを停止
      clearInterval(controllers.pollInterval)
      clearTimeout(controllers.timeout)
      cancelControllers.current.delete(checkId)

      // プール管理された接続から購読を解除
      const dbCheckId = checkId.split('-').pop()
      if (dbCheckId && !isNaN(Number(dbCheckId))) {
        const checkStreamUrl = `/api/checks/${dbCheckId}/stream`
        const checkSubscriberId = `${hookId}-check-${checkId}`
        ssePool.unsubscribe(checkStreamUrl, checkSubscriberId)
        
        // サーバーサイドでのキャンセル処理
        try {
          await authFetch(`/api/checks/${dbCheckId}/cancel`, {
            method: 'POST',
            credentials: 'same-origin'
          })
        } catch (error) {
          logger.error('Failed to cancel check on server', {
            checkId,
            dbCheckId,
            hookId,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    }

    // 常に状態を更新（コントローラーの有無に関わらず）
    updateCheck(checkId, {
      status: 'cancelled',
      statusMessage: 'チェックがキャンセルされました'
    })
    
    logger.debug('Check cancelled', {
      checkId,
      hookId
    })
  }, [updateCheck, hookId])

  // 個別チェック用SSE接続を停止
  const stopCheckStream = useCallback((checkId: string) => {
    cancelCheck(checkId)
  }, [cancelCheck])

  // コンポーネントアンマウント時のクリーンアップ
  useEffect(() => {
    const controllers = cancelControllers.current
    return () => {
      stopGlobalStream()
      // 全ての個別ストリームを停止
      controllers.forEach((_, checkId) => {
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