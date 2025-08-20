import { NextRequest, NextResponse } from "next/server"

import {
  createDictionaryStatsSuccessResponse,
  createDictionaryStatsErrorResponse
} from '@/core/dtos/dictionary-stats'
import { getRepositories } from "@/core/ports"
import { GetDictionaryStatsUseCase } from '@/core/usecases/dictionaries/getDictionaryStats'
import { createClient } from "@/infra/supabase/serverClient"

/**
 * 辞書統計取得API（リファクタリング済み）
 * DTO validate → usecase 呼び出し → HTTP 変換の薄い層
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()

    // ユーザーの認証確認
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        createDictionaryStatsErrorResponse('AUTH_ERROR', '認証が必要です'),
        { status: 401 }
      )
    }

    // リポジトリコンテナの取得
    const repositories = await getRepositories(supabase)

    // ユースケース実行
    const getDictionaryStatsUseCase = new GetDictionaryStatsUseCase(repositories)
    const result = await getDictionaryStatsUseCase.execute({
      userId: user.id
    })

    // 結果の処理
    if (!result.success) {
      const statusCode = getStatusCodeFromError(result.error.code)
      return NextResponse.json(
        createDictionaryStatsErrorResponse(result.error.code, result.error.message),
        { status: statusCode }
      )
    }

    // 成功レスポンス
    return NextResponse.json(createDictionaryStatsSuccessResponse(result.data))

  } catch (e) {
    console.error("辞書統計APIエラー:", e)
    return NextResponse.json(
      createDictionaryStatsErrorResponse('INTERNAL_ERROR', 'サーバーエラーが発生しました'),
      { status: 500 }
    )
  }
}

/**
 * エラーコードからHTTPステータスコードを取得するヘルパー
 */
function getStatusCodeFromError(errorCode: string): number {
  switch (errorCode) {
    case 'AUTH_ERROR':
      return 401
    case 'FORBIDDEN_ERROR':
      return 403
    case 'NOT_FOUND_ERROR':
      return 404
    case 'INTERNAL_ERROR':
      return 500
    default:
      return 500
  }
}


