import { NextRequest, NextResponse } from "next/server"

import {
  validateExportDictionariesQuery,
  createErrorResponse
} from '@/core/dtos/dictionaries'
import { getRepositories } from "@/core/ports"
import { ExportDictionariesUseCase } from '@/core/usecases/dictionaries/exportDictionaries'
import { createClient } from "@/infra/supabase/serverClient"

/**
 * 辞書エクスポートAPI（リファクタリング済み）
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
    const url = new URL(request.url)
    const queryParams = {
      format: url.searchParams.get('format') ?? 'csv'
    }

    const validationResult = validateExportDictionariesQuery(queryParams)
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
    const exportDictionariesUseCase = new ExportDictionariesUseCase(repositories)
    const result = await exportDictionariesUseCase.execute({
      currentUserId: user.id,
      format: validationResult.data.format
    })

    // 結果の処理
    if (!result.success) {
      const statusCode = getStatusCodeFromError(result.error.code)
      return NextResponse.json(
        createErrorResponse(result.error.code, result.error.message),
        { status: statusCode }
      )
    }

    // 成功レスポンス（ファイルダウンロード）
    return new NextResponse(result.data.content, {
      status: 200,
      headers: {
        'Content-Type': result.data.contentType,
        'Content-Disposition': `attachment; filename="${result.data.filename}"`,
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error("辞書エクスポートAPI エラー:", error)
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


