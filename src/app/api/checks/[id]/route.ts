import { NextRequest, NextResponse } from 'next/server'

import { getRepositories } from '@/lib/repositories'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const resolvedParams = await params
    const checkId = parseInt(resolvedParams.id)

    if (isNaN(checkId)) {
      return NextResponse.json({ error: 'Invalid check ID' }, { status: 400 })
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get repositories
    const repositories = await getRepositories(supabase)

    // Get user data with role and organization
    const userData = await repositories.users.findById(user.id)
    if (!userData || !userData.organization_id) {
      return NextResponse.json({ error: 'User not found or not in organization' }, { status: 404 })
    }

    // Get check details with violations
    const check = await repositories.checks.findByIdWithDetailedViolations(checkId, userData.organization_id)
    if (!check) {
      return NextResponse.json({ error: 'Check not found' }, { status: 404 })
    }

    // Check access permissions
    if (userData.role === 'user' && check.user_id !== userData.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Format the response
    const formattedCheck = {
      id: check.id,
      originalText: check.original_text,
      modifiedText: check.modified_text,
      status: check.status,
      inputType: check.input_type,
      imageUrl: check.image_url,
      extractedText: check.extracted_text,
      ocrStatus: check.ocr_status,
      ocrMetadata: check.ocr_metadata,
      createdAt: check.created_at,
      completedAt: check.completed_at,
      userEmail: check.users?.email,
      violations: check.violations?.map(violation => ({
        id: violation.id,
        startPos: violation.start_pos,
        endPos: violation.end_pos,
        reason: violation.reason,
        dictionaryPhrase: violation.dictionaries?.phrase,
        dictionaryCategory: violation.dictionaries?.category
      })) || []
    }

    return NextResponse.json({ check: formattedCheck })

  } catch (error) {
    console.error('Check detail API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const resolvedParams = await params
    const checkId = parseInt(resolvedParams.id)

    if (isNaN(checkId)) {
      return NextResponse.json({ error: 'Invalid check ID' }, { status: 400 })
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get repositories
    const repositories = await getRepositories(supabase)

    // Get user data with role and organization
    const userData = await repositories.users.findById(user.id)
    if (!userData || !userData.organization_id) {
      return NextResponse.json({ error: 'User not found or not in organization' }, { status: 404 })
    }

    // Get check to verify ownership and existence
    const check = await repositories.checks.findById(checkId)
    if (!check || check.organization_id !== userData.organization_id || check.deleted_at) {
      return NextResponse.json({ error: 'Check not found' }, { status: 404 })
    }

    // Check access permissions - users can only delete their own checks, admins can delete any
    if (userData.role === 'user' && check.user_id !== userData.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Perform logical deletion
    const deletedCheck = await repositories.checks.logicalDelete(checkId)
    if (!deletedCheck) {
      return NextResponse.json({ error: 'Failed to delete check' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Check deleted successfully' })

  } catch (error) {
    console.error('Check deletion API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
