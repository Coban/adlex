import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  const { data: checkData } = await supabase
    .from('checks')
    .select('*')
    .eq('id', checkId)
    .eq('user_id', user.id)
    .single()

  if (!checkData) {
    return new Response('Check not found', { status: 404 })
  }

  // Set up SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  })

  // Create a readable stream
  const stream = new ReadableStream({
    start(controller) {
      // Send initial status
      const initialData = JSON.stringify({
        id: checkData.id,
        status: checkData.status,
        original_text: checkData.original_text,
        modified_text: checkData.modified_text,
        violations: []
      })

      controller.enqueue(new TextEncoder().encode(`data: ${initialData}\n\n`))

      // If already completed, send final data and close
      if (checkData.status === 'completed') {
        sendFinalData(controller, checkId, supabase)
        return
      } else if (checkData.status === 'failed') {
        const errorMessage = checkData.error_message || 'チェック処理が失敗しました'
        const errorData = JSON.stringify({
          id: checkId,
          status: 'failed',
          error: errorMessage
        })
        controller.enqueue(new TextEncoder().encode(`data: ${errorData}\n\n`))
        return
      }

      // Poll for updates
      const interval = setInterval(async () => {
        try {
          const { data: updatedCheck } = await supabase
            .from('checks')
            .select('*')
            .eq('id', checkId)
            .single()

          if (!updatedCheck) {
            controller.close()
            clearInterval(interval)
            return
          }

          if (updatedCheck.status === 'completed') {
            await sendFinalData(controller, checkId, supabase)
            controller.close()
            clearInterval(interval)
          } else if (updatedCheck.status === 'failed') {
            const errorMessage = updatedCheck.error_message || 'チェック処理が失敗しました'
            const errorData = JSON.stringify({
              id: checkId,
              status: 'failed',
              error: errorMessage
            })
            controller.enqueue(new TextEncoder().encode(`data: ${errorData}\n\n`))
            controller.close()
            clearInterval(interval)
          } else {
            // Send progress update
            const progressData = JSON.stringify({
              id: checkId,
              status: updatedCheck.status
            })
            controller.enqueue(new TextEncoder().encode(`data: ${progressData}\n\n`))
          }
        } catch (error) {
          console.error('SSE polling error:', error)
          controller.close()
          clearInterval(interval)
        }
      }, 1000) // Poll every second

      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
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
    const { data: checkData } = await supabase
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

    if (checkData) {
      if (checkData.status === 'failed') {
        const errorMessage = checkData.error_message || 'チェック処理が失敗しました'
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
    }
  } catch (error) {
    console.error('Error sending final data:', error)
    const errorData = JSON.stringify({
      id: checkId,
      status: 'failed',
      error: 'Failed to retrieve results'
    })
    controller.enqueue(new TextEncoder().encode(`data: ${errorData}\n\n`))
  }
}
