import { NextRequest, NextResponse } from 'next/server'

import {
  validateGetAdminPerformanceQuery,
  createErrorResponse
} from '@/core/dtos/admin'
import { getRepositories } from '@/core/ports'
import { GetAdminPerformanceUseCase } from '@/core/usecases/admin/getPerformance'
import { createClient } from '@/infra/supabase/serverClient'

/**
 * Admin パフォーマンス取得API（リファクタリング済み）
 * DTO validate → usecase 呼び出し → HTTP 変換の薄い層
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // クエリパラメータの取得とバリデーション
    const url = request.nextUrl
    const queryData = {
      period: url.searchParams.get("period") ?? 'day',
      limit: url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!) : 10,
      organizationId: url.searchParams.get("organizationId") ? parseInt(url.searchParams.get("organizationId")!) : undefined
    }

    const validationResult = validateGetAdminPerformanceQuery(queryData)
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
    const getAdminPerformanceUseCase = new GetAdminPerformanceUseCase(repositories)
    const result = await getAdminPerformanceUseCase.execute({
      currentUserId: user.id,
      period: validationResult.data.period,
      limit: validationResult.data.limit,
      organizationId: validationResult.data.organizationId
    })

    // 結果の処理
    if (!result.success) {
      const statusCode = getStatusCodeFromError(result.error.code)
      if (statusCode === 401) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (statusCode === 403) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (statusCode === 500) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      }
      return NextResponse.json(
        { error: result.error.message },
        { status: statusCode }
      )
    }

    // 成功レスポンスを返す
    return NextResponse.json(result.data)

  } catch (error) {
    console.error("Admin パフォーマンス取得API エラー:", error)
    return NextResponse.json(
      { error: 'Internal server error' },
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