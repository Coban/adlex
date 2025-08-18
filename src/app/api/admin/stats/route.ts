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
    // 並列でデータを取得
    const [
      usersResult,
      checksResult,
      dictionariesResult,
      organizationsResult,
      activeUsersResult,
      checksThisMonthResult,
      violationsResult,
      recentChecksResult
    ] = await Promise.all([
      // 総ユーザー数
      supabase.from('users').select('id', { count: 'exact', head: true }),
      
      // 総チェック数
      supabase.from('checks').select('id', { count: 'exact', head: true }),
      
      // 総辞書エントリ数
      supabase.from('dictionaries').select('id', { count: 'exact', head: true }),
      
      // 組織数
      supabase.from('organizations').select('id', { count: 'exact', head: true }),
      
      // アクティブユーザー数（過去30日間）
      supabase
        .from('checks')
        .select('user_id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      
      // 今月のチェック数
      supabase
        .from('checks')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      
      // 検出された違反数
      supabase.from('violations').select('id', { count: 'exact', head: true }),
      
      // 最近のチェック（上位5件）
      supabase
        .from('checks')
        .select(`
          id,
          status,
          created_at,
          users (
            display_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5)
    ])

    // エラー率の計算（過去7日間）
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentChecks } = await supabase
      .from('checks')
      .select('status')
      .gte('created_at', sevenDaysAgo)

    const errorRate = recentChecks
      ? (recentChecks.filter(c => c.status === 'failed').length / recentChecks.length) * 100
      : 0

    // 日別チェック数（過去7日間）
    const { data: dailyChecks } = await supabase
      .from('checks')
      .select('created_at')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: true })

    // 日別にグループ化
    const checksByDay = dailyChecks?.reduce((acc: Record<string, number>, check) => {
      const date = new Date(check.created_at ?? '').toLocaleDateString('ja-JP')
      acc[date] = (acc[date] ?? 0) + 1
      return acc
    }, {}) ?? {}

    // 過去7日間の日付配列を作成
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      return date.toLocaleDateString('ja-JP')
    })

    const dailyCheckData = last7Days.map(date => ({
      date,
      count: checksByDay[date] ?? 0
    }))

    return NextResponse.json({
      stats: {
        totalUsers: usersResult.count ?? 0,
        totalChecks: checksResult.count ?? 0,
        totalDictionaries: dictionariesResult.count ?? 0,
        totalOrganizations: organizationsResult.count ?? 0,
        activeUsers: activeUsersResult.count ?? 0,
        checksThisMonth: checksThisMonthResult.count ?? 0,
        totalViolations: violationsResult.count ?? 0,
        errorRate: errorRate.toFixed(2)
      },
      recentActivity: recentChecksResult.data?.map(check => ({
        id: check.id,
        action: 'チェック実行',
        user: 'Unknown User',
        text: 'チェック実行',
        status: check.status,
        timestamp: check.created_at
      })) ?? [],
      dailyChecks: dailyCheckData
    })
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}