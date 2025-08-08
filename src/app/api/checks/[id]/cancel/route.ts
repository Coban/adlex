import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const checkId = parseInt(id)

  if (isNaN(checkId)) {
    return NextResponse.json({ error: 'Invalid check ID' }, { status: 400 })
  }

  const supabase = await createClient()

  // Verify user has access to this check
  const authResult = await supabase.auth.getUser()
  const user = authResult.data.user
  const authError = authResult.error
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get check data to verify ownership
  const { data: checkData, error: checkError } = await supabase
    .from('checks')
    .select('id, user_id, organization_id, status')
    .eq('id', checkId)
    .single()

  if (checkError || !checkData) {
    return NextResponse.json({ error: 'Check not found' }, { status: 404 })
  }
  
  // Further validation to ensure user can access this check
  const { data: userProfile } = await supabase
    .from('users')
    .select('id, organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userProfile || 
      (userProfile.role === 'user' && checkData.user_id !== user.id) || 
      (userProfile.organization_id !== checkData.organization_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Only allow cancellation of pending or processing checks
  if (checkData.status !== 'pending' && checkData.status !== 'processing') {
    return NextResponse.json({ 
      error: 'Can only cancel pending or processing checks',
      currentStatus: checkData.status 
    }, { status: 400 })
  }

  try {
    // Update check status to cancelled
    const { error: updateError } = await supabase
      .from('checks')
      .update({ 
        status: 'failed',
        error_message: 'ユーザーによってキャンセルされました',
        completed_at: new Date().toISOString()
      })
      .eq('id', checkId)
      .eq('status', checkData.status) // Optimistic locking

    if (updateError) {
      console.error(`[CANCEL] Failed to update check ${checkId}:`, updateError)
      return NextResponse.json({ error: 'Failed to cancel check' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Check cancelled successfully',
      checkId 
    })

  } catch (error) {
    console.error(`[CANCEL] Error cancelling check ${checkId}:`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}