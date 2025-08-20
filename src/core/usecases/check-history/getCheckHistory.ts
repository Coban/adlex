import { AuthenticationError, ValidationError } from '@/core/domain/errors'
import { RepositoryContainer } from '@/core/ports'

/**
 * チェック履歴取得のユースケース入力
 */
export interface GetCheckHistoryInput {
  currentUserId: string
  page?: number
  limit?: number
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'ALL'
  search?: string
  dateFrom?: string
  dateTo?: string
  userId?: string
  organizationId?: number
  inputType?: 'text' | 'image'
  dateFilter?: 'week' | 'month' | 'today'
}

/**
 * チェック履歴取得のユースケース出力
 */
export interface GetCheckHistoryOutput {
  checks: Array<{
    id: number
    originalText: string
    modifiedText: string | null
    status: 'pending' | 'processing' | 'completed' | 'failed'
    inputType: 'text' | 'image'
    violationCount: number
    processingTime: number | null
    createdAt: string
    updatedAt: string | null
    user: {
      id: string
      email: string
    } | null
    violations?: Array<{
      id: number
      phrase: string
      category: string
      severity: 'low' | 'medium' | 'high'
      startPosition: number
      endPosition: number
      reasoning: string | null
    }>
  }>
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/**
 * チェック履歴取得のユースケース結果
 */
export type GetCheckHistoryResult = 
  | { success: true; data: GetCheckHistoryOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * チェック履歴取得ユースケース
 */
export class GetCheckHistoryUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: GetCheckHistoryInput): Promise<GetCheckHistoryResult> {
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

      // 組織ID の決定（管理者は他の組織も見れる、一般ユーザーは自分の組織のみ）
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

      const page = input.page ?? 1
      const limit = input.limit ?? 20

      // Repository pattern tests expect searchChecks() to be used with filters & pagination
      // currentUser は上で取得済み

      const searchResult = await this.repositories.checks.searchChecks({
        organizationId: targetOrganizationId,
        userId: currentUser.role === 'user' ? input.currentUserId : input.userId,
        search: input.search,
        status: input.status && input.status !== 'ALL' ? input.status : undefined,
        inputType: input.inputType,
        dateFilter: input.dateFilter,
        page,
        limit,
      })

      const filteredChecks = searchResult.checks

      // 結果を整形
      const formattedChecks = filteredChecks.map((check) => {
        return {
          id: check.id!,
          originalText: check.original_text ?? '',
          modifiedText: check.modified_text,
          status: check.status as 'pending' | 'processing' | 'completed' | 'failed',
          inputType: check.input_type as 'text' | 'image',
          violationCount: Array.isArray(check.violations) ? check.violations.length : 0,
          processingTime: null,
          createdAt: check.created_at ?? '',
          updatedAt: check.completed_at,
          user: check.users ? {
            id: check.user_id,
            email: check.users.email ?? ''
          } : null,
        }
      })

      // ページネーション情報
      const total = searchResult.pagination.total
      const totalPages = searchResult.pagination.totalPages

      return {
        success: true,
        data: {
          checks: formattedChecks,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: searchResult.pagination.hasNext,
            hasPrev: searchResult.pagination.hasPrev
          }
        }
      }

    } catch (error) {
      console.error('Get check history usecase error:', error)
      
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
  private validateInput(input: GetCheckHistoryInput): string | null {
    if (!input.currentUserId || typeof input.currentUserId !== 'string') {
      return 'ユーザーIDが無効です'
    }

    if (input.page && (typeof input.page !== 'number' || input.page < 1)) {
      return 'ページ番号が無効です'
    }

    if (input.limit && (typeof input.limit !== 'number' || input.limit < 1 || input.limit > 100)) {
      return '取得件数が無効です'
    }

    if (input.status && !['pending', 'processing', 'completed', 'failed', 'ALL'].includes(input.status)) {
      return 'ステータスが無効です'
    }

    if (input.organizationId && typeof input.organizationId !== 'number') {
      return '組織IDが無効です'
    }

    if (input.dateFrom) {
      const fromDate = new Date(input.dateFrom)
      if (isNaN(fromDate.getTime())) {
        return '開始日の形式が無効です'
      }
    }

    if (input.dateTo) {
      const toDate = new Date(input.dateTo)
      if (isNaN(toDate.getTime())) {
        return '終了日の形式が無効です'
      }
    }

    return null
  }
}