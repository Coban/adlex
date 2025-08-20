import { AuthenticationError, ValidationError } from '@/core/domain/errors'
import { RepositoryContainer } from '@/core/ports'

/**
 * チェック履歴統計取得のユースケース入力
 */
export interface GetCheckHistoryStatsInput {
  currentUserId: string
  period?: 'day' | 'week' | 'month' | 'year'
  organizationId?: number
}

/**
 * チェック履歴統計取得のユースケース出力
 */
export interface GetCheckHistoryStatsOutput {
  totalChecks: number
  totalViolations: number
  averageViolationsPerCheck: number
  statusBreakdown: {
    completed: number
    failed: number
    processing: number
    pending: number
  }
  violationTrends: Array<{
    date: string
    count: number
    violationCount: number
  }>
  topViolationTypes: Array<{
    category: string
    count: number
    percentage: number
  }>
  processingTimeStats: {
    average: number
    median: number
    min: number
    max: number
  }
}

/**
 * チェック履歴統計取得のユースケース結果
 */
export type GetCheckHistoryStatsResult = 
  | { success: true; data: GetCheckHistoryStatsOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * チェック履歴統計取得ユースケース
 */
export class GetCheckHistoryStatsUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: GetCheckHistoryStatsInput): Promise<GetCheckHistoryStatsResult> {
    try {
      // 入力バリデーション
      const validationError = this.validateInput(input)
      if (validationError) {
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: validationError }
        }
      }

      // 現在のユーザーを取得
      const currentUser = await this.repositories.users.findById(input.currentUserId)
      if (!currentUser) {
        return {
          success: false,
          error: { code: 'AUTHENTICATION_ERROR', message: 'ユーザーが見つかりません' }
        }
      }

      // 組織ID の決定
      let targetOrganizationId: number | undefined
      if (input.organizationId) {
        if (currentUser.role === 'admin') {
          targetOrganizationId = input.organizationId
        } else if (currentUser.organization_id === input.organizationId) {
          targetOrganizationId = input.organizationId
        } else {
          return {
            success: false,
            error: { code: 'AUTHORIZATION_ERROR', message: '他の組織のデータにはアクセスできません' }
          }
        }
      } else {
        targetOrganizationId = currentUser.organization_id ?? undefined
      }

      if (!targetOrganizationId) {
        return {
          success: false,
          error: { code: 'AUTHORIZATION_ERROR', message: 'ユーザーが組織に属していません' }
        }
      }

      const period = input.period ?? 'month'

      // 一度のクエリで組織のチェック一覧を取得
      const checks = await this.repositories.checks.findByOrganizationId(targetOrganizationId)

      // 統計データを並列で計算（DB クエリを再利用）
      const [
        statusBreakdown,
        violationTrends,
        topViolationTypes,
        processingTimeStats
      ] = await Promise.all([
        this.getStatusBreakdown(checks),
        this.getViolationTrends(targetOrganizationId, period),
        this.getTopViolationTypes(targetOrganizationId),
        this.getProcessingTimeStats(targetOrganizationId)
      ])

      const totalChecks = checks.length
      const totalViolations = Math.floor(totalChecks * 1.5) // 仮の計算
      const averageViolationsPerCheck = totalChecks > 0 ? totalViolations / totalChecks : 0

      return {
        success: true,
        data: {
          totalChecks,
          totalViolations,
          averageViolationsPerCheck: Math.round(averageViolationsPerCheck * 100) / 100,
          statusBreakdown,
          violationTrends,
          topViolationTypes,
          processingTimeStats
        }
      }

    } catch (error) {
      console.error('Get check history stats usecase error:', error)
      
      if (error instanceof AuthenticationError || error instanceof ValidationError) {
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
  private validateInput(input: GetCheckHistoryStatsInput): string | null {
    if (!input.currentUserId || typeof input.currentUserId !== 'string') {
      return 'ユーザーIDが無効です'
    }

    if (input.period && !['day', 'week', 'month', 'year'].includes(input.period)) {
      return '期間の指定が無効です'
    }

    if (input.organizationId && typeof input.organizationId !== 'number') {
      return '組織IDが無効です'
    }

    return null
  }

  /**
   * 総チェック数を取得
   */
  private async getTotalChecks(organizationId: number): Promise<number> {
    try {
      const checks = await this.repositories.checks.findByOrganizationId(organizationId)
      return checks.length
    } catch (error) {
      console.warn('Failed to get total checks:', error)
      return 0
    }
  }

  /**
   * 総違反数を取得
   */
  private async getTotalViolations(organizationId: number): Promise<number> {
    try {
      // 簡易実装: 組織のチェック総数から推定
      const totalChecks = await this.getTotalChecks(organizationId)
      return Math.floor(totalChecks * 1.5) // 仮に1.5倍とする
    } catch (error) {
      console.warn('Failed to get total violations:', error)
      return 0
    }
  }

  /**
   * ステータス別の分布を取得
   */
  private getStatusBreakdown(checks: Array<{ status: string | null }>): {
    completed: number
    failed: number
    processing: number
    pending: number
  } {
    const breakdown = {
      completed: 0,
      failed: 0,
      processing: 0,
      pending: 0
    }

    checks.forEach(check => {
      switch (check.status) {
        case 'completed':
          breakdown.completed++
          break
        case 'failed':
          breakdown.failed++
          break
        case 'processing':
          breakdown.processing++
          break
        case 'pending':
          breakdown.pending++
          break
        default:
          breakdown.pending++
      }
    })

    return breakdown
  }

  /**
   * 違反トレンドを取得
   */
  private async getViolationTrends(organizationId: number, period: string): Promise<Array<{
    date: string
    count: number
    violationCount: number
  }>> {
    try {
      // 簡易実装: モックデータを生成
      const days = this.getDaysForPeriod(period)
      const trends = []

      for (let i = 0; i < days; i++) {
        const date = new Date()
        date.setDate(date.getDate() - (days - 1 - i))
        
        trends.push({
          date: date.toISOString().split('T')[0],
          count: Math.floor(Math.random() * 20) + 5, // 5-25件のランダム
          violationCount: Math.floor(Math.random() * 30) + 10 // 10-40件のランダム
        })
      }

      return trends
    } catch (error) {
      console.warn('Failed to get violation trends:', error)
      return []
    }
  }

  /**
   * トップ違反タイプを取得
   */
  private async getTopViolationTypes(_organizationId: number): Promise<Array<{
    category: string
    count: number
    percentage: number
  }>> {
    try {
      // 簡易実装: モックデータを返す
      const types = [
        { category: 'NG', count: 145, percentage: 65.2 },
        { category: 'ALLOW', count: 77, percentage: 34.8 }
      ]

      return types
    } catch (error) {
      console.warn('Failed to get top violation types:', error)
      return []
    }
  }

  /**
   * 処理時間統計を取得
   */
  private async getProcessingTimeStats(_organizationId: number): Promise<{
    average: number
    median: number
    min: number
    max: number
  }> {
    try {
      // 簡易実装: モックデータを返す
      return {
        average: 2.3,
        median: 2.1,
        min: 0.8,
        max: 15.7
      }
    } catch (error) {
      console.warn('Failed to get processing time stats:', error)
      return { average: 0, median: 0, min: 0, max: 0 }
    }
  }

  /**
   * 期間に応じた日数を取得
   */
  private getDaysForPeriod(period: string): number {
    switch (period) {
      case 'day':
        return 1
      case 'week':
        return 7
      case 'month':
        return 30
      case 'year':
        return 365
      default:
        return 30
    }
  }
}