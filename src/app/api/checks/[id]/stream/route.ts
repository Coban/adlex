import { NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database.types'

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

  // Verify user has access to this check
  const authResult = await supabase.auth.getUser()
  const user = authResult.data.user
  const authError = authResult.error
  
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { data: checkData, error: checkError } = await supabase
    .from('checks')
    .select('id, user_id, organization_id')
    .eq('id', checkId)
    .single()

  if (checkError || !checkData) {
    return new Response('Check not found', { status: 404 })
  }
  
  // Further validation to ensure user can access this check
  const { data: userProfile } = await supabase
    .from('users')
    .select('id, organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userProfile || (userProfile.role === 'user' && checkData.user_id !== user.id) || (userProfile.organization_id !== checkData.organization_id)) {
      return new Response('Forbidden', { status: 403 })
  }


  // Set up SSE headers with timeout configuration
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
    'Keep-Alive': 'timeout=90, max=100', // 90秒のキープアライブ
  })

  // Create a readable stream with timeout handling
  const stream = new ReadableStream({
    start(controller) {
      const channel = supabase.channel(`check-updates-${checkId}`)
      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(`: heartbeat\n\n`))
        } catch (error) {
          console.error(`[SSE] Heartbeat error for check ${checkId}:`, error)
          clearInterval(heartbeatInterval)
        }
      }, 30000)

      // Set connection timeout (2 minutes)
      const connectionTimeout = setTimeout(() => {
        console.log(`[SSE] Connection timeout for check ${checkId}`)
        const timeoutData = JSON.stringify({
          id: checkId,
          status: 'failed',
          error: 'SSE接続がタイムアウトしました'
        })
        controller.enqueue(new TextEncoder().encode(`data: ${timeoutData}\n\n`))
        controller.close()
        channel.unsubscribe()
        clearInterval(heartbeatInterval)
      }, 120000) // 2分

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
                clearInterval(heartbeatInterval)
                await sendFinalData(controller, checkId, supabase)
                controller.close()
                channel.unsubscribe()
            } else {
                const progressData = JSON.stringify({
                    id: checkId,
                    status: updatedCheck.status
                })
                controller.enqueue(new TextEncoder().encode(`data: ${progressData}\n\n`))
            }
        })
        .subscribe((status, err) => {
            if (err) {
                console.error(`[SSE] Subscription error for check ${checkId}:`, err)
                clearTimeout(connectionTimeout)
                clearInterval(heartbeatInterval)
                controller.close()
            }
        })

      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        console.log(`[SSE] Client disconnected for check ${checkId}`)
        clearTimeout(connectionTimeout)
        clearInterval(heartbeatInterval)
        channel.unsubscribe()
        controller.close()
      })
    }
  })

  return new Response(stream, { headers })
}

async function sendFinalData(
  controller: ReadableStreamDefaultController<Uint8Array>,
  checkId: number,
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never
) {
  try {
    // Get complete check data with violations
    const { data: checkData, error } = await supabase
      .from('checks')
      .select(`
        *,
        violations (
          id,
          start_pos,
          end_pos,
          reason,
          dictionary_id
        )
      `)
      .eq('id', checkId)
      .single()

    if (error || !checkData) {
        console.error(`[SSE] Error getting final data for check ${checkId}:`, error)
        throw new Error(error?.message ?? 'Failed to retrieve final check data')
    }

    if (checkData.status === 'failed') {
      const errorMessage = checkData.error_message ?? 'チェック処理が失敗しました'
      const errorData = JSON.stringify({
        id: checkData.id,
        status: 'failed',
        error: errorMessage
      })
      controller.enqueue(new TextEncoder().encode(`data: ${errorData}\n\n`))
    } else {
      const finalData = JSON.stringify({
        id: checkData.id,
        status: checkData.status,
        original_text: checkData.original_text,
        modified_text: checkData.modified_text,
        violations: checkData.violations || []
      })
      controller.enqueue(new TextEncoder().encode(`data: ${finalData}\n\n`))
    }
  } catch (error) {
    console.error(`[SSE] Error sending final data for check ${checkId}:`, error)
    const errorData = JSON.stringify({
      id: checkId,
      status: 'failed',
      error: 'Failed to retrieve results'
    })
    controller.enqueue(new TextEncoder().encode(`data: ${errorData}\n\n`))
  }
}
