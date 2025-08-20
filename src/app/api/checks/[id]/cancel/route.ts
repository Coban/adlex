import { NextRequest, NextResponse } from 'next/server'

import { getRepositories } from '@/lib/repositories'
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

  // Get repositories
  const repositories = await getRepositories(supabase)

  // Get check data to verify ownership
  const checkData = await repositories.checks.findById(checkId)
  if (!checkData) {
    return NextResponse.json({ error: 'Check not found' }, { status: 404 })
  }
  
  // Further validation to ensure user can access this check
  const userProfile = await repositories.users.findById(user.id)
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
    const updatedCheck = await repositories.checks.update(checkId, { 
      status: 'failed',
      error_message: 'ユーザーによってキャンセルされました',
      completed_at: new Date().toISOString()
    })

    if (!updatedCheck) {
      console.error(`[CANCEL] Failed to update check ${checkId}: Update failed`)
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