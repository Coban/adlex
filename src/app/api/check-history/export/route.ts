import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

import {
  validateExportCheckHistoryQuery,
  createErrorResponse
} from '@/core/dtos/check-history'
import { getRepositories } from '@/core/ports'
import { ExportCheckHistoryUseCase, ExportData } from '@/core/usecases/check-history/exportCheckHistory'
import { createClient } from '@/infra/supabase/serverClient'
import { ErrorFactory } from '@/lib/errors'

/**
 * チェック履歴エクスポートAPI（リファクタリング済み）
 * DTO validate → usecase 呼び出し → HTTP 変換の薄い層
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        createErrorResponse('AUTHENTICATION_ERROR', '認証が必要です'),
        { status: 401 }
      )
    }

    // クエリパラメータの取得とバリデーション
    const searchParams = request.nextUrl.searchParams
    const queryData = {
      format: searchParams.get('format') ?? 'csv',
      search: searchParams.get('search') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      inputType: searchParams.get('inputType') ?? undefined,
      dateFilter: searchParams.get('dateFilter') ?? undefined,
      userId: searchParams.get('userId') ?? undefined,
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined
    }

    const validationResult = validateExportCheckHistoryQuery(queryData)
    if (!validationResult.success) {
      return NextResponse.json(
        createErrorResponse(
          validationResult.error.code,
          validationResult.error.message,
          validationResult.error.details
        ),
        { status: 400 }
      )
    }

    // リポジトリコンテナの取得
    const repositories = await getRepositories(supabase)

    // ユースケース実行
    const exportCheckHistoryUseCase = new ExportCheckHistoryUseCase(repositories)
    const result = await exportCheckHistoryUseCase.execute({
      currentUserId: user.id,
      format: validationResult.data.format,
      search: validationResult.data.search,
      status: validationResult.data.status,
      inputType: validationResult.data.inputType,
      dateFilter: validationResult.data.dateFilter,
      userId: validationResult.data.userId,
      startDate: validationResult.data.startDate,
      endDate: validationResult.data.endDate
    })

    // 結果の処理
    if (!result.success) {
      const statusCode = getStatusCodeFromError(result.error.code)
      return NextResponse.json(
        createErrorResponse(result.error.code, result.error.message),
        { status: statusCode }
      )
    }

    // フォーマットに基づくファイル生成
    switch (result.data.format) {
      case 'csv':
        return generateCSVExport(result.data.data, result.data.userRole)
      case 'json':
        return generateJSONExport(result.data.data)
      case 'excel':
        try {
          return generateExcelExport(result.data.data, result.data.userRole)
        } catch (excelError) {
          // Excel生成で制限エラーが発生した場合
          if (excelError instanceof Error && excelError.message.includes('エクスポート件数が多すぎます')) {
            return NextResponse.json(
              createErrorResponse('VALIDATION_ERROR', excelError.message),
              { status: 413 }
            )
          }
          throw excelError
        }
      default:
        return NextResponse.json(
          createErrorResponse('VALIDATION_ERROR', 'サポートされていないフォーマットです'),
          { status: 400 }
        )
    }

  } catch (error) {
    console.error("チェック履歴エクスポートAPI エラー:", error)
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', 'サーバーエラーが発生しました'),
      { status: 500 }
    )
  }
}

/**
 * エラーコードからHTTPステータスコードを取得するヘルパー
 */
function getStatusCodeFromError(errorCode: string): number {
  switch (errorCode) {
    case 'AUTHENTICATION_ERROR':
      return 401
    case 'AUTHORIZATION_ERROR':
      return 403
    case 'VALIDATION_ERROR':
      return 400
    case 'NOT_FOUND_ERROR':
      return 404
    case 'CONFLICT_ERROR':
      return 409
    case 'REPOSITORY_ERROR':
      return 500
    default:
      return 500
  }
}


function generateCSVExport(data: ExportData[], userRole: string) {
  const headers = ['ID', '作成日時', '完了日時', 'ステータス', '入力タイプ', '原文', '修正文', '違反数']
  if (userRole === 'admin') {
    headers.push('ユーザー', '画像URL', 'OCRステータス')
  }

  const csvRows = [
    headers.join(','),
    ...data.map(row => {
      const values = [
        row.id,
        `"${row.createdAt ? new Date(row.createdAt).toLocaleString('ja-JP') : ''}"`,
        `"${row.completedAt ? new Date(row.completedAt).toLocaleString('ja-JP') : ''}"`,
        `"${getStatusLabel(row.status)}"`,
        `"${row.inputType}"`,
        `"${row.originalText.replace(/"/g, '""').substring(0, 100)}${row.originalText.length > 100 ? '...' : ''}"`,
        `"${row.modifiedText.replace(/"/g, '""').substring(0, 100)}${row.modifiedText.length > 100 ? '...' : ''}"`,
        row.violationCount
      ]
      
      if (userRole === 'admin') {
        values.push(
          `"${row.userEmail}"`,
          `"${row.imageUrl}"`,
          `"${row.ocrStatus}"`
        )
      }
      
      return values.join(',')
    })
  ]

  const csvContent = csvRows.join('\n')
  const fileName = `check_history_${new Date().toISOString().split('T')[0]}.csv`

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-cache'
    }
  })
}

function generateJSONExport(data: ExportData[]) {
  const fileName = `check_history_${new Date().toISOString().split('T')[0]}.json`
  
  return new NextResponse(JSON.stringify({
    exportDate: new Date().toISOString(),
    totalRecords: data.length,
    data: data
  }, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-cache'
    }
  })
}


const MAX_EXPORT_SIZE = 1000

function generateExcelExport(data: ExportData[], userRole: string) {
  // データサイズ制限のチェック
  if (data.length > MAX_EXPORT_SIZE) {
    throw ErrorFactory.createQuotaExceededError('エクスポート件数', MAX_EXPORT_SIZE, data.length)
  }
  
  // Create a new workbook
  const workbook = XLSX.utils.book_new()
  
  // Prepare headers
  const headers = ['ID', '作成日時', '完了日時', 'ステータス', '入力タイプ', '原文', '修正文', '違反数']
  if (userRole === 'admin') {
    headers.push('ユーザー', '画像URL', 'OCRステータス')
  }
  
  // Prepare data rows
  const rows = data.map(row => {
    const values = [
      row.id,
      row.createdAt ? new Date(row.createdAt).toLocaleString('ja-JP') : '',
      row.completedAt ? new Date(row.completedAt).toLocaleString('ja-JP') : '',
      getStatusLabel(row.status),
      row.inputType,
      row.originalText.substring(0, 1000), // Limit text length for Excel
      row.modifiedText.substring(0, 1000), // Limit text length for Excel
      row.violationCount
    ]
    
    if (userRole === 'admin') {
      values.push(
        row.userEmail,
        row.imageUrl,
        row.ocrStatus
      )
    }
    
    return values
  })
  
  // Create worksheet data with headers
  const worksheetData = [headers, ...rows]
  
  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
  
  // Set column widths
  const columnWidths = [
    { wch: 8 },  // ID
    { wch: 20 }, // 作成日時
    { wch: 20 }, // 完了日時
    { wch: 12 }, // ステータス
    { wch: 12 }, // 入力タイプ
    { wch: 50 }, // 原文
    { wch: 50 }, // 修正文
    { wch: 10 }  // 違反数
  ]
  
  if (userRole === 'admin') {
    columnWidths.push(
      { wch: 25 }, // ユーザー
      { wch: 30 }, // 画像URL
      { wch: 15 }  // OCRステータス
    )
  }
  
  worksheet['!cols'] = columnWidths
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'チェック履歴')
  
  // Generate Excel file buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  
  const fileName = `check_history_${new Date().toISOString().split('T')[0]}.xlsx`
  
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-cache'
    }
  })
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