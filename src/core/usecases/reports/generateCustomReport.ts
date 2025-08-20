import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'

import { AuthenticationError, AuthorizationError } from '@/core/domain/errors'
import { RepositoryContainer } from '@/core/ports'

interface Violation {
  id: number
  reason: string
}

interface Check {
  id: number
  original_text: string
  modified_text: string | null
  status: string | null
  input_type: string | null
  created_at: string | null
  user_id: string
  violations?: Violation[]
}

interface ReportOptions {
  title: string
  template?: string
  includeStats: boolean
  includeSummary: boolean
  includeDetails: boolean
}

/**
 * カスタムレポート生成のユースケース入力
 */
export interface GenerateCustomReportInput {
  currentUserId: string
  checkIds: number[]
  format: 'pdf' | 'excel'
  template?: string
  includeStats: boolean
  includeSummary: boolean
  includeDetails: boolean
  title?: string
}

/**
 * カスタムレポート生成のユースケース出力
 */
export interface GenerateCustomReportOutput {
  buffer: Buffer
  filename: string
  contentType: string
}

/**
 * カスタムレポート生成のユースケース結果
 */
export type GenerateCustomReportResult = 
  | { success: true; data: GenerateCustomReportOutput }
  | { success: false; error: { code: string; message: string } }

function getStatusLabel(status: string | null): string {
  if (!status) return '不明'
  
  const statusLabels = {
    pending: '待機中',
    processing: '処理中',
    completed: '完了',
    failed: 'エラー'
  }
  return statusLabels[status as keyof typeof statusLabels] ?? status
}

/**
 * カスタムレポート生成ユースケース
 */
export class GenerateCustomReportUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: GenerateCustomReportInput): Promise<GenerateCustomReportResult> {
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

      // チェックデータを取得（違反詳細付き）
      const checksWithViolations = await Promise.all(
        input.checkIds.map(async (checkId: number) => {
          const check = await this.repositories.checks.findByIdWithDetailedViolations(checkId, currentUser.organization_id!)
          return check
        })
      )

      // 有効なチェックをフィルタリング（ロールベースのアクセス制御）
      const checks = checksWithViolations.filter((check): check is NonNullable<typeof check> => {
        if (!check) return false
        if (currentUser.role === 'user' && check.user_id !== currentUser.id) return false
        return true
      })

      if (checks.length === 0) {
        return {
          success: false,
          error: { code: 'NOT_FOUND_ERROR', message: 'チェックが見つかりません' }
        }
      }

      // 作成日時で降順ソート
      checks.sort((a, b) => {
        if (!a.created_at || !b.created_at) return 0
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      // レポートタイトルの生成
      const reportTitle = input.title ?? `カスタムレポート ${new Date().toLocaleDateString('ja-JP')}`

      // レポート生成オプション
      const reportOptions: ReportOptions = {
        title: reportTitle,
        template: input.template,
        includeStats: input.includeStats,
        includeSummary: input.includeSummary,
        includeDetails: input.includeDetails
      }

      // フォーマットに応じてレポート生成
      let buffer: Buffer
      let filename: string
      let contentType: string

      switch (input.format) {
        case 'pdf':
          buffer = await this.generateCustomPDFReport(checks as Check[], reportOptions)
          filename = `custom_report_${new Date().toISOString().split('T')[0]}.pdf`
          contentType = 'application/pdf'
          break

        case 'excel':
          buffer = await this.generateCustomExcelReport(checks as Check[], reportOptions)
          filename = `custom_report_${new Date().toISOString().split('T')[0]}.xlsx`
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          break

        default:
          return {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'サポートされていない形式です' }
          }
      }

      return {
        success: true,
        data: {
          buffer,
          filename,
          contentType
        }
      }

    } catch (error) {
      console.error('Custom report generation usecase error:', error)
      
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
  private validateInput(input: GenerateCustomReportInput): string | null {
    if (!input.currentUserId || typeof input.currentUserId !== 'string') {
      return 'ユーザーIDが無効です'
    }

    if (!input.checkIds || !Array.isArray(input.checkIds) || input.checkIds.length === 0) {
      return 'チェックIDが必要です'
    }

    for (const checkId of input.checkIds) {
      if (!checkId || typeof checkId !== 'number' || checkId <= 0) {
        return '無効なチェックIDが含まれています'
      }
    }

    if (!['pdf', 'excel'].includes(input.format)) {
      return 'フォーマットは \"pdf\" または \"excel\" である必要があります'
    }

    return null
  }

  /**
   * PDFレポート生成
   */
  private async generateCustomPDFReport(checks: Check[], options: ReportOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 })
        const chunks: Uint8Array[] = []

        doc.on('data', (chunk) => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        // タイトル
        doc.fontSize(20)
           .font('Helvetica-Bold')
           .text(options.title, { align: 'center' })
           .moveDown()

        // レポートメタデータ
        doc.fontSize(12)
           .font('Helvetica')
           .text(`生成日時: ${new Date().toLocaleString('ja-JP')}`)
           .text(`対象チェック数: ${checks.length}件`)
           .moveDown()

        // 統計サマリー
        if (options.includeStats) {
          const totalViolations = checks.reduce((sum, check) => sum + (check.violations?.length ?? 0), 0)
          const completedChecks = checks.filter(check => check.status === 'completed').length
          const failedChecks = checks.filter(check => check.status === 'failed').length
          
          doc.fontSize(16)
             .font('Helvetica-Bold')
             .text('統計サマリー')
             .moveDown(0.5)
             .fontSize(12)
             .font('Helvetica')
             .text(`総チェック数: ${checks.length}`)
             .text(`完了チェック数: ${completedChecks}`)
             .text(`失敗チェック数: ${failedChecks}`)
             .text(`総違反数: ${totalViolations}`)
             .text(`平均違反数: ${(totalViolations / Math.max(completedChecks, 1)).toFixed(2)}`)
             .moveDown()
        }

        // 違反タイプ別サマリー
        if (options.includeSummary) {
          const violationTypes = new Map<string, number>()
          checks.forEach(check => {
            check.violations?.forEach((_violation: Violation) => {
              const type = 'その他'
              violationTypes.set(type, (violationTypes.get(type) ?? 0) + 1)
            })
          })

          doc.fontSize(16)
             .font('Helvetica-Bold')
             .text('違反タイプ別サマリー')
             .moveDown(0.5)
             .fontSize(12)
             .font('Helvetica')

          Array.from(violationTypes.entries()).forEach(([type, count]) => {
            doc.text(`${type}: ${count}件`)
          })
          doc.moveDown()
        }

        // チェック詳細
        if (options.includeDetails) {
          doc.fontSize(16)
             .font('Helvetica-Bold')
             .text('チェック詳細')
             .moveDown(0.5)

          checks.forEach((check, index) => {
            if (index > 0) doc.addPage()
            
            doc.fontSize(14)
               .font('Helvetica-Bold')
               .text(`チェック #${check.id}`)
               .moveDown(0.3)
               .fontSize(10)
               .font('Helvetica')
               .text(`作成日時: ${check.created_at ? new Date(check.created_at).toLocaleString('ja-JP') : '不明'}`)
               .text(`ステータス: ${getStatusLabel(check.status)}`)
               .text(`入力タイプ: ${check.input_type === 'image' ? '画像' : 'テキスト'}`)
               .text(`違反数: ${check.violations?.length ?? 0}件`)
               .moveDown(0.5)

            doc.fontSize(12)
               .font('Helvetica-Bold')
               .text('原文:')
               .moveDown(0.2)
               .fontSize(10)
               .font('Helvetica')
               .text(check.original_text ?? '', { width: 500 })
               .moveDown()

            if (check.modified_text) {
              doc.fontSize(12)
                 .font('Helvetica-Bold')
                 .text('修正文:')
                 .moveDown(0.2)
                 .fontSize(10)
                 .font('Helvetica')
                 .text(check.modified_text, { width: 500 })
                 .moveDown()
            }

            if (check.violations && check.violations.length > 0) {
              doc.fontSize(12)
                 .font('Helvetica-Bold')
                 .text('検出された違反:')
                 .moveDown(0.2)
                 .fontSize(10)
                 .font('Helvetica')

              check.violations.forEach((violation: Violation, vIndex: number) => {
                doc.text(`${vIndex + 1}. ${violation.reason}`)
                   .moveDown(0.3)
              })
            }
          })
        }

        doc.end()
      } catch (error) {
        console.error('PDF generation error:', error)
        reject(new Error('PDF生成に失敗しました: ' + (error instanceof Error ? error.message : String(error))))
      }
    })
  }

  /**
   * Excelレポート生成
   */
  private async generateCustomExcelReport(checks: Check[], options: ReportOptions): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'AdLex'
    workbook.created = new Date()

    // サマリーシート
    if (options.includeStats || options.includeSummary) {
      const summarySheet = workbook.addWorksheet('サマリー')
      
      let row = 1
      
      // タイトル
      summarySheet.getCell(`A${row}`).value = options.title
      summarySheet.getCell(`A${row}`).font = { bold: true, size: 16 }
      row += 2

      // 基本統計
      if (options.includeStats) {
        const totalViolations = checks.reduce((sum, check) => sum + (check.violations?.length ?? 0), 0)
        const completedChecks = checks.filter(check => check.status === 'completed').length
        
        summarySheet.getCell(`A${row}`).value = '基本統計'
        summarySheet.getCell(`A${row}`).font = { bold: true }
        row++
        
        summarySheet.getCell(`A${row}`).value = '総チェック数'
        summarySheet.getCell(`B${row}`).value = checks.length
        row++
        
        summarySheet.getCell(`A${row}`).value = '完了チェック数'
        summarySheet.getCell(`B${row}`).value = completedChecks
        row++
        
        summarySheet.getCell(`A${row}`).value = '総違反数'
        summarySheet.getCell(`B${row}`).value = totalViolations
        row++
        
        summarySheet.getCell(`A${row}`).value = '平均違反数'
        summarySheet.getCell(`B${row}`).value = Number((totalViolations / Math.max(completedChecks, 1)).toFixed(2))
        row += 2
      }

      // 違反タイプ別サマリー
      if (options.includeSummary) {
        const violationTypes = new Map<string, number>()
        checks.forEach(check => {
          check.violations?.forEach((_violation: Violation) => {
            const type = 'その他'
            violationTypes.set(type, (violationTypes.get(type) ?? 0) + 1)
          })
        })

        summarySheet.getCell(`A${row}`).value = '違反タイプ別'
        summarySheet.getCell(`A${row}`).font = { bold: true }
        row++
        
        summarySheet.getCell(`A${row}`).value = 'タイプ'
        summarySheet.getCell(`B${row}`).value = '件数'
        summarySheet.getRow(row).font = { bold: true }
        row++

        Array.from(violationTypes.entries()).forEach(([type, count]) => {
          summarySheet.getCell(`A${row}`).value = type
          summarySheet.getCell(`B${row}`).value = count
          row++
        })
      }

      // 列幅自動調整
      summarySheet.columns = [
        { width: 20 },
        { width: 15 }
      ]
    }

    // 詳細シート
    if (options.includeDetails) {
      const detailsSheet = workbook.addWorksheet('詳細')
      
      // ヘッダー
      const headers = ['ID', '作成日時', 'ステータス', '入力タイプ', '原文', '修正文', '違反数', '違反詳細']
      detailsSheet.addRow(headers)
      
      const headerRow = detailsSheet.getRow(1)
      headerRow.font = { bold: true }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '2563EB' }
      }

      // データ行
      checks.forEach(check => {
        const violationDetails = check.violations?.map((v: Violation) => v.reason).join('; ') ?? ''
        
        detailsSheet.addRow([
          check.id,
          check.created_at ? new Date(check.created_at).toLocaleString('ja-JP') : '不明',
          getStatusLabel(check.status),
          check.input_type === 'image' ? '画像' : 'テキスト',
          check.original_text?.substring(0, 200) ?? '',
          check.modified_text?.substring(0, 200) ?? '',
          check.violations?.length ?? 0,
          violationDetails.substring(0, 300)
        ])
      })

      // 列幅自動調整
      detailsSheet.columns = [
        { width: 10 },  // ID
        { width: 20 },  // 作成日時
        { width: 12 },  // ステータス
        { width: 12 },  // 入力タイプ
        { width: 40 },  // 原文
        { width: 40 },  // 修正文
        { width: 10 },  // 違反数
        { width: 50 }   // 違反詳細
      ]
    }

    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  }
}