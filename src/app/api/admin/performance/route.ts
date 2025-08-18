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
    // Use repository to get performance metrics
    const performanceMetrics = await repositories.checks.getPerformanceMetrics()

    return NextResponse.json({
      performance: {
        avgProcessingTime: performanceMetrics.avgProcessingTime.toFixed(2),
        maxProcessingTime: performanceMetrics.maxProcessingTime.toFixed(2),
        minProcessingTime: performanceMetrics.minProcessingTime.toFixed(2),
        totalChecks24h: performanceMetrics.totalChecks24h,
        successRate: performanceMetrics.successRate.toFixed(2),
        errorRate: performanceMetrics.errorRate.toFixed(2)
      },
      statusBreakdown: performanceMetrics.statusBreakdown,
      hourlyActivity: performanceMetrics.hourlyActivity,
      systemHealth: {
        status: performanceMetrics.errorRate < 5 ? 'healthy' : performanceMetrics.errorRate < 10 ? 'warning' : 'critical',
        uptime: '99.9%', // これは実際のモニタリングシステムから取得する必要があります
        lastIncident: null
      }
    })
  } catch (error) {
    console.error('Error fetching performance metrics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}