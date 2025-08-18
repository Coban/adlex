import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  // 認証チェック
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 管理者権限チェック
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userData?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // 過去24時間のチェック処理時間を取得
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { data: checks } = await supabase
      .from('checks')
      .select('id, created_at, completed_at, status')
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false })

    // 処理時間の計算
    const processingTimes = checks?.map(check => {
      if (check.status === 'completed' && check.completed_at && check.created_at) {
        const start = new Date(check.created_at).getTime()
        const end = new Date(check.completed_at).getTime()
        return (end - start) / 1000 // 秒単位
      }
      return null
    }).filter(Boolean) ?? []

    // 統計計算
    const avgProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((a, b) => a! + b!, 0)! / processingTimes.length
      : 0

    const maxProcessingTime = processingTimes.length > 0
      ? Math.max(...processingTimes as number[])
      : 0

    const minProcessingTime = processingTimes.length > 0
      ? Math.min(...processingTimes as number[])
      : 0

    // ステータス別の集計
    const statusCounts = checks?.reduce((acc: Record<string, number>, check) => {
      const status = check.status ?? 'unknown'
      acc[status] = (acc[status] ?? 0) + 1
      return acc
    }, {}) ?? {}

    // 時間帯別のチェック数
    const hourlyChecks = checks?.reduce((acc: Record<string, number>, check) => {
      const hour = new Date(check.created_at ?? '').getHours()
      const key = `${hour}:00`
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {}) ?? {}

    // 過去24時間の時間配列を作成
    const hours = Array.from({ length: 24 }, (_, i) => {
      const hour = new Date()
      hour.setHours(hour.getHours() - (23 - i))
      return `${hour.getHours()}:00`
    })

    const hourlyData = hours.map(hour => ({
      hour,
      count: hourlyChecks[hour] ?? 0
    }))

    // システムヘルス指標
    const successRate = statusCounts.completed 
      ? (statusCounts.completed / (checks?.length ?? 1)) * 100
      : 0

    const errorRate = statusCounts.error
      ? (statusCounts.error / (checks?.length ?? 1)) * 100
      : 0

    return NextResponse.json({
      performance: {
        avgProcessingTime: avgProcessingTime.toFixed(2),
        maxProcessingTime: maxProcessingTime.toFixed(2),
        minProcessingTime: minProcessingTime.toFixed(2),
        totalChecks24h: checks?.length ?? 0,
        successRate: successRate.toFixed(2),
        errorRate: errorRate.toFixed(2)
      },
      statusBreakdown: statusCounts,
      hourlyActivity: hourlyData,
      systemHealth: {
        status: errorRate < 5 ? 'healthy' : errorRate < 10 ? 'warning' : 'critical',
        uptime: '99.9%', // これは実際のモニタリングシステムから取得する必要があります
        lastIncident: null
      }
    })
  } catch (error) {
    console.error('Error fetching performance metrics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}