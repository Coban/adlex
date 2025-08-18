import { NextResponse } from 'next/server'

import { getRepositories } from '@/lib/repositories'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  // 認証チェック
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get repositories
  const repositories = await getRepositories(supabase)

  // 管理者権限チェック - using repository
  const isAdmin = await repositories.users.isAdmin(user.id)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Use repository methods to get stats
    const [
      totalUsers,
      totalDictionaries,
      totalOrganizations,
      totalViolations,
      checkStats,
      activeUsers
    ] = await Promise.all([
      repositories.users.count(),
      repositories.dictionaries.count(),
      repositories.organizations.count(),
      repositories.violations.countTotal(),
      repositories.checks.getStats(),
      repositories.checks.countActiveUsers(30)
    ])

    // Calculate daily checks for the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const dailyChecksCount = await repositories.checks.countByDateRange(sevenDaysAgo, new Date().toISOString())
    
    // Create daily check data structure
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      return date.toLocaleDateString('ja-JP')
    })

    const dailyCheckData = last7Days.map(date => ({
      date,
      count: Math.floor(dailyChecksCount / 7) // Simple distribution for demo
    }))

    return NextResponse.json({
      stats: {
        totalUsers,
        totalChecks: checkStats.totalChecks,
        totalDictionaries,
        totalOrganizations,
        activeUsers,
        checksThisMonth: checkStats.checksThisMonth,
        totalViolations,
        errorRate: checkStats.errorRate.toFixed(2)
      },
      recentActivity: checkStats.recentChecks.map(check => ({
        id: check.id,
        action: 'チェック実行',
        user: check.users?.email ?? 'Unknown User',
        text: check.original_text.substring(0, 50) + (check.original_text.length > 50 ? '...' : ''),
        status: check.status,
        timestamp: check.created_at
      })),
      dailyChecks: dailyCheckData
    })
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}