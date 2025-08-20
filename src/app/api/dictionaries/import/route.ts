import { NextRequest, NextResponse } from "next/server"

import {
  validateImportDictionariesRequest,
  createSuccessResponse,
  createErrorResponse
} from '@/core/dtos/dictionaries'
import { getRepositories } from '@/core/ports'
import { ImportDictionariesUseCase } from '@/core/usecases/dictionaries/importDictionaries'
import { createClient } from "@/infra/supabase/serverClient"

/**
 * 辞書インポートAPI（リファクタリング済み）
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

    // Content-Typeチェック
    const contentType = request.headers.get("content-type") ?? ""
    if (!contentType.includes("text/csv")) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Content-Typeはtext/csvである必要があります'),
        { status: 400 }
      )
    }

    // CSVコンテンツの取得
    let csvContent: string
    try {
      csvContent = await request.text()
    } catch {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'CSV本文の読み取りに失敗しました'),
        { status: 400 }
      )
    }

    if (!csvContent) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'CSV本文が必要です'),
        { status: 400 }
      )
    }

    // DTOバリデーション（空のオブジェクトでOK、実際のバリデーションはUserCase内）
    const validationResult = validateImportDictionariesRequest({})
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
    const importDictionariesUseCase = new ImportDictionariesUseCase(repositories)
    const result = await importDictionariesUseCase.execute({
      currentUserId: user.id,
      csvContent,
      contentType
    })

    // 結果の処理
    if (!result.success) {
      const statusCode = getStatusCodeFromError(result.error.code)
      return NextResponse.json(
        createErrorResponse(result.error.code, result.error.message, result.error.details),
        { status: statusCode }
      )
    }

    // 成功レスポンス
    return NextResponse.json(
      createSuccessResponse(result.data)
    )

  } catch (error) {
    console.error("辞書インポートAPI エラー:", error)
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


