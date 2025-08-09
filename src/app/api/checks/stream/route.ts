import { NextRequest } from 'next/server'

import { queueManager } from '@/lib/queue-manager'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'

// キュー状況とチェック進捗を統合配信するSSEエンドポイント
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // 認証チェック
  const authResult = await supabase.auth.getUser()
  const user = authResult.data.user
  const authError = authResult.error
  
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // ユーザー組織情報を取得
  const { data: userProfile } = await supabase
    .from('users')
    .select('id, organization_id, role')
    .eq('id', user.id)
    .single()

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

      // キュー状況データを取得して送信する関数
      const sendQueueStatus = async () => {
        try {
          // キューマネージャーから現在の状況を取得
          const queueStatus = queueManager.getStatus()
          
          // データベースから処理中のチェック数を取得（より正確な情報）
          const { data: processingChecks } = await supabase
            .from('checks')
            .select('id, status, created_at, input_type')
            .in('status', ['pending', 'processing'])
            .order('created_at', { ascending: true })

          // 組織の使用制限情報を取得
          const { data: organizationData } = await supabase
            .from('organizations')
            .select('max_checks, used_checks')
            .eq('id', userProfile.organization_id ?? 0)
            .single()

          // 処理タイプ別の統計
          const processingStats = {
            text: processingChecks?.filter(c => c.input_type === 'text' || !c.input_type).length ?? 0,
            image: processingChecks?.filter(c => c.input_type === 'image').length ?? 0
          }

          const queueData = {
            type: 'queue_status',
            timestamp: new Date().toISOString(),
            queue: {
              queueLength: queueStatus.queueLength,
              processingCount: queueStatus.processingCount,
              maxConcurrent: queueStatus.maxConcurrent,
              databaseProcessingCount: processingChecks?.length ?? 0,
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
            controller.enqueue(new TextEncoder().encode(`data: ${queueDataStr}\n\n`))
            lastQueueStatus = queueDataStr
          }
        } catch (error) {
          console.error('[SSE] Error sending queue status:', error)
        }
      }

      // 初期キュー状況を送信
      sendQueueStatus()

      // 定期的にキュー状況をチェック（5秒間隔）
      const queueCheckInterval = setInterval(sendQueueStatus, 5000)

      // ハートビート（30秒間隔）
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(`: heartbeat\n\n`))
        } catch (error) {
          console.error('[SSE] Heartbeat error:', error)
          clearInterval(heartbeatInterval)
          clearInterval(queueCheckInterval)
        }
      }, 30000)

      // Supabaseリアルタイム購読（checksテーブルの変更を監視）
      const channel = supabase.channel('checks-updates')
      
      channel
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'checks' 
        }, async (payload) => {
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
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(progressData)}\n\n`))
          }

          // キュー状況も更新（チェック数に変動があるため）
          await sendQueueStatus()
        })
        .subscribe((status, err) => {
          if (err) {
            console.error('[SSE] Subscription error:', err)
            cleanup()
          } else if (status === 'SUBSCRIBED') {
            // Successfully subscribed to checks updates
          }
        })

      // クリーンアップ関数
      const cleanup = () => {
        // Cleaning up SSE resources
        clearInterval(heartbeatInterval)
        clearInterval(queueCheckInterval)
        channel.unsubscribe()
        try { controller.close() } catch { /* already closed */ }
      }
      
      // クライアント切断時のクリーンアップ
      request.signal.addEventListener('abort', cleanup)
      
      // 安全対策: 10分後の強制クリーンアップ
      setTimeout(cleanup, 600000)
    }
  })

  return new Response(stream, { headers })
}