import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user data with role and organization
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id, email, organization_id, role')
      .eq('id', user.id)
      .single()

    if (userDataError || !userData?.organization_id) {
      return NextResponse.json({ error: 'User not found or not in organization' }, { status: 404 })
    }

    // Parse query parameters
    const format = searchParams.get('format') ?? 'csv' // csv, json, excel
    const search = searchParams.get('search') ?? ''
    const status = searchParams.get('status') ?? ''
    const inputType = searchParams.get('inputType') ?? ''
    const dateFilter = searchParams.get('dateFilter') ?? ''
    const userId = searchParams.get('userId') ?? ''
    const startDate = searchParams.get('startDate') ?? ''
    const endDate = searchParams.get('endDate') ?? ''

    // Validate format
    if (!['csv', 'json', 'excel'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format. Supported: csv, json, excel' }, { status: 400 })
    }

    // Build query for export (no pagination limits)
    let query = supabase
      .from('checks')
      .select(`
        id,
        original_text,
        modified_text,
        status,
        input_type,
        image_url,
        extracted_text,
        ocr_status,
        created_at,
        completed_at,
        user_id,
        users!inner(email),
        violations:violations(id)
      `)
      .eq('organization_id', userData.organization_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // Apply filters based on user role
    if (userData.role === 'user') {
      query = query.eq('user_id', userData.id)
    } else if (userData.role === 'admin' && userId) {
      query = query.eq('user_id', userId)
    }

    // Apply filters
    if (search) {
      query = query.ilike('original_text', `%${search}%`)
    }

    if (status && ['pending', 'processing', 'completed', 'failed'].includes(status)) {
      query = query.eq('status', status as 'pending' | 'processing' | 'completed' | 'failed')
    }

    if (inputType && ['text', 'image'].includes(inputType)) {
      query = query.eq('input_type', inputType as 'text' | 'image')
    }

    // Apply date filters
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    if (dateFilter && ['today', 'week', 'month'].includes(dateFilter)) {
      const now = new Date()
      let filterStartDate: Date

      switch (dateFilter) {
        case 'today':
          filterStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          const dayOfWeek = now.getDay()
          filterStartDate = new Date(now.getTime() - (dayOfWeek * 24 * 60 * 60 * 1000))
          filterStartDate.setHours(0, 0, 0, 0)
          break
        case 'month':
          filterStartDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        default:
          filterStartDate = new Date(0)
      }

      query = query.gte('created_at', filterStartDate.toISOString())
    }

    // Execute query
    const { data: checks, error: checksError } = await query

    if (checksError) {
      console.error('Export query error:', checksError)
      return NextResponse.json({ error: 'Failed to fetch checks for export' }, { status: 500 })
    }

    if (!checks || checks.length === 0) {
      return NextResponse.json({ error: 'No data to export' }, { status: 404 })
    }

    // Format data
    const formattedData = checks.map(check => {
      const displayText = check.input_type === 'image' && check.extracted_text 
        ? check.extracted_text 
        : check.original_text

      return {
        id: check.id,
        createdAt: check.created_at,
        completedAt: check.completed_at,
        status: check.status,
        inputType: check.input_type === 'image' ? '画像' : 'テキスト',
        originalText: displayText,
        modifiedText: check.modified_text ?? '',
        violationCount: check.violations?.length ?? 0,
        userEmail: userData.role === 'admin' ? (check.users?.email ?? '') : '',
        imageUrl: check.image_url ?? '',
        ocrStatus: check.ocr_status ?? ''
      }
    })

    // Generate export based on format
    switch (format) {
      case 'csv':
        return generateCSVExport(formattedData, userData.role ?? 'user')
      case 'json':
        return generateJSONExport(formattedData)
      case 'excel':
        try {
          return generateExcelExport(formattedData, userData.role ?? 'user')
        } catch (excelError) {
          // Excel生成で制限エラーが発生した場合
          if (excelError instanceof Error && excelError.message.includes('エクスポート件数が多すぎます')) {
            return NextResponse.json({ error: excelError.message }, { status: 413 })
          }
          throw excelError
        }
      default:
        return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
    }

  } catch (error) {
    console.error('Export API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

interface ExportData {
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
    throw new Error(`エクスポート件数が多すぎます（最大${MAX_EXPORT_SIZE}件まで）。条件を絞り込んでください。`)
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