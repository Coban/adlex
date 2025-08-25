import { AuthenticationError, ValidationError, AuthorizationError } from '@/core/domain/errors'
import { RepositoryContainer } from '@/core/ports'

/**
 * チェック履歴エクスポートのユースケース入力
 */
export interface ExportCheckHistoryInput {
  currentUserId: string
  format: 'csv' | 'json' | 'excel'
  search?: string
  status?: 'pending' | 'processing' | 'completed' | 'failed'
  inputType?: 'text' | 'image'
  dateFilter?: 'today' | 'week' | 'month'
  userId?: string
  startDate?: string
  endDate?: string
}

/**
 * エクスポートデータの型定義
 */
export interface ExportData {
  id: number
  createdAt: string | null
  completedAt: string | null
  status: string | null
  inputType: string
  originalText: string
  modifiedText: string
  violationCount: number
  userEmail: string
  imageUrl: string
  ocrStatus: string
}

/**
 * チェック履歴エクスポートのユースケース出力
 */
export interface ExportCheckHistoryOutput {
  data: ExportData[]
  format: string
  userRole: string
  totalRecords: number
}

/**
 * チェック履歴エクスポートのユースケース結果
 */
export type ExportCheckHistoryResult = 
  | { success: true; data: ExportCheckHistoryOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * チェック履歴エクスポートユースケース
 */
export class ExportCheckHistoryUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: ExportCheckHistoryInput): Promise<ExportCheckHistoryResult> {
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

      if (!currentUser.organization_id) {
        return {
          success: false,
          error: { code: 'AUTHENTICATION_ERROR', message: 'ユーザーが組織に所属していません' }
        }
      }

      // フォーマットのバリデーション
      if (!['csv', 'json', 'excel'].includes(input.format)) {
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'サポートされていないフォーマットです' }
        }
      }

      // ユーザー権限に基づく検索ユーザーIDの決定
      let searchUserId: string | undefined
      if (currentUser.role === 'user') {
        // 一般ユーザーは自分のチェックのみエクスポート可能
        searchUserId = currentUser.id
      } else if (currentUser.role === 'admin' && input.userId) {
        // 管理者は特定ユーザーでフィルタリング可能
        searchUserId = input.userId
      }

      // ステータスとインプットタイプのバリデーション
      const searchStatus = input.status && ['pending', 'processing', 'completed', 'failed'].includes(input.status) 
        ? input.status as 'pending' | 'processing' | 'completed' | 'failed' 
        : undefined

      const searchInputType = input.inputType && ['text', 'image'].includes(input.inputType)
        ? input.inputType as 'text' | 'image'
        : undefined

      const searchDateFilter = input.dateFilter && ['today', 'week', 'month'].includes(input.dateFilter)
        ? input.dateFilter as 'today' | 'week' | 'month'
        : undefined

      // リポジトリの検索メソッドを使用してデータを取得（エクスポート用に高い制限を設定）
      const searchResult = await this.repositories.checks.searchChecks({
        organizationId: currentUser.organization_id,
        userId: searchUserId,
        search: input.search ?? undefined,
        status: searchStatus,
        inputType: searchInputType,
        dateFilter: searchDateFilter,
        page: 1,
        limit: 10000 // エクスポート用の高い制限
      })

      const checks = searchResult.checks

      if (!checks || checks.length === 0) {
        return {
          success: false,
          error: { code: 'NOT_FOUND_ERROR', message: 'エクスポートするデータがありません' }
        }
      }

      // データのフォーマット
      const formattedData: ExportData[] = checks.map(check => {
        const displayText = check.input_type === 'image' && check.extracted_text 
          ? check.extracted_text 
          : check.original_text

        return {
          id: check.id!,
          createdAt: check.created_at,
          completedAt: check.completed_at,
          status: check.status,
          inputType: check.input_type === 'image' ? '画像' : 'テキスト',
          originalText: displayText ?? '',
          modifiedText: check.modified_text ?? '',
          violationCount: check.violations?.length ?? 0,
          userEmail: currentUser.role === 'admin' ? (check.users?.email ?? '') : '',
          imageUrl: check.image_url ?? '',
          ocrStatus: check.ocr_status ?? ''
        }
      })

      return {
        success: true,
        data: {
          data: formattedData,
          format: input.format,
          userRole: currentUser.role ?? 'user',
          totalRecords: formattedData.length
        }
      }

    } catch (error) {
      console.error('Export check history usecase error:', error)
      
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
  private validateInput(input: ExportCheckHistoryInput): string | null {
    if (!input.currentUserId || typeof input.currentUserId !== 'string') {
      return 'ユーザーIDが無効です'
    }

    if (!input.format || !['csv', 'json', 'excel'].includes(input.format)) {
      return 'フォーマットが無効です'
    }

    if (input.status && !['pending', 'processing', 'completed', 'failed'].includes(input.status)) {
      return 'ステータスが無効です'
    }

    if (input.inputType && !['text', 'image'].includes(input.inputType)) {
      return '入力タイプが無効です'
    }

    if (input.dateFilter && !['today', 'week', 'month'].includes(input.dateFilter)) {
      return '日付フィルターが無効です'
    }

    return null
  }
}