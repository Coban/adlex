'use client'

import { 
  Users, 
  FileText, 
  Activity, 
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { authFetch } from '@/lib/api-client'

interface DashboardData {
  stats: {
    totalUsers: number
    totalChecks: number
    totalDictionaries: number
    totalOrganizations: number
    activeUsers: number
    checksThisMonth: number
    totalViolations: number
    errorRate: string
  }
  recentActivity: Array<{
    id: string
    action: string
    user: string
    text: string
    status: string
    timestamp: string
  }>
  dailyChecks: Array<{
    date: string
    count: number
  }>
}

interface PerformanceData {
  performance: {
    avgProcessingTime: string
    maxProcessingTime: string
    minProcessingTime: string
    totalChecks24h: number
    successRate: string
    errorRate: string
  }
  statusBreakdown: Record<string, number>
  hourlyActivity: Array<{
    hour: string
    count: number
  }>
  systemHealth: {
    status: 'healthy' | 'warning' | 'critical'
    uptime: string
    lastIncident: string | null
  }
}

export function DashboardStats() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, perfRes] = await Promise.all([
          authFetch('/api/admin/stats'),
          authFetch('/api/admin/performance')
        ])

        if (!statsRes.ok || !perfRes.ok) {
          throw new Error('Failed to fetch data')
        }

        const [statsData, perfData] = await Promise.all([
          statsRes.json(),
          perfRes.json()
        ])

        setDashboardData(statsData)
        setPerformanceData(perfData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'エラーが発生しました')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    // 30秒ごとに自動更新
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">データを読み込んでいます...</p>
        </div>
      </div>
    )
  }

  if (error || !dashboardData || !performanceData) {
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>データの読み込みに失敗しました</p>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600'
      case 'warning': return 'text-yellow-600'
      case 'critical': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge variant="default">完了</Badge>
      case 'processing': return <Badge variant="secondary">処理中</Badge>
      case 'error': return <Badge variant="destructive">エラー</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* システムヘルス */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            システムヘルス
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">ステータス</p>
              <p className={`text-2xl font-bold ${getHealthColor(performanceData.systemHealth.status)}`}>
                {performanceData.systemHealth.status === 'healthy' ? '正常' : 
                 performanceData.systemHealth.status === 'warning' ? '警告' : 'クリティカル'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">稼働率</p>
              <p className="text-2xl font-bold">{performanceData.systemHealth.uptime}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">成功率</p>
              <p className="text-2xl font-bold text-green-600">{performanceData.performance.successRate}%</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">エラー率</p>
              <p className="text-2xl font-bold text-red-600">{performanceData.performance.errorRate}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 主要統計 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総ユーザー数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              アクティブ: {dashboardData.stats.activeUsers}人
            </p>
            <Progress 
              value={(dashboardData.stats.activeUsers / dashboardData.stats.totalUsers) * 100} 
              className="mt-2 h-1"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今月のチェック</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.stats.checksThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              総計: {dashboardData.stats.totalChecks}回
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均処理時間</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceData.performance.avgProcessingTime}秒</div>
            <p className="text-xs text-muted-foreground">
              最小: {performanceData.performance.minProcessingTime}秒 / 最大: {performanceData.performance.maxProcessingTime}秒
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">検出違反数</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.stats.totalViolations}</div>
            <p className="text-xs text-muted-foreground">
              辞書エントリ: {dashboardData.stats.totalDictionaries}件
            </p>
          </CardContent>
        </Card>
      </div>

      {/* タブ付き詳細情報 */}
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList className="grid w-full max-w-[400px] grid-cols-3">
          <TabsTrigger value="activity">アクティビティ</TabsTrigger>
          <TabsTrigger value="performance">パフォーマンス</TabsTrigger>
          <TabsTrigger value="usage">利用状況</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>最近のチェック履歴</CardTitle>
              <CardDescription>直近のチェック実行状況</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start justify-between border-b pb-3 last:border-0">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{activity.user}</p>
                        {getStatusBadge(activity.status)}
                      </div>
                      <p className="text-sm text-muted-foreground truncate max-w-md">
                        {activity.text}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleString('ja-JP')}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>処理ステータス分布</CardTitle>
              <CardDescription>過去24時間のステータス別集計</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(performanceData.statusBreakdown).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {status === 'completed' && <CheckCircle className="h-4 w-4 text-green-600" />}
                      {status === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
                      {status === 'processing' && <Clock className="h-4 w-4 text-yellow-600" />}
                      <span className="capitalize">{status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{count}件</span>
                      <Progress 
                        value={(count / performanceData.performance.totalChecks24h) * 100} 
                        className="w-24 h-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>時間帯別アクティビティ</CardTitle>
              <CardDescription>過去24時間の時間帯別チェック数</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {performanceData.hourlyActivity.slice(-12).map((hour) => (
                  <div key={hour.hour} className="flex items-center justify-between text-sm">
                    <span className="w-12">{hour.hour}</span>
                    <div className="flex-1 mx-2">
                      <Progress value={(hour.count / 10) * 100} className="h-2" />
                    </div>
                    <span className="w-12 text-right">{hour.count}件</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>日別チェック数</CardTitle>
              <CardDescription>過去7日間の利用状況</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboardData.dailyChecks.map((day) => (
                  <div key={day.date} className="flex items-center justify-between">
                    <span className="text-sm">{day.date}</span>
                    <div className="flex items-center gap-2">
                      <Progress value={(day.count / 50) * 100} className="w-32 h-2" />
                      <span className="text-sm font-medium w-12 text-right">{day.count}件</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>組織別統計</CardTitle>
              <CardDescription>組織ごとの利用状況</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>総組織数</span>
                  <span className="font-semibold">{dashboardData.stats.totalOrganizations}</span>
                </div>
                <div className="flex justify-between">
                  <span>アクティブ組織</span>
                  <span className="font-semibold">
                    {Math.ceil(dashboardData.stats.totalOrganizations * 0.8)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>平均ユーザー数/組織</span>
                  <span className="font-semibold">
                    {Math.ceil(dashboardData.stats.totalUsers / dashboardData.stats.totalOrganizations)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}