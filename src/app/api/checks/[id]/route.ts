import { NextRequest, NextResponse } from 'next/server'

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

    // Get user data with role and organization
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id, email, organization_id, role')
      .eq('id', user.id)
      .single()

    if (userDataError || !userData?.organization_id) {
      return NextResponse.json({ error: 'User not found or not in organization' }, { status: 404 })
    }

    // Get check details with violations
    const { data: check, error: checkError } = await supabase
      .from('checks')
      .select(`
        id,
        original_text,
        modified_text,
        status,
        created_at,
        completed_at,
        user_id,
        organization_id,
        users!inner(email),
        violations!inner(
          id,
          start_pos,
          end_pos,
          reason,
          dictionary_id,
          dictionaries(phrase, category)
        )
      `)
      .eq('id', checkId)
      .eq('organization_id', userData.organization_id)
      .is('deleted_at', null)
      .single()

    if (checkError) {
      console.error('Check query error:', checkError)
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