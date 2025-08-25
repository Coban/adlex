'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from 'recharts'

import { authFetch } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ViolationStats {
  totalViolations: number
  checksWithViolations: number
  averageViolationsPerCheck: string
  maxViolationsInSingleCheck: number
  violationRate: string
}

interface HistoryStats {
  period: string
  startDate: string
  endDate: string
  totalChecks: number
  statusBreakdown: {
    pending: number
    processing: number
    completed: number
    failed: number
  }
  inputTypeBreakdown: {
    text: number
    image: number
  }
  violationStats: ViolationStats
  dailyActivity: Record<string, number>
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

const statusLabels = {
  pending: '待機中',
  processing: '処理中', 
  completed: '完了',
  failed: 'エラー'
}

// Pie チャートのラベルフォーマッター
const pieLabelFormatter = ({name = '', value = 0, percent = 0}: {name?: string, value?: number, percent?: number}) => {
  return `${name}: ${value} (${percent.toFixed(0)}%)`
}

export default function CheckHistoryStats() {
  const [stats, setStats] = useState<HistoryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('month')

  const fetchStats = async (selectedPeriod: string) => {
    try {
      setLoading(true)
      const response = await authFetch(`/api/check-history/stats?period=${selectedPeriod}`)
      
      if (!response.ok) {
        throw new Error('統計データの取得に失敗しました')
      }

      const data = await response.json()
      setStats(data.stats)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats(period)
  }, [period])

  const handlePeriodChange = (value: string) => {
    setPeriod(value)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">統計を読み込んでいます...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-gray-600">統計データがありません</p>
        </div>
      </div>
    )
  }

  // Prepare chart data
  const statusChartData = Object.entries(stats.statusBreakdown).map(([status, count]) => ({
    name: statusLabels[status as keyof typeof statusLabels],
    value: count,
    status
  }))

  const inputTypeChartData = Object.entries(stats.inputTypeBreakdown).map(([type, count]) => ({
    name: type === 'text' ? 'テキスト' : '画像',
    value: count
  }))

  const dailyActivityData = Object.entries(stats.dailyActivity)
    .slice(-14) // Show last 14 days
    .map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' }),
      count
    }))

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">チェック履歴統計</h2>
        <Select value={period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="期間を選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">今週</SelectItem>
            <SelectItem value="month">今月</SelectItem>
            <SelectItem value="quarter">今四半期</SelectItem>
            <SelectItem value="year">今年</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総チェック数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalChecks}</div>
            <p className="text-xs text-muted-foreground">
              {period === 'week' ? '今週' : period === 'month' ? '今月' : period === 'quarter' ? '今四半期' : '今年'}の実行数
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">違反検出数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.violationStats.totalViolations}</div>
            <p className="text-xs text-muted-foreground">
              {stats.violationStats.checksWithViolations}件のチェックで検出
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">違反率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.violationStats.violationRate}%</div>
            <p className="text-xs text-muted-foreground">
              平均 {stats.violationStats.averageViolationsPerCheck}件/チェック
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">完了率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalChecks > 0 ? ((stats.statusBreakdown.completed / stats.totalChecks) * 100).toFixed(1) : '0'}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.statusBreakdown.completed}/{stats.totalChecks}件完了
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>ステータス別内訳</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={pieLabelFormatter}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Input Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>入力タイプ別内訳</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={inputTypeChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Daily Activity */}
      <Card>
        <CardHeader>
          <CardTitle>日別アクティビティ（直近14日間）</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyActivityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Violation Details */}
      <Card>
        <CardHeader>
          <CardTitle>違反検出詳細</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">総違反数:</span>
              <div className="text-lg font-semibold">{stats.violationStats.totalViolations}</div>
            </div>
            <div>
              <span className="font-medium text-gray-700">違反検出チェック数:</span>
              <div className="text-lg font-semibold">{stats.violationStats.checksWithViolations}</div>
            </div>
            <div>
              <span className="font-medium text-gray-700">平均違反数/チェック:</span>
              <div className="text-lg font-semibold">{stats.violationStats.averageViolationsPerCheck}</div>
            </div>
            <div>
              <span className="font-medium text-gray-700">最大違反数（単一チェック）:</span>
              <div className="text-lg font-semibold">{stats.violationStats.maxViolationsInSingleCheck}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}