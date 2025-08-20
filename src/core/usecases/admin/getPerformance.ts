import { AuthenticationError, ValidationError, AuthorizationError } from '@/core/domain/errors'
import { RepositoryContainer } from '@/core/ports'

/**
 * Admin パフォーマンス取得のユースケース入力
 */
export interface GetAdminPerformanceInput {
  currentUserId: string
  period?: 'day' | 'week' | 'month'
  limit?: number
  organizationId?: number
}

/**
 * Admin パフォーマンス取得のユースケース出力
 */
export interface GetAdminPerformanceOutput {
  metrics: Array<{
    timestamp: string
    responseTime: number
    throughput: number
    errorRate: number
    memoryUsage: number
    cpuUsage: number
  }>
  summary: {
    averageResponseTime: number
    averageThroughput: number
    averageErrorRate: number
    peakResponseTime: number
    peakThroughput: number
  }
  alerts: Array<{
    type: 'performance' | 'error' | 'resource'
    severity: 'low' | 'medium' | 'high' | 'critical'
    message: string
    timestamp: string
  }>
}

/**
 * Admin パフォーマンス取得のユースケース結果
 */
export type GetAdminPerformanceResult = 
  | { success: true; data: GetAdminPerformanceOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * Admin パフォーマンス取得ユースケース
 */
export class GetAdminPerformanceUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: GetAdminPerformanceInput): Promise<GetAdminPerformanceResult> {
    try {
      // 入力バリデーション
      const validationError = this.validateInput(input)
      if (validationError) {
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: validationError }
        }
      }

      // 現在のユーザーを取得して管理者権限確認
      const currentUser = await this.repositories.users.findById(input.currentUserId)
      if (!currentUser) {
        return {
          success: false,
          error: { code: 'AUTHENTICATION_ERROR', message: 'ユーザーが見つかりません' }
        }
      }

      // システム管理者権限確認
      if (currentUser.role !== 'admin') {
        return {
          success: false,
          error: { code: 'AUTHORIZATION_ERROR', message: 'システム管理者権限が必要です' }
        }
      }

      // パフォーマンスデータの取得
      const period = input.period ?? 'day'
      const limit = input.limit ?? 10

      const [metrics, alerts] = await Promise.all([
        this.getPerformanceMetrics(period, limit),
        this.getSystemAlerts()
      ])

      const summary = this.calculateSummary(metrics)

      return {
        success: true,
        data: {
          metrics,
          summary,
          alerts
        }
      }

    } catch (error) {
      console.error('Get admin performance usecase error:', error)
      
      if (error instanceof AuthenticationError || error instanceof ValidationError || error instanceof AuthorizationError) {
        return {
          success: false,
          error: { code: error.code, message: error.message }
        }
      }

      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '内部エラーが発生しました' }
      }
    }
  }

  /**
   * 入力値のバリデーション
   */
  private validateInput(input: GetAdminPerformanceInput): string | null {
    if (!input.currentUserId || typeof input.currentUserId !== 'string') {
      return 'ユーザーIDが無効です'
    }

    if (input.period && !['day', 'week', 'month'].includes(input.period)) {
      return '期間の指定が無効です'
    }

    if (input.limit && (typeof input.limit !== 'number' || input.limit < 1 || input.limit > 100)) {
      return '取得件数の指定が無効です'
    }

    if (input.organizationId && typeof input.organizationId !== 'number') {
      return '組織IDが無効です'
    }

    return null
  }

  /**
   * パフォーマンスメトリクスを取得
   */
  private async getPerformanceMetrics(period: string, limit: number): Promise<Array<{
    timestamp: string
    responseTime: number
    throughput: number
    errorRate: number
    memoryUsage: number
    cpuUsage: number
  }>> {
    try {
      // 簡易実装: モックデータを生成
      const metrics = []
      const now = new Date()
      
      for (let i = 0; i < limit; i++) {
        const timestamp = new Date(now.getTime() - (i * this.getIntervalMs(period)))
        
        // ランダムだが現実的なメトリクス値を生成
        const baseResponseTime = 150
        const responseTime = baseResponseTime + (Math.random() * 100 - 50) // 100-200ms
        const throughput = 50 + (Math.random() * 100) // 50-150 req/sec
        const errorRate = Math.random() * 5 // 0-5%
        const memoryUsage = 60 + (Math.random() * 30) // 60-90%
        const cpuUsage = 30 + (Math.random() * 40) // 30-70%

        metrics.push({
          timestamp: timestamp.toISOString(),
          responseTime: Math.round(responseTime),
          throughput: Math.round(throughput),
          errorRate: Math.round(errorRate * 100) / 100,
          memoryUsage: Math.round(memoryUsage),
          cpuUsage: Math.round(cpuUsage)
        })
      }

      return metrics.reverse() // 古い順に並び替え
    } catch (error) {
      console.warn('Failed to get performance metrics:', error)
      return []
    }
  }

  /**
   * システムアラートを取得
   */
  private async getSystemAlerts(): Promise<Array<{
    type: 'performance' | 'error' | 'resource'
    severity: 'low' | 'medium' | 'high' | 'critical'
    message: string
    timestamp: string
  }>> {
    try {
      // 簡易実装: モックアラートデータを生成
      const now = new Date()
      const alerts = []

      // 現在のシステム状態に基づいてアラートを生成
      const memoryUsage = process.memoryUsage()
      const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100

      if (memoryUsagePercent > 80) {
        alerts.push({
          type: 'resource' as const,
          severity: 'high' as const,
          message: 'メモリ使用率が高くなっています',
          timestamp: now.toISOString()
        })
      }

      // 追加のモックアラート
      if (Math.random() > 0.7) {
        alerts.push({
          type: 'performance' as const,
          severity: 'medium' as const,
          message: 'API レスポンス時間が平均を上回っています',
          timestamp: new Date(now.getTime() - 30000).toISOString()
        })
      }

      return alerts
    } catch (error) {
      console.warn('Failed to get system alerts:', error)
      return []
    }
  }

  /**
   * メトリクスサマリーを計算
   */
  private calculateSummary(metrics: Array<{
    responseTime: number
    throughput: number
    errorRate: number
  }>): {
    averageResponseTime: number
    averageThroughput: number
    averageErrorRate: number
    peakResponseTime: number
    peakThroughput: number
  } {
    if (metrics.length === 0) {
      return {
        averageResponseTime: 0,
        averageThroughput: 0,
        averageErrorRate: 0,
        peakResponseTime: 0,
        peakThroughput: 0
      }
    }

    const responseTimes = metrics.map(m => m.responseTime)
    const throughputs = metrics.map(m => m.throughput)
    const errorRates = metrics.map(m => m.errorRate)

    return {
      averageResponseTime: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
      averageThroughput: Math.round(throughputs.reduce((a, b) => a + b, 0) / throughputs.length),
      averageErrorRate: Math.round((errorRates.reduce((a, b) => a + b, 0) / errorRates.length) * 100) / 100,
      peakResponseTime: Math.max(...responseTimes),
      peakThroughput: Math.max(...throughputs)
    }
  }

  /**
   * 期間に応じたインターバル（ミリ秒）を取得
   */
  private getIntervalMs(period: string): number {
    switch (period) {
      case 'day':
        return 1000 * 60 * 60 // 1時間間隔
      case 'week':
        return 1000 * 60 * 60 * 24 // 1日間隔
      case 'month':
        return 1000 * 60 * 60 * 24 * 7 // 1週間間隔
      default:
        return 1000 * 60 * 60 // 1時間間隔
    }
  }
}