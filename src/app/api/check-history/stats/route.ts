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


    // Determine userId based on role
    let searchUserId: string | undefined
    if (userData.role === 'user') {
      searchUserId = userData.id
    } else if (userData.role === 'admin' && userId) {
      searchUserId = userId
    }

    // Get total checks count
    const totalChecks = await repositories.checks.countByDateRange(
      startDate.toISOString(),
      now.toISOString(),
      userData.organization_id,
      searchUserId
    )

    // Get checks for status breakdown and daily activity
    const checksForPeriod = await repositories.checks.findMany({
      where: {
        organization_id: userData.organization_id,
        user_id: searchUserId,
        created_at: { gte: startDate.toISOString(), lte: now.toISOString() },
        deleted_at: null
      },
      orderBy: [{ field: 'created_at', direction: 'desc' }]
    })

    // Process status and input type breakdown from the same data
    const statusBreakdown = checksForPeriod.reduce((acc: Record<string, number>, item) => {
      const status = item.status ?? 'unknown'
      acc[status] = (acc[status] ?? 0) + 1
      return acc
    }, {})

    const inputTypeBreakdown = checksForPeriod.reduce((acc: Record<string, number>, item) => {
      const inputType = item.input_type ?? 'unknown'
      acc[inputType] = (acc[inputType] ?? 0) + 1
      return acc
    }, {})

    // Get violations statistics
    // Since we need violation counts, we'll need to get detailed violations
    const checksWithViolations = await Promise.all(
      checksForPeriod.map(async (check) => {
        const violations = await repositories.violations.findByCheckId(check.id)
        return {
          id: check.id,
          violations
        }
      })
    )

    // Process violation statistics
    const violationStats = checksWithViolations.reduce((acc, check) => {
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
    })

    // Get daily activity for the period (last 30 days max)
    const activityDays = Math.min(30, Math.ceil((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)))
    const dailyActivity: Record<string, number> = {}
    
    for (let i = 0; i < activityDays; i++) {
      const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000))
      const dateKey = date.toISOString().split('T')[0]
      dailyActivity[dateKey] = 0
    }

    checksForPeriod.forEach(check => {
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