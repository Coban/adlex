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
  const { data: { user }, error: authError } = await supabase.auth.getUser()
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


  // Set up SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  // Create a readable stream
  const stream = new ReadableStream({
    start(controller) {
      console.log(`[SSE] Starting stream for check ${checkId}`)
      
      const channel = supabase.channel(`check-updates-${checkId}`)

      channel
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'checks', 
            filter: `id=eq.${checkId}` 
        }, async (payload) => {
            console.log(`[SSE] Received update for check ${checkId}:`, payload)
            
            const updatedCheck = payload.new as Database['public']['Tables']['checks']['Row']
            console.log(`[SSE] Check status: ${updatedCheck.status}`)
            
            if (updatedCheck.status === 'completed' || updatedCheck.status === 'failed') {
                console.log(`[SSE] Sending final data for check ${checkId}`)
                await sendFinalData(controller, checkId, supabase)
                controller.close()
                channel.unsubscribe()
            } else {
                console.log(`[SSE] Sending progress update for check ${checkId}`)
                const progressData = JSON.stringify({
                    id: checkId,
                    status: updatedCheck.status
                })
                controller.enqueue(new TextEncoder().encode(`data: ${progressData}\n\n`))
            }
        })
        .subscribe((status, err) => {
            console.log(`[SSE] Subscription status for check ${checkId}:`, status)
            if (status === 'SUBSCRIBED') {
                console.log(`[SSE] Successfully subscribed to channel for check ${checkId}`)
            }
            if (err) {
                console.error(`[SSE] Subscription error for check ${checkId}:`, err)
                controller.close()
            }
        })

      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        console.log(`[SSE] Client disconnected for check ${checkId}, unsubscribing`)
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
    console.log(`[SSE] Getting final data for check ${checkId}`)
    
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

    console.log(`[SSE] Final check data for ${checkId}:`, {
      status: checkData.status,
      hasModifiedText: !!checkData.modified_text,
      violationsCount: checkData.violations?.length || 0,
      errorMessage: checkData.error_message
    })

    if (checkData.status === 'failed') {
      const errorMessage = checkData.error_message ?? 'チェック処理が失敗しました'
      const errorData = JSON.stringify({
        id: checkData.id,
        status: 'failed',
        error: errorMessage
      })
      console.log(`[SSE] Sending error data for check ${checkId}:`, errorData)
      controller.enqueue(new TextEncoder().encode(`data: ${errorData}\n\n`))
    } else {
      const finalData = JSON.stringify({
        id: checkData.id,
        status: checkData.status,
        original_text: checkData.original_text,
        modified_text: checkData.modified_text,
        violations: checkData.violations || []
      })
      console.log(`[SSE] Sending success data for check ${checkId}:`, {
        dataLength: finalData.length,
        hasModifiedText: !!checkData.modified_text,
        violationsCount: checkData.violations?.length || 0
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
