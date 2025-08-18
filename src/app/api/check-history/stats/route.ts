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

    // Parse query parameters for date range
    const period = searchParams.get('period') ?? 'month' // week, month, quarter, year
    const userId = searchParams.get('userId') ?? ''

    // Calculate date range based on period
    const now = new Date()
    let startDate: Date

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3)
        startDate = new Date(now.getFullYear(), quarter * 3, 1)
        break
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }


    // Get total checks count
    let totalCountQuery = supabase
      .from('checks')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', userData.organization_id)
      .is('deleted_at', null)
      .gte('created_at', startDate.toISOString())

    if (userData.role === 'user') {
      totalCountQuery = totalCountQuery.eq('user_id', userData.id)
    } else if (userData.role === 'admin' && userId) {
      totalCountQuery = totalCountQuery.eq('user_id', userId)
    }

    const { count: totalChecks, error: totalError } = await totalCountQuery

    if (totalError) {
      console.error('Total checks count error:', totalError)
      return NextResponse.json({ error: 'Failed to get statistics' }, { status: 500 })
    }

    // Get status breakdown
    let statusQuery = supabase
      .from('checks')
      .select('status, created_at')
      .eq('organization_id', userData.organization_id)
      .is('deleted_at', null)
      .gte('created_at', startDate.toISOString())

    if (userData.role === 'user') {
      statusQuery = statusQuery.eq('user_id', userData.id)
    } else if (userData.role === 'admin' && userId) {
      statusQuery = statusQuery.eq('user_id', userId)
    }

    const { data: statusData, error: statusError } = await statusQuery

    if (statusError) {
      console.error('Status breakdown error:', statusError)
      return NextResponse.json({ error: 'Failed to get status statistics' }, { status: 500 })
    }

    // Get input type breakdown
    let inputTypeQuery = supabase
      .from('checks')
      .select('input_type')
      .eq('organization_id', userData.organization_id)
      .is('deleted_at', null)
      .gte('created_at', startDate.toISOString())

    if (userData.role === 'user') {
      inputTypeQuery = inputTypeQuery.eq('user_id', userData.id)
    } else if (userData.role === 'admin' && userId) {
      inputTypeQuery = inputTypeQuery.eq('user_id', userId)
    }

    const { data: inputTypeData, error: inputTypeError } = await inputTypeQuery

    if (inputTypeError) {
      console.error('Input type breakdown error:', inputTypeError)
      return NextResponse.json({ error: 'Failed to get input type statistics' }, { status: 500 })
    }

    // Get violations statistics
    let violationsQuery = supabase
      .from('checks')
      .select(`
        id,
        violations:violations(id)
      `)
      .eq('organization_id', userData.organization_id)
      .is('deleted_at', null)
      .gte('created_at', startDate.toISOString())

    if (userData.role === 'user') {
      violationsQuery = violationsQuery.eq('user_id', userData.id)
    } else if (userData.role === 'admin' && userId) {
      violationsQuery = violationsQuery.eq('user_id', userId)
    }

    const { data: violationsData, error: violationsError } = await violationsQuery

    if (violationsError) {
      console.error('Violations statistics error:', violationsError)
      return NextResponse.json({ error: 'Failed to get violations statistics' }, { status: 500 })
    }

    // Process statistics
    const statusBreakdown = statusData?.reduce((acc: Record<string, number>, item) => {
      const status = item.status ?? 'unknown'
      acc[status] = (acc[status] ?? 0) + 1
      return acc
    }, {}) ?? {}

    const inputTypeBreakdown = inputTypeData?.reduce((acc: Record<string, number>, item) => {
      const inputType = item.input_type ?? 'unknown'
      acc[inputType] = (acc[inputType] ?? 0) + 1
      return acc
    }, {}) ?? {}

    const violationStats = violationsData?.reduce((acc, check) => {
      const violationCount = check.violations?.length ?? 0
      acc.totalViolations += violationCount
      if (violationCount > 0) {
        acc.checksWithViolations += 1
      }
      acc.maxViolationsInSingleCheck = Math.max(acc.maxViolationsInSingleCheck, violationCount)
      return acc
    }, {
      totalViolations: 0,
      checksWithViolations: 0,
      maxViolationsInSingleCheck: 0
    }) || { totalViolations: 0, checksWithViolations: 0, maxViolationsInSingleCheck: 0 }

    // Get daily activity for the period (last 30 days max)
    const activityDays = Math.min(30, Math.ceil((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)))
    const dailyActivity: Record<string, number> = {}
    
    for (let i = 0; i < activityDays; i++) {
      const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000))
      const dateKey = date.toISOString().split('T')[0]
      dailyActivity[dateKey] = 0
    }

    statusData?.forEach(check => {
      if (check.created_at) {
        const dateKey = new Date(check.created_at).toISOString().split('T')[0]
        if (dailyActivity.hasOwnProperty(dateKey)) {
          dailyActivity[dateKey] += 1
        }
      }
    })

    const stats = {
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      totalChecks: totalChecks ?? 0,
      statusBreakdown: {
        pending: statusBreakdown.pending || 0,
        processing: statusBreakdown.processing || 0,
        completed: statusBreakdown.completed || 0,
        failed: statusBreakdown.failed || 0
      },
      inputTypeBreakdown: {
        text: inputTypeBreakdown.text || 0,
        image: inputTypeBreakdown.image || 0
      },
      violationStats: {
        totalViolations: violationStats.totalViolations,
        checksWithViolations: violationStats.checksWithViolations,
        averageViolationsPerCheck: totalChecks ? (violationStats.totalViolations / (totalChecks ?? 1)).toFixed(2) : '0',
        maxViolationsInSingleCheck: violationStats.maxViolationsInSingleCheck,
        violationRate: totalChecks ? ((violationStats.checksWithViolations / (totalChecks ?? 1)) * 100).toFixed(1) : '0'
      },
      dailyActivity: Object.entries(dailyActivity)
        .sort(([a], [b]) => a.localeCompare(b))
        .reduce((acc, [date, count]) => {
          acc[date] = count
          return acc
        }, {} as Record<string, number>)
    }

    return NextResponse.json({ stats })

  } catch (error) {
    console.error('Statistics API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}