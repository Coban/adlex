'use client'

import { useState, useEffect } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'

interface DashboardStats {
  totalUsers: number
  totalChecks: number
  totalDictionaries: number
  activeUsers: number
  checksThisMonth: number
  organizationCount: number
}

export default function AdminDashboard() {
  const { organization, userProfile, loading: authLoading } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalChecks: 0,
    totalDictionaries: 0,
    activeUsers: 0,
    checksThisMonth: 0,
    organizationCount: 0
  })
  const [loading, setLoading] = useState(true)
  const [recentActivity, setRecentActivity] = useState<Array<{
    id: number
    action: string
    user: string
    timestamp: Date
  }>>([])

  useEffect(() => {
    const loadStats = async () => {
      try {
        // Mock data for testing
        setStats({
          totalUsers: 25,
          totalChecks: 1432,
          totalDictionaries: 156,
          activeUsers: 18,
          checksThisMonth: 234,
          organizationCount: 5
        })
        
        setRecentActivity([
          { id: 1, action: 'ユーザー登録', user: 'test@example.com', timestamp: new Date() },
          { id: 2, action: 'チェック実行', user: 'admin@test.com', timestamp: new Date() },
          { id: 3, action: '辞書更新', user: 'manager@test.com', timestamp: new Date() }
        ])
      } catch {
        // Error loading stats - fallback to empty state
      } finally {
        setLoading(false)
      }
    }

    if (userProfile?.role === 'admin') {
      loadStats()
    } else {
      setLoading(false)
    }
  }, [organization, userProfile])

  if (loading || authLoading) {
    return <div className="p-6">読み込み中...</div>
  }

  if (!userProfile || userProfile.role !== 'admin') {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">アクセスが拒否されました</h1>
          <p>このページにアクセスするには管理者権限が必要です。</p>
          {process.env.NODE_ENV !== 'production' && (
            <pre className="mt-4 text-xs text-gray-500 text-left">
              Debug: userProfile={JSON.stringify(userProfile, null, 2)}
            </pre>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">管理ダッシュボード</h1>
          <p className="text-muted-foreground">システム全体の統計情報と管理機能</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="stats-cards">
        <Card data-testid="total-users">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総ユーザー数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              アクティブユーザー: {stats.activeUsers}人
            </p>
          </CardContent>
        </Card>

        <Card data-testid="total-checks">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総チェック数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalChecks}</div>
            <p className="text-xs text-muted-foreground">
              今月: {stats.checksThisMonth}回
            </p>
          </CardContent>
        </Card>

        <Card data-testid="active-users">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">アクティブユーザー数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              全体の{Math.round((stats.activeUsers / stats.totalUsers) * 100)}%
            </p>
          </CardContent>
        </Card>

        <Card data-testid="usage-limit">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今月の利用状況</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.checksThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              チェック実行数
            </p>
          </CardContent>
        </Card>

        <Card data-testid="total-dictionaries">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">辞書エントリ数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDictionaries}</div>
            <p className="text-xs text-muted-foreground">
              全組織合計
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage Statistics */}
        <Card data-testid="usage-stats">
          <CardHeader>
            <CardTitle>利用状況統計</CardTitle>
            <CardDescription>システム利用状況の詳細</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span>組織数</span>
              <span className="font-semibold">{stats.organizationCount}</span>
            </div>
            <div className="flex justify-between">
              <span>月間チェック数</span>
              <span className="font-semibold">{stats.checksThisMonth}</span>
            </div>
            <div className="flex justify-between">
              <span>アクティブ率</span>
              <span className="font-semibold">
                {Math.round((stats.activeUsers / stats.totalUsers) * 100)}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card data-testid="recent-activity">
          <CardHeader>
            <CardTitle>最近のアクティビティ</CardTitle>
            <CardDescription>システム内の最新活動</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex justify-between items-center text-sm" data-testid="activity-item">
                  <div>
                    <span className="font-medium">{activity.action}</span>
                    <span className="text-muted-foreground ml-2">by {activity.user}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(activity.timestamp).toLocaleTimeString('ja-JP')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}