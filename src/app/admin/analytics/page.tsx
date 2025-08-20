'use client'

import { 
  Users,
  FileText,
  CheckCircle,
  Clock,
  Download
} from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface AnalyticsData {
  usageStats: {
    totalChecks: number
    checksThisMonth: number
    checksLastMonth: number
    avgChecksPerDay: number
    peakHour: number
  }
  userBehavior: {
    activeUsers: number
    newUsers: number
    retentionRate: number
    avgSessionDuration: number
  }
  qualityMetrics: {
    avgViolationsPerCheck: number
    mostCommonViolations: Array<{
      type: string
      count: number
      percentage: number
    }>
    accuracyRate: number
  }
  performanceMetrics: {
    avgProcessingTime: number
    successRate: number
    errorRate: number
    uptimePercentage: number
  }
}

interface RevenueData {
  monthlyRevenue: number
  annualRevenue: number
  averageRevenuePerUser: number
  churnRate: number
  customerLifetimeValue: number
}

const mockAnalyticsData: AnalyticsData = {
  usageStats: {
    totalChecks: 15432,
    checksThisMonth: 2341,
    checksLastMonth: 1987,
    avgChecksPerDay: 78,
    peakHour: 14
  },
  userBehavior: {
    activeUsers: 234,
    newUsers: 45,
    retentionRate: 85.3,
    avgSessionDuration: 12.5
  },
  qualityMetrics: {
    avgViolationsPerCheck: 2.3,
    mostCommonViolations: [
      { type: '効果・効能の誇大表現', count: 1234, percentage: 35.2 },
      { type: '医薬品的な効果の暗示', count: 987, percentage: 28.1 },
      { type: '特定部位への言及', count: 654, percentage: 18.7 },
      { type: '即効性の表現', count: 432, percentage: 12.3 },
      { type: 'その他', count: 198, percentage: 5.7 }
    ],
    accuracyRate: 94.7
  },
  performanceMetrics: {
    avgProcessingTime: 2.8,
    successRate: 98.5,
    errorRate: 1.5,
    uptimePercentage: 99.9
  }
}

const mockRevenueData: RevenueData = {
  monthlyRevenue: 1250000,
  annualRevenue: 14800000,
  averageRevenuePerUser: 8900,
  churnRate: 3.2,
  customerLifetimeValue: 45600
}

export default function AnalyticsPage() {
  const [analyticsData] = useState<AnalyticsData>(mockAnalyticsData)
  const [revenueData] = useState<RevenueData>(mockRevenueData)
  const [timeRange, setTimeRange] = useState('30d')
  const [loading, setLoading] = useState(false)

  const exportReport = async (type: string) => {
    setLoading(true)
    try {
      // レポートエクスポート処理をシミュレート
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // 実際の実装では、ここでAPIを呼び出してレポートを生成・ダウンロード
      const reportData = {
        type,
        timeRange,
        generatedAt: new Date().toISOString(),
        data: analyticsData
      }
      
      const blob = new Blob([JSON.stringify(reportData, null, 2)], {
        type: 'application/json'
      })
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `adlex-report-${type}-${timeRange}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY'
    }).format(amount)
  }

  const growthRate = ((analyticsData.usageStats.checksThisMonth - analyticsData.usageStats.checksLastMonth) / analyticsData.usageStats.checksLastMonth * 100).toFixed(1)

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">分析レポート</h1>
          <p className="text-muted-foreground">システム利用状況と業務分析</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">過去7日</SelectItem>
              <SelectItem value="30d">過去30日</SelectItem>
              <SelectItem value="90d">過去90日</SelectItem>
              <SelectItem value="1y">過去1年</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => exportReport('usage')} disabled={loading}>
            <Download className="h-4 w-4 mr-2" />
            {loading ? 'エクスポート中...' : 'レポート出力'}
          </Button>
        </div>
      </div>

      {/* 主要KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総チェック数</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.usageStats.totalChecks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <span className={`${parseFloat(growthRate) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {parseFloat(growthRate) >= 0 ? '+' : ''}{growthRate}%
              </span> 前月比
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">アクティブユーザー</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.userBehavior.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              新規ユーザー: {analyticsData.userBehavior.newUsers}人
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">成功率</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.performanceMetrics.successRate}%</div>
            <p className="text-xs text-muted-foreground">
              稼働率: {analyticsData.performanceMetrics.uptimePercentage}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均処理時間</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.performanceMetrics.avgProcessingTime}秒</div>
            <p className="text-xs text-muted-foreground">
              エラー率: {analyticsData.performanceMetrics.errorRate}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList className="grid w-full max-w-[600px] grid-cols-4">
          <TabsTrigger value="usage">利用統計</TabsTrigger>
          <TabsTrigger value="quality">品質分析</TabsTrigger>
          <TabsTrigger value="users">ユーザー分析</TabsTrigger>
          <TabsTrigger value="revenue">売上分析</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>利用トレンド</CardTitle>
                <CardDescription>チェック実行数の推移</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">今月</span>
                    <span className="font-medium">{analyticsData.usageStats.checksThisMonth}回</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">先月</span>
                    <span className="font-medium">{analyticsData.usageStats.checksLastMonth}回</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">1日平均</span>
                    <span className="font-medium">{analyticsData.usageStats.avgChecksPerDay}回</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">ピーク時間</span>
                    <span className="font-medium">{analyticsData.usageStats.peakHour}:00-{analyticsData.usageStats.peakHour + 1}:00</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>時間帯別利用状況</CardTitle>
                <CardDescription>24時間の利用パターン</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Array.from({ length: 12 }, (_, i) => {
                    const hour = i * 2
                    const usage = hour === analyticsData.usageStats.peakHour ? 100 : Math.random() * 80 + 10
                    return (
                      <div key={hour} className="flex items-center justify-between text-sm">
                        <span className="w-16">{hour}:00-{hour + 2}:00</span>
                        <div className="flex-1 mx-4">
                          <Progress value={usage} className="h-2" />
                        </div>
                        <span className="w-16 text-right">{Math.round(usage * 3)}回</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>違反タイプ分布</CardTitle>
                <CardDescription>検出された違反の種類と件数</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.qualityMetrics.mostCommonViolations.map((violation, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{violation.type}</span>
                        <span className="text-sm text-muted-foreground">
                          {violation.count}件 ({violation.percentage}%)
                        </span>
                      </div>
                      <Progress value={violation.percentage} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>品質指標</CardTitle>
                <CardDescription>AI検出精度と品質メトリクス</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">検出精度</span>
                      <span className="text-sm font-medium">{analyticsData.qualityMetrics.accuracyRate}%</span>
                    </div>
                    <Progress value={analyticsData.qualityMetrics.accuracyRate} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">平均違反数/チェック</span>
                      <span className="text-sm font-medium">{analyticsData.qualityMetrics.avgViolationsPerCheck}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {analyticsData.performanceMetrics.successRate}%
                      </div>
                      <div className="text-xs text-muted-foreground">成功率</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {analyticsData.performanceMetrics.errorRate}%
                      </div>
                      <div className="text-xs text-muted-foreground">エラー率</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>ユーザー行動分析</CardTitle>
                <CardDescription>ユーザーの利用パターン</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">リテンション率</span>
                    <span className="font-medium">{analyticsData.userBehavior.retentionRate}%</span>
                  </div>
                  <Progress value={analyticsData.userBehavior.retentionRate} className="h-2" />

                  <div className="flex justify-between items-center">
                    <span className="text-sm">平均セッション時間</span>
                    <span className="font-medium">{analyticsData.userBehavior.avgSessionDuration}分</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div>
                      <div className="text-2xl font-bold">{analyticsData.userBehavior.activeUsers}</div>
                      <div className="text-xs text-muted-foreground">アクティブユーザー</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{analyticsData.userBehavior.newUsers}</div>
                      <div className="text-xs text-muted-foreground">新規ユーザー</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>ユーザーセグメント</CardTitle>
                <CardDescription>利用度別ユーザー分類</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">ヘビーユーザー</span>
                      <span className="text-sm">28% (65人)</span>
                    </div>
                    <Progress value={28} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">レギュラーユーザー</span>
                      <span className="text-sm">45% (105人)</span>
                    </div>
                    <Progress value={45} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">ライトユーザー</span>
                      <span className="text-sm">27% (64人)</span>
                    </div>
                    <Progress value={27} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>売上指標</CardTitle>
                <CardDescription>収益とビジネスメトリクス</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">月間売上</span>
                    <span className="font-medium">{formatCurrency(revenueData.monthlyRevenue)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">年間売上</span>
                    <span className="font-medium">{formatCurrency(revenueData.annualRevenue)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">ARPU</span>
                    <span className="font-medium">{formatCurrency(revenueData.averageRevenuePerUser)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">LTV</span>
                    <span className="font-medium">{formatCurrency(revenueData.customerLifetimeValue)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>顧客動向</CardTitle>
                <CardDescription>解約率と顧客維持</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">解約率</span>
                      <span className="text-sm font-medium">{revenueData.churnRate}%</span>
                    </div>
                    <Progress value={revenueData.churnRate} className="h-2" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-xl font-bold text-green-700 dark:text-green-300">
                        {(100 - revenueData.churnRate).toFixed(1)}%
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400">顧客維持率</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                        {Math.round(revenueData.customerLifetimeValue / revenueData.averageRevenuePerUser)}
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400">平均利用期間</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>プラン別分析</CardTitle>
              <CardDescription>料金プラン別の収益分布</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { plan: 'エンタープライズ', revenue: 8500000, users: 15, percentage: 57.4 },
                  { plan: 'プロフェッショナル', revenue: 4200000, users: 35, percentage: 28.4 },
                  { plan: 'スタンダード', revenue: 1800000, users: 78, percentage: 12.2 },
                  { plan: 'ベーシック', revenue: 300000, users: 116, percentage: 2.0 }
                ].map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.plan}</span>
                        <Badge variant="outline">{item.users}社</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(item.revenue)} ({item.percentage}%)
                      </span>
                    </div>
                    <Progress value={item.percentage} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}