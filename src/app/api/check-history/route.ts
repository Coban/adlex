import { NextRequest, NextResponse } from 'next/server'

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

    // Get user data with role and organization
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id, email, organization_id, role')
      .eq('id', user.id)
      .single()

    if (userDataError || !userData?.organization_id) {
      return NextResponse.json({ error: 'User not found or not in organization' }, { status: 404 })
    }

    // Parse query parameters
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '20')
    const search = searchParams.get('search') ?? ''
    const status = searchParams.get('status') ?? ''
    const inputType = searchParams.get('inputType') ?? ''
    const dateFilter = searchParams.get('dateFilter') ?? ''
    const userId = searchParams.get('userId') ?? ''
    
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('checks')
      .select(`
        id,
        original_text,
        modified_text,
        status,
        input_type,
        image_url,
        extracted_text,
        ocr_status,
        created_at,
        completed_at,
        user_id,
        users!inner(email),
        violations:violations(id)
      `)
      .eq('organization_id', userData.organization_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // Apply filters based on user role
    if (userData.role === 'user') {
      // Regular users can only see their own checks
      query = query.eq('user_id', userData.id)
    } else if (userData.role === 'admin' && userId) {
      // Admins can filter by specific user
      query = query.eq('user_id', userId)
    }

    // Apply text search filter
    if (search) {
      query = query.ilike('original_text', `%${search}%`)
    }

    // Apply status filter
    if (status && ['pending', 'processing', 'completed', 'failed'].includes(status)) {
      query = query.eq('status', status as 'pending' | 'processing' | 'completed' | 'failed')
    }

    // Apply input type filter
    if (inputType && ['text', 'image'].includes(inputType)) {
      query = query.eq('input_type', inputType as 'text' | 'image')
    }

    // Apply date filter
    if (dateFilter && ['today', 'week', 'month'].includes(dateFilter)) {
      const now = new Date()
      let startDate: Date

      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          const dayOfWeek = now.getDay()
          startDate = new Date(now.getTime() - (dayOfWeek * 24 * 60 * 60 * 1000))
          startDate.setHours(0, 0, 0, 0)
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        default:
          startDate = new Date(0) // fallback
      }

      query = query.gte('created_at', startDate.toISOString())
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('checks')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', userData.organization_id)
      .is('deleted_at', null)

    if (userData.role === 'user') {
      countQuery = countQuery.eq('user_id', userData.id)
    } else if (userData.role === 'admin' && userId) {
      countQuery = countQuery.eq('user_id', userId)
    }

    if (search) {
      countQuery = countQuery.ilike('original_text', `%${search}%`)
    }

    if (status && ['pending', 'processing', 'completed', 'failed'].includes(status)) {
      countQuery = countQuery.eq('status', status as 'pending' | 'processing' | 'completed' | 'failed')
    }

    if (inputType && ['text', 'image'].includes(inputType)) {
      countQuery = countQuery.eq('input_type', inputType as 'text' | 'image')
    }

    if (dateFilter && ['today', 'week', 'month'].includes(dateFilter)) {
      const now = new Date()
      let startDate: Date

      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          const dayOfWeek = now.getDay()
          startDate = new Date(now.getTime() - (dayOfWeek * 24 * 60 * 60 * 1000))
          startDate.setHours(0, 0, 0, 0)
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        default:
          startDate = new Date(0)
      }

      countQuery = countQuery.gte('created_at', startDate.toISOString())
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      console.error('Count query error:', countError)
      return NextResponse.json({ error: 'Failed to get count' }, { status: 500 })
    }

    // Get paginated results
    const { data: checks, error: checksError } = await query
      .range(offset, offset + limit - 1)

    if (checksError) {
      console.error('Checks query error:', checksError)
      return NextResponse.json({ error: 'Failed to fetch checks' }, { status: 500 })
    }

    // Format the response
    const formattedChecks = checks?.map(check => ({
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
    })) ?? []

    const totalPages = Math.ceil((count ?? 0) / limit)

    return NextResponse.json({
      checks: formattedChecks,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      userRole: userData.role
    })

  } catch (error) {
    console.error('History API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}