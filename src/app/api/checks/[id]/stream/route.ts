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
  let user
  const authResult = await supabase.auth.getUser()
  user = authResult.data.user
  const authError = authResult.error
  
  // TEMPORARY: Skip authentication for test/development mode
  if ((process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && process.env.SKIP_AUTH === 'true') {
    user = {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'admin@test.com'
    } as { id: string; email: string }
  } else {
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 })
    }
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
  if (!((process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && process.env.SKIP_AUTH === 'true')) {
    const { data: userProfile } = await supabase
      .from('users')
      .select('id, organization_id, role')
      .eq('id', user.id)
      .single()

    if (!userProfile || (userProfile.role === 'user' && checkData.user_id !== user.id) || (userProfile.organization_id !== checkData.organization_id)) {
        return new Response('Forbidden', { status: 403 })
    }
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
      const channel = supabase.channel(`check-updates-${checkId}`)

      channel
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'checks', 
            filter: `id=eq.${checkId}` 
        }, async (payload) => {
            const updatedCheck = payload.new as Database['public']['Tables']['checks']['Row']
            
            if (updatedCheck.status === 'completed' || updatedCheck.status === 'failed') {
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
                controller.close()
            }
        })

      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
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
