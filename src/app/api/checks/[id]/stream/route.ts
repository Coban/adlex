import { NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database.types'

/**
 * Server-Sent Events (SSE) を使用してチェック処理の進捗をリアルタイムでストリーミングする
 * チェックの状態変更を監視し、クライアントに即座に更新を送信する
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const checkId = parseInt(id)

  if (isNaN(checkId)) {
    return new Response('Invalid check ID', { status: 400 })
  }

  const supabase = await createClient()

  // ユーザーがこのチェックにアクセス権があるかを検証
  const authResult = await supabase.auth.getUser()
  const user = authResult.data.user
  const authError = authResult.error
  
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { data: checkRecord, error: checkError } = await supabase
    .from('checks')
    .select('id, user_id, organization_id')
    .eq('id', checkId)
    .single()

  if (checkError || !checkRecord) {
    return new Response('Check not found', { status: 404 })
  }
  
  // ユーザーがこのチェックにアクセス可能かさらに検証
  const { data: userProfile } = await supabase
    .from('users')
    .select('id, organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userProfile || (userProfile.role === 'user' && checkRecord.user_id !== user.id) || (userProfile.organization_id !== checkRecord.organization_id)) {
      return new Response('Forbidden', { status: 403 })
  }


  // 最適化されたタイムアウト設定でSSEヘッダーを設定
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
    'Keep-Alive': 'timeout=60, max=10', // 最適化: 60秒タイムアウト、最大10リクエスト
    'X-Accel-Buffering': 'no' // Nginxプロキシバッファリング無効化
  })

  // 処理タイプを事前にチェックしてタイムアウト値を決定
  const { data: checkTypeData } = await supabase
    .from('checks')
    .select('input_type')
    .eq('id', checkId)
    .single()
  
  // 段階的タイムアウト値: 画像処理は長めの設定
  const maxConnectionTime = checkTypeData?.input_type === 'image' ? 180000 : 90000  // 画像: 3分、テキスト: 1.5分
  const maxProgressTime = checkTypeData?.input_type === 'image' ? 60000 : 30000     // 画像: 1分、テキスト: 30秒

  // タイムアウト処理付きのReadableStreamを作成
  const stream = new ReadableStream({
    start(controller) {
      const channel = supabase.channel(`check-updates-${checkId}`)
      // 最適化されたハートビート: 接続状態に応じた間隔調整
      let heartbeatInterval: NodeJS.Timeout
      let heartbeatCount = 0
      const maxHeartbeats = 4 // 最大4回のハートビート（2分間）
      
      const startHeartbeat = (intervalMs = 20000) => {
        if (heartbeatInterval) clearInterval(heartbeatInterval)
        heartbeatInterval = setInterval(() => {
          try {
            heartbeatCount++
            if (heartbeatCount > maxHeartbeats) {
              // Max heartbeats reached - ending stream
              clearInterval(heartbeatInterval)
              return
            }
            controller.enqueue(new TextEncoder().encode(`: heartbeat-${heartbeatCount}\\n\\n`))
          } catch (error) {
            console.error(`[SSE] Heartbeat error for check ${checkId}:`, error)
            clearInterval(heartbeatInterval)
          }
        }, intervalMs)
      }
      
      startHeartbeat(20000) // 20秒間隔でハートビート開始

      // 段階的タイムアウト処理
      let progressTimeout: NodeJS.Timeout
      
      // 進捗タイムアウト: 一定時間進捗がない場合の処理
      progressTimeout = setTimeout(() => {
        // Progress timeout - reducing heartbeat interval
        // 進捗タイムアウト時はハートビート間隔を短くして接続維持
        startHeartbeat(10000) // 10秒間隔に変更
      }, maxProgressTime)
      
      // 最終接続タイムアウト
      const connectionTimeout = setTimeout((): void => {
        // Final connection timeout - ending stream
        const timeoutData = JSON.stringify({
          id: checkId,
          status: 'failed',
          error: 'SSE接続がタイムアウトしました（処理時間制限）'
        })
        controller.enqueue(new TextEncoder().encode(`data: ${timeoutData}\\n\\n`))
        controller.close()
        channel.unsubscribe()
        clearInterval(heartbeatInterval)
        clearTimeout(progressTimeout)
      }, maxConnectionTime)

      channel
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'checks', 
            filter: `id=eq.${checkId}` 
        }, async (payload) => {
            const updatedCheck = payload.new as Database['public']['Tables']['checks']['Row']
            
            if (updatedCheck.status === 'completed' || updatedCheck.status === 'failed') {
                clearTimeout(connectionTimeout)
                clearTimeout(progressTimeout)
                clearInterval(heartbeatInterval)
                await sendFinalData(controller, checkId, supabase)
                controller.close()
                channel.unsubscribe()
            } else {
                // 進捗更新時は進捗タイムアウトをリセット
                clearTimeout(progressTimeout)
                progressTimeout = setTimeout(() => {
                  // Progress timeout reset - reducing heartbeat interval
                  startHeartbeat(10000)
                }, maxProgressTime)
                
                // 画像の場合はOCR状態を含む進捗データを送信
                const progressData = JSON.stringify({
                    id: checkId,
                    status: updatedCheck.status,
                    input_type: updatedCheck.input_type,
                    ocr_status: updatedCheck.ocr_status,
                    extracted_text: updatedCheck.extracted_text,
                    error_message: updatedCheck.error_message
                })
                controller.enqueue(new TextEncoder().encode(`data: ${progressData}\n\n`))
            }
        })
        .subscribe((status, err) => {
            if (err) {
                console.error(`[SSE] Subscription error for check ${checkId}:`, err)
                clearTimeout(connectionTimeout)
                clearTimeout(progressTimeout)
                clearInterval(heartbeatInterval)
                controller.close()
            } else if (status === 'SUBSCRIBED') {
                // Successfully subscribed to check updates
            }
        })

      // 最適化されたクリーンアップ処理
      const cleanup = () => {
        // Cleaning up SSE resources
        clearTimeout(connectionTimeout)
        clearTimeout(progressTimeout)
        clearInterval(heartbeatInterval)
        channel.unsubscribe()
        try { controller.close() } catch { /* already closed */ }
      }
      
      // クライアント切断時のクリーンアップ
      request.signal.addEventListener('abort', cleanup)
      
      // 追加の安全対策: 5分後の強制クリーンアップ
      setTimeout(cleanup, 300000) // 5分
    }
  })

  return new Response(stream, { headers })
}

/**
 * チェック処理完了時に最終データをSSEストリームに送信する
 * 違反情報や関連する辞書データを含む完全なレスポンスを構築
 * @param controller SSEストリームのコントローラー
 * @param checkId 対象のチェックID
 * @param supabase Supabaseクライアントインスタンス
 */
async function sendFinalData(
  controller: ReadableStreamDefaultController<Uint8Array>,
  checkId: number,
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never
) {
  try {
    // 違反情報を含む完全なチェックデータを取得
    const { data: checkData, error } = await supabase
      .from('checks')
      .select(`
        *,
        violations (
          id,
          start_pos,
          end_pos,
          reason,
          dictionary_id,
          dictionaries (
            id,
            phrase,
            category,
            notes
          )
        )
      `)
      .eq('id', checkId)
      .single()

    if (error || !checkData) {
      console.error(`[SSE] Error fetching final data for check ${checkId}:`, error)
      const errorData = JSON.stringify({
        id: checkId,
        status: 'failed',
        error: 'データの取得に失敗しました'
      })
      controller.enqueue(new TextEncoder().encode(`data: ${errorData}\\n\\n`))
      return
    }

    // 入力タイプに基づいてレスポンスデータを準備
    const responseData = {
      id: checkId,
      status: checkData.status,
      input_type: checkData.input_type,
      original_text: checkData.original_text,
      extracted_text: checkData.extracted_text, // 画像の場合のOCR結果
      image_url: checkData.image_url,
      ocr_status: checkData.ocr_status,
      ocr_metadata: checkData.ocr_metadata,
      modified_text: checkData.modified_text,
      violations: checkData.violations,
      error_message: checkData.error_message,
      completed_at: checkData.completed_at
    }

    // 最終データをSSEストリームに送信
    const finalData = JSON.stringify(responseData)
    controller.enqueue(new TextEncoder().encode(`data: ${finalData}\\n\\n`))
  } catch (error) {
    console.error(`[SSE] Unexpected error in sendFinalData for check ${checkId}:`, error)
    const errorData = JSON.stringify({
      id: checkId,
      status: 'failed',
      error: '予期しないエラーが発生しました'
    })
    controller.enqueue(new TextEncoder().encode(`data: ${errorData}\\n\\n`))
  }
}
