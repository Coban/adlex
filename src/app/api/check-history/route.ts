import { NextRequest, NextResponse } from 'next/server'

import { getRepositories } from '@/lib/repositories'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get repositories
    const repositories = await getRepositories(supabase)

    // Get user data with role and organization
    const userData = await repositories.users.findById(user.id)
    if (!userData?.organization_id) {
      return NextResponse.json({ error: 'User not found or not in organization' }, { status: 404 })
    }

    // Parse query parameters
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '20')
    const search = searchParams.get('search') ?? ''
    const statusParam = searchParams.get('status') ?? ''
    const inputTypeParam = searchParams.get('inputType') ?? ''
    const dateFilter = searchParams.get('dateFilter') ?? ''
    const userIdParam = searchParams.get('userId') ?? ''

    // Validate and cast parameters
    const status = statusParam && ['pending', 'processing', 'completed', 'failed'].includes(statusParam) 
      ? statusParam as 'pending' | 'processing' | 'completed' | 'failed' 
      : undefined

    const inputType = inputTypeParam && ['text', 'image'].includes(inputTypeParam)
      ? inputTypeParam as 'text' | 'image'
      : undefined

    const dateFilterValue = dateFilter && ['today', 'week', 'month'].includes(dateFilter)
      ? dateFilter as 'today' | 'week' | 'month'
      : undefined

    // Determine userId based on user role
    let userId: string | undefined
    if (userData.role === 'user') {
      // Regular users can only see their own checks
      userId = userData.id
    } else if (userData.role === 'admin' && userIdParam) {
      // Admins can filter by specific user
      userId = userIdParam
    }

    // Use repository search method
    const searchResult = await repositories.checks.searchChecks({
      organizationId: userData.organization_id,
      userId,
      search: search || undefined,
      status,
      inputType,
      dateFilter: dateFilterValue,
      page,
      limit
    })

    // Format the response
    const formattedChecks = searchResult.checks.map(check => ({
      id: check.id,
      originalText: check.original_text,
      modifiedText: check.modified_text,
      status: check.status,
      inputType: check.input_type,
      imageUrl: check.image_url,
      extractedText: check.extracted_text,
      ocrStatus: check.ocr_status,
      createdAt: check.created_at,
      completedAt: check.completed_at,
      userEmail: check.users?.email,
      violationCount: check.violations?.length ?? 0
    }))

    return NextResponse.json({
      checks: formattedChecks,
      pagination: searchResult.pagination,
      userRole: userData.role
    })

  } catch (error) {
    console.error('History API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}