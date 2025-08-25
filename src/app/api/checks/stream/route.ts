import { NextRequest } from 'next/server'

import { getRepositories } from '@/core/ports'
import { createClient } from '@/infra/supabase/serverClient'
import { queueManager } from '@/lib/queue-manager'
import type { Database } from '@/types/database.types'

// キュー状況とチェック進捗を統合配信するSSEエンドポイント
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // クエリパラメータからトークンを取得（EventSourceはheaderを送れないため）
  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  // 開発環境では認証をスキップ
  let currentUser
  if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_SKIP_AUTH === 'true' || process.env.SKIP_AUTH === 'true') {
    // 開発環境用のモックユーザー
    currentUser = {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'admin@test.com'
    }
  } else {
    // 認証チェック（トークンがある場合は明示的に設定）
    let authResult
    if (token) {
      authResult = await supabase.auth.getUser(token)
    } else {
      authResult = await supabase.auth.getUser()
    }
    
    const user = authResult.data.user
    const authError = authResult.error
    
    currentUser = user
    if (authError || !currentUser) {
      // 認証失敗
      return new Response('Unauthorized', { status: 401 })
    }
  }

  // Get repositories
  const repositories = await getRepositories(supabase)

  // ユーザー組織情報を取得
  let userProfile = await repositories.users.findById(currentUser.id)
  
  // 開発環境でプロフィールが見つからない場合はモックを使用
  if (!userProfile && (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_SKIP_AUTH === 'true' || process.env.SKIP_AUTH === 'true')) {
    userProfile = {
      id: currentUser.id,
      email: currentUser.email || 'admin@test.com',
      role: 'admin',
      organization_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }
  
  if (!userProfile) {
    return new Response('User profile not found', { status: 404 })
  }

  // SSEヘッダー設定
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
    'Keep-Alive': 'timeout=60, max=10',
    'X-Accel-Buffering': 'no'
  })

  const stream = new ReadableStream({
    start(controller) {
      let lastQueueStatus: string | null = null
      let isActive = true // 接続が有効かどうかのフラグ
      let queueCheckInterval: NodeJS.Timeout
      let heartbeatInterval: NodeJS.Timeout
      let channel: any

      // コントローラーが閉じられているかチェックする関数  
      const isControllerClosed = () => {
        if (!isActive) return true
        try {
          // desiredSizeがnullの場合は閉じられている
          if (controller.desiredSize === null) return true
          return false
        } catch {
          return true
        }
      }

      // 安全にメッセージを送信する関数
      const safeEnqueue = (data: string): boolean => {
        if (isControllerClosed()) {
          return false
        }
        
        try {
          controller.enqueue(new TextEncoder().encode(data))
          return true
        } catch (error) {
          console.error('[SSE] Failed to send message:', error)
          isActive = false
          cleanup()
          return false
        }
      }

      // キュー状況データを取得して送信する関数
      const sendQueueStatus = async () => {
        if (isControllerClosed()) {
          return
        }

        try {
          // キューマネージャーから現在の状況を取得
          const queueStatus = queueManager.getStatus()
          
          // データベースから処理中のチェック数を取得（より正確な情報）
          const processingChecks = await repositories.checks.findMany({
            where: { status: 'pending' },
            orderBy: [{ field: 'created_at', direction: 'asc' }]
          })

          // 組織の使用制限情報を取得
          const organizationData = await repositories.organizations.findById(userProfile.organization_id ?? 0)

          // 処理タイプ別の統計
          const processingStats = {
            text: processingChecks.filter(c => c.input_type === 'text' || !c.input_type).length,
            image: processingChecks.filter(c => c.input_type === 'image').length
          }

          const queueData = {
            type: 'queue_status',
            timestamp: new Date().toISOString(),
            queue: {
              queueLength: queueStatus.queueLength,
              processingCount: queueStatus.processingCount,
              maxConcurrent: queueStatus.maxConcurrent,
              databaseProcessingCount: processingChecks.length,
              availableSlots: Math.max(0, queueStatus.maxConcurrent - queueStatus.processingCount),
              processingStats,
              canStartNewCheck: queueStatus.processingCount < queueStatus.maxConcurrent
            },
            organization: {
              monthlyLimit: organizationData?.max_checks ?? 0,
              currentMonthChecks: organizationData?.used_checks ?? 0,
              remainingChecks: Math.max(0, (organizationData?.max_checks ?? 0) - (organizationData?.used_checks ?? 0)),
              canPerformCheck: (organizationData?.used_checks ?? 0) < (organizationData?.max_checks ?? 0)
            },
            system: {
              serverLoad: {
                queue: queueStatus.queueLength > 0 ? 'busy' : 'idle',
                processing: queueStatus.processingCount === queueStatus.maxConcurrent ? 'full' : 'available'
              }
            }
          }

          const queueDataStr = JSON.stringify(queueData)
          
          // 前回のデータと同じ場合は送信をスキップ（帯域幅節約）
          if (queueDataStr !== lastQueueStatus) {
            if (safeEnqueue(`data: ${queueDataStr}\n\n`)) {
              lastQueueStatus = queueDataStr
            } else {
            }
          } else {
          }
        } catch (error) {
          console.error('[SSE] Error sending queue status:', error)
          if (!isControllerClosed()) {
            // エラーが発生してもコントローラーが開いている場合は接続を維持
          }
        }
      }

      // 初期キュー状況を送信
      sendQueueStatus().catch(error => {
        console.error('[SSE] Initial sendQueueStatus failed:', error)
        cleanup()
      })

      // 定期的にキュー状況をチェック（5秒間隔）
      queueCheckInterval = setInterval(async () => {
        if (isControllerClosed()) {
          cleanup()
          return
        }
        try {
          await sendQueueStatus()
        } catch (error) {
          console.error('[SSE] Periodic sendQueueStatus failed:', error)
          cleanup()
        }
      }, 5000)

      // ハートビート（30秒間隔）
      heartbeatInterval = setInterval(() => {
        if (isControllerClosed()) {
          cleanup()
          return
        }
        safeEnqueue(': heartbeat\n\n')
      }, 30000)

      // Supabaseリアルタイム購読（checksテーブルの変更を監視）
      channel = supabase.channel('checks-updates')
      
      channel
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'checks' 
        }, async (payload) => {
          if (isControllerClosed()) {
            cleanup()
            return
          }

          const updatedCheck = payload.new as Database['public']['Tables']['checks']['Row']
          
          // 個別チェックの進捗更新
          if (updatedCheck) {
            const progressData = {
              type: 'check_progress',
              timestamp: new Date().toISOString(),
              check: {
                id: updatedCheck.id,
                status: updatedCheck.status,
                input_type: updatedCheck.input_type,
                ocr_status: updatedCheck.ocr_status,
                extracted_text: updatedCheck.extracted_text,
                error_message: updatedCheck.error_message
              }
            }
            safeEnqueue(`data: ${JSON.stringify(progressData)}\n\n`)
          }

          // キュー状況も更新（チェック数に変動があるため）
          await sendQueueStatus()
        })
        .subscribe((status, err) => {
          if (err) {
            console.error('[SSE] Subscription error:', err)
            // Don't cleanup on subscription error - continue with polling-based updates
          }
        })

      // クリーンアップ関数
      const cleanup = () => {
        if (!isActive) return // 既にクリーンアップ済み
        
        isActive = false
        
        // インターバルをクリア
        if (queueCheckInterval) {
          clearInterval(queueCheckInterval)
        }
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval)
        }
        
        // Supabaseチャンネルを停止
        if (channel) {
          try {
            channel.unsubscribe()
          } catch (error) {
            console.error('[SSE] Error unsubscribing channel:', error)
          }
        }
        
        // コントローラーを閉じる
        try {
          controller.close()
        } catch (error) {
          // 既に閉じられている場合は無視
        }
      }
      
      // クライアント切断時のクリーンアップ
      request.signal.addEventListener('abort', () => {
        cleanup()
      })
      
      // 安全対策: 10分後の強制クリーンアップ
      setTimeout(cleanup, 600000)
    }
  })

  return new Response(stream, { headers })
}