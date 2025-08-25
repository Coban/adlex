import { NextRequest, NextResponse } from 'next/server'

import {
  validateGenerateCustomReportRequest,
  createErrorResponse
} from '@/core/dtos/reports'
import { getRepositories } from '@/core/ports'
import { GenerateCustomReportUseCase } from '@/core/usecases/reports/generateCustomReport'
import { createClient } from '@/infra/supabase/serverClient'

/**
 * カスタムレポート生成API（リファクタリング済み）
 * DTO validate → usecase 呼び出し → HTTP 変換の薄い層
 */
export async function POST(request: NextRequest) {
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

    // リクエストボディの取得と基本バリデーション
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid JSON in request body'),
        { status: 400 }
      )
    }

    // DTOバリデーション
    const validationResult = validateGenerateCustomReportRequest(body)
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
    const generateCustomReportUseCase = new GenerateCustomReportUseCase(repositories)
    const result = await generateCustomReportUseCase.execute({
      currentUserId: user.id,
      checkIds: validationResult.data.checkIds,
      format: validationResult.data.format,
      template: validationResult.data.template,
      includeStats: validationResult.data.includeStats,
      includeSummary: validationResult.data.includeSummary,
      includeDetails: validationResult.data.includeDetails,
      title: validationResult.data.title
    })

    // 結果の処理
    if (!result.success) {
      const statusCode = getStatusCodeFromError(result.error.code)
      return NextResponse.json(
        createErrorResponse(result.error.code, result.error.message),
        { status: statusCode }
      )
    }

    // 成功レスポンス（バイナリファイル）
    return new NextResponse(result.data.buffer as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': result.data.contentType,
        'Content-Disposition': `attachment; filename="${result.data.filename}"`,
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error("カスタムレポート生成API エラー:", error)
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

