import { AuthenticationError, AuthorizationError } from '@/core/domain/errors'
import { RepositoryContainer } from '@/core/ports'

/**
 * 辞書エクスポートのユースケース入力
 */
export interface ExportDictionariesInput {
  currentUserId: string
  format: 'csv'
}

/**
 * 辞書エクスポートのユースケース出力
 */
export interface ExportDictionariesOutput {
  content: string
  filename: string
  contentType: string
}

/**
 * 辞書エクスポートのユースケース結果
 */
export type ExportDictionariesResult = 
  | { success: true; data: ExportDictionariesOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * 辞書エクスポートユースケース
 */
export class ExportDictionariesUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: ExportDictionariesInput): Promise<ExportDictionariesResult> {
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

      // 管理者権限チェック
      if (currentUser.role !== 'admin') {
        return {
          success: false,
          error: { code: 'AUTHORIZATION_ERROR', message: '管理者権限が必要です' }
        }
      }

      // 辞書データの取得
      const dictionaries = await this.repositories.dictionaries.findByOrganizationId(
        currentUser.organization_id,
        {
          orderBy: [{ field: 'created_at', direction: 'asc' }]
        }
      )

      // フォーマットに応じてエクスポート
      switch (input.format) {
        case 'csv':
          const csvContent = this.generateCsvContent(dictionaries)
          return {
            success: true,
            data: {
              content: csvContent,
              filename: `dictionaries_${new Date().toISOString().split('T')[0]}.csv`,
              contentType: 'text/csv; charset=utf-8'
            }
          }

        default:
          return {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'サポートされていない形式です' }
          }
      }

    } catch (error) {
      console.error('Export dictionaries usecase error:', error)
      
      if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
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
  private validateInput(input: ExportDictionariesInput): string | null {
    if (!input.currentUserId || typeof input.currentUserId !== 'string') {
      return 'ユーザーIDが無効です'
    }

    if (!['csv'].includes(input.format)) {
      return 'フォーマットは \"csv\" である必要があります'
    }

    return null
  }

  /**
   * CSV形式のファイル内容を生成
   */
  private generateCsvContent(dictionaries: Array<{ phrase: string; category: string; notes: string | null }>): string {
    // CSVフィールドのエスケープ
    const escapeCsvField = (value: string | null | undefined): string => {
      const text = (value ?? "").replace(/\r\n|\r|\n/g, "\n")
      if (text.includes("\n") || text.includes(",") || text.includes('"')) {
        return '"' + text.replace(/"/g, '""') + '"'
      }
      return text
    }

    // ヘッダー行
    const header = ["phrase", "category", "notes"].join(",")
    
    // データ行
    const rows = dictionaries.map((d) => [
      escapeCsvField(d.phrase),
      escapeCsvField(d.category),
      escapeCsvField(d.notes ?? null)
    ].join(","))

    // Excel互換のためBOM付きUTF-8
    const bom = '\uFEFF'
    return bom + [header, ...rows].join("\n")
  }
}