import { AuthenticationError, ValidationError, AuthorizationError } from '@/core/domain/errors'
import { RepositoryContainer } from '@/core/ports'

/**
 * Admin統計取得のユースケース入力
 */
export interface GetAdminStatsInput {
  currentUserId: string
  period?: 'day' | 'week' | 'month' | 'year'
  organizationId?: number
}

/**
 * Admin統計取得のユースケース出力
 */
export interface GetAdminStatsOutput {
  totalUsers: number
  totalOrganizations: number
  totalChecks: number
  totalViolations: number
  checksThisPeriod: number
  violationsThisPeriod: number
  averageCheckTime: number
  topOrganizations: Array<{
    id: number
    name: string
    checkCount: number
    violationCount: number
  }>
  systemHealth: {
    status: 'healthy' | 'warning' | 'critical'
    uptime: number
    memoryUsage: number
    responseTime: number
  }
}

/**
 * Admin統計取得のユースケース結果
 */
export type GetAdminStatsResult = 
  | { success: true; data: GetAdminStatsOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * Admin統計取得ユースケース
 */
export class GetAdminStatsUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: GetAdminStatsInput): Promise<GetAdminStatsResult> {
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

      // 期間設定
      const period = input.period ?? 'month'
      const periodStart = this.getPeriodStart(period)

      // 基本統計の取得
      const [
        totalUsers,
        totalOrganizations,
        totalChecks,
        totalViolations
      ] = await Promise.all([
        this.getTotalUsers(input.organizationId),
        this.getTotalOrganizations(),
        this.getTotalChecks(input.organizationId),
        this.getTotalViolations(input.organizationId)
      ])

      // 期間統計の取得
      const [
        checksThisPeriod,
        violationsThisPeriod,
        averageCheckTime
      ] = await Promise.all([
        this.getChecksInPeriod(periodStart, input.organizationId),
        this.getViolationsInPeriod(periodStart, input.organizationId),
        this.getAverageCheckTime(periodStart, input.organizationId)
      ])

      // トップ組織の取得
      const topOrganizations = await this.getTopOrganizations(periodStart)

      // システムヘルス情報
      const systemHealth = this.getSystemHealth()

      return {
        success: true,
        data: {
          totalUsers,
          totalOrganizations,
          totalChecks,
          totalViolations,
          checksThisPeriod,
          violationsThisPeriod,
          averageCheckTime,
          topOrganizations,
          systemHealth
        }
      }

    } catch (error) {
      console.error('Get admin stats usecase error:', error)
      
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
  private validateInput(input: GetAdminStatsInput): string | null {
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
   * 期間の開始日時を取得
   */
  private getPeriodStart(period: string): Date {
    const now = new Date()
    switch (period) {
      case 'day':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate())
      case 'week':
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - now.getDay())
        return new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate())
      case 'month':
        return new Date(now.getFullYear(), now.getMonth(), 1)
      case 'year':
        return new Date(now.getFullYear(), 0, 1)
      default:
        return new Date(now.getFullYear(), now.getMonth(), 1)
    }
  }

  /**
   * 総ユーザー数を取得
   */
  private async getTotalUsers(organizationId?: number): Promise<number> {
    try {
      if (organizationId) {
        const users = await this.repositories.users.findByOrganizationId(organizationId)
        return users.length
      } else {
        return await this.repositories.users.count()
      }
    } catch (error) {
      console.warn('Failed to get total users:', error)
      return 0
    }
  }

  /**
   * 総組織数を取得
   */
  private async getTotalOrganizations(): Promise<number> {
    try {
      return await this.repositories.organizations.count()
    } catch (error) {
      console.warn('Failed to get total organizations:', error)
      return 0
    }
  }

  /**
   * 総チェック数を取得
   */
  private async getTotalChecks(_organizationId?: number): Promise<number> {
    try {
      return await this.repositories.checks.count()
    } catch (error) {
      console.warn('Failed to get total checks:', error)
      return 0
    }
  }

  /**
   * 総違反数を取得
   */
  private async getTotalViolations(_organizationId?: number): Promise<number> {
    try {
      return await this.repositories.violations.countTotal()
    } catch (error) {
      console.warn('Failed to get total violations:', error)
      return 0
    }
  }

  /**
   * 期間内のチェック数を取得
   */
  private async getChecksInPeriod(_periodStart: Date, organizationId?: number): Promise<number> {
    try {
      // 簡易実装: 総数の一定割合として計算
      const totalChecks = await this.getTotalChecks(organizationId)
      return Math.floor(totalChecks * 0.1) // 仮に10%とする
    } catch (error) {
      console.warn('Failed to get checks in period:', error)
      return 0
    }
  }

  /**
   * 期間内の違反数を取得
   */
  private async getViolationsInPeriod(_periodStart: Date, organizationId?: number): Promise<number> {
    try {
      // 簡易実装: 総数の一定割合として計算
      const totalViolations = await this.getTotalViolations(organizationId)
      return Math.floor(totalViolations * 0.1) // 仮に10%とする
    } catch (error) {
      console.warn('Failed to get violations in period:', error)
      return 0
    }
  }

  /**
   * 平均チェック時間を取得
   */
  private async getAverageCheckTime(_periodStart: Date, _organizationId?: number): Promise<number> {
    try {
      // 簡易実装: 固定値を返す
      return 2.5 // 2.5秒
    } catch (error) {
      console.warn('Failed to get average check time:', error)
      return 0
    }
  }

  /**
   * トップ組織を取得
   */
  private async getTopOrganizations(_periodStart: Date): Promise<Array<{
    id: number
    name: string
    checkCount: number
    violationCount: number
  }>> {
    try {
      // 簡易実装: モックデータを返す
      return [
        { id: 1, name: '組織A', checkCount: 150, violationCount: 25 },
        { id: 2, name: '組織B', checkCount: 120, violationCount: 18 },
        { id: 3, name: '組織C', checkCount: 95, violationCount: 12 }
      ]
    } catch (error) {
      console.warn('Failed to get top organizations:', error)
      return []
    }
  }

  /**
   * システムヘルス情報を取得
   */
  private getSystemHealth(): {
    status: 'healthy' | 'warning' | 'critical'
    uptime: number
    memoryUsage: number
    responseTime: number
  } {
    try {
      // 簡易実装: モックデータを返す
      const memoryUsage = process.memoryUsage()
      const uptimeSeconds = process.uptime()
      
      return {
        status: 'healthy',
        uptime: uptimeSeconds,
        memoryUsage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
        responseTime: 150 // ms
      }
    } catch (error) {
      console.warn('Failed to get system health:', error)
      return {
        status: 'warning',
        uptime: 0,
        memoryUsage: 0,
        responseTime: 0
      }
    }
  }
}