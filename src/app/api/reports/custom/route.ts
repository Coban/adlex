import ExcelJS from 'exceljs'
import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'

import { getRepositories } from '@/lib/repositories'
import { createClient } from '@/lib/supabase/server'

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
  violations?: Violation[]
}

interface ReportOptions {
  title: string
  template: string
  includeStats: boolean
  includeSummary: boolean
  includeDetails: boolean
}

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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { 
      checkIds, 
      format, 
      template, 
      includeStats,
      includeSummary,
      includeDetails,
      title 
    } = body

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get repositories
    const repositories = await getRepositories(supabase)

    // Get user data with role and organization
    const userData = await repositories.users.findById(user.id)
    if (!userData?.organization_id) {
      return NextResponse.json({ error: 'User not found or not in organization' }, { status: 404 })
    }

    // Validate checkIds
    if (!Array.isArray(checkIds) || checkIds.length === 0) {
      return NextResponse.json({ error: 'チェックIDが指定されていません' }, { status: 400 })
    }

    // Get check data with violations for each check ID
    const checksWithViolations = await Promise.all(
      checkIds.map(async (checkId: number) => {
        const check = await repositories.checks.findByIdWithDetailedViolations(checkId, userData.organization_id)
        return check
      })
    )

    // Filter out null checks and apply role-based filtering
    const checks = checksWithViolations.filter((check): check is NonNullable<typeof check> => {
      if (!check) return false
      if (userData.role === 'user' && check.user_id !== userData.id) return false
      return true
    })

    if (checks.length === 0) {
      return NextResponse.json({ error: 'チェックが見つかりません' }, { status: 404 })
    }

    // Sort by created_at descending
    checks.sort((a, b) => {
      if (!a.created_at || !b.created_at) return 0
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    // Generate report based on format
    const reportTitle = title ?? `カスタムレポート ${new Date().toLocaleDateString('ja-JP')}`
    
    switch (format) {
      case 'pdf':
        const pdfBuffer = await generateCustomPDFReport(checks, {
          title: reportTitle,
          includeStats,
          includeSummary,
          includeDetails,
          template
        })
        return new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="custom_report_${new Date().toISOString().split('T')[0]}.pdf"`,
            'Cache-Control': 'no-cache'
          }
        })

      case 'excel':
        const excelBuffer = await generateCustomExcelReport(checks, {
          title: reportTitle,
          includeStats,
          includeSummary,
          includeDetails,
          template
        })
        return new NextResponse(excelBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="custom_report_${new Date().toISOString().split('T')[0]}.xlsx"`,
            'Cache-Control': 'no-cache'
          }
        })

      default:
        return NextResponse.json({ error: 'サポートされていない形式です' }, { status: 400 })
    }

  } catch (error) {
    console.error('Custom report generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function generateCustomPDFReport(checks: Check[], options: ReportOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 })
      const chunks: Uint8Array[] = []

      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // Title
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .text(options.title, { align: 'center' })
         .moveDown()

      // Report metadata
      doc.fontSize(12)
         .font('Helvetica')
         .text(`生成日時: ${new Date().toLocaleString('ja-JP')}`)
         .text(`対象チェック数: ${checks.length}件`)
         .moveDown()

      // Statistics summary
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

      // Summary by violation type
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

      // Detailed checks
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

async function generateCustomExcelReport(checks: Check[], options: ReportOptions): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'AdLex'
  workbook.created = new Date()

  // Summary sheet
  if (options.includeStats || options.includeSummary) {
    const summarySheet = workbook.addWorksheet('サマリー')
    
    let row = 1
    
    // Title
    summarySheet.getCell(`A${row}`).value = options.title
    summarySheet.getCell(`A${row}`).font = { bold: true, size: 16 }
    row += 2

    // Basic stats
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

    // Violation type summary
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

    // Auto-fit columns
    summarySheet.columns = [
      { width: 20 },
      { width: 15 }
    ]
  }

  // Details sheet
  if (options.includeDetails) {
    const detailsSheet = workbook.addWorksheet('詳細')
    
    // Headers
    const headers = ['ID', '作成日時', 'ステータス', '入力タイプ', '原文', '修正文', '違反数', '違反詳細']
    detailsSheet.addRow(headers)
    
    const headerRow = detailsSheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '2563EB' }
    }

    // Data rows
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

    // Auto-fit columns
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

