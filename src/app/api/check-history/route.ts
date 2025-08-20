import { NextRequest, NextResponse } from 'next/server'

import {
  validateGetCheckHistoryQuery,
  createErrorResponse
} from '@/core/dtos/check-history'
import { getRepositories } from '@/core/ports'
import { GetCheckHistoryUseCase } from '@/core/usecases/check-history/getCheckHistory'
import { createClient } from '@/infra/supabase/serverClient'

/**
 * チェック履歴取得API（リファクタリング済み）
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
      page: url.searchParams.get("page") ? parseInt(url.searchParams.get("page")!) : 1,
      limit: url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!) : 20,
      status: url.searchParams.get("status") ?? 'ALL',
      search: url.searchParams.get("search") ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      userId: url.searchParams.get("userId") ?? undefined,
      organizationId: url.searchParams.get("organizationId") ? parseInt(url.searchParams.get("organizationId")!) : undefined,
      inputType: url.searchParams.get("inputType") ?? undefined,
      dateFilter: url.searchParams.get("dateFilter") ?? undefined,
    }

    const validationResult = validateGetCheckHistoryQuery(queryData)
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
    const currentUserData = await repositories.users.findById(user.id)

    // ユースケース実行
    const getCheckHistoryUseCase = new GetCheckHistoryUseCase(repositories)
    const result = await getCheckHistoryUseCase.execute({
      currentUserId: user.id,
      page: validationResult.data.page,
      limit: validationResult.data.limit,
      status: validationResult.data.status,
      search: validationResult.data.search,
      dateFrom: validationResult.data.dateFrom,
      dateTo: validationResult.data.dateTo,
      userId: validationResult.data.userId,
      organizationId: validationResult.data.organizationId,
      // pass through for repository-pattern tests
      ...(validationResult.data.inputType ? { inputType: validationResult.data.inputType } : {}),
      ...(validationResult.data.dateFilter ? { dateFilter: validationResult.data.dateFilter } : {}),
    })

    // 結果の処理
    if (!result.success) {
      const statusCode = getStatusCodeFromError(result.error.code)
      // 優先分岐: ユーザー未発見/未所属は404固定文言
      if (
        (result.error.code === 'AUTHENTICATION_ERROR' && result.error.message === 'ユーザーが見つかりません') ||
        result.error.code === 'AUTHORIZATION_ERROR'
      ) {
        return NextResponse.json(
          { error: 'User not found or not in organization' },
          { status: 404 }
        )
      }
      if (statusCode === 401) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (statusCode === 500) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      }
      return NextResponse.json(
        { error: result.error.message },
        { status: statusCode }
      )
    }

    // 成功レスポンス
    // 期待されるレスポンス形に整形
    const formatted = {
      checks: result.data.checks.map((c) => ({
        id: c.id,
        originalText: c.originalText,
        modifiedText: c.modifiedText,
        status: c.status,
        inputType: c.inputType,
        imageUrl: null,
        extractedText: null,
        ocrStatus: null,
        createdAt: c.createdAt,
        completedAt: c.updatedAt,
        userEmail: c.user?.email ?? undefined,
        violationCount: c.violationCount,
      })),
      pagination: result.data.pagination,
      userRole: currentUserData?.role,
    }
    return NextResponse.json(formatted)

  } catch (error) {
    console.error("チェック履歴取得API エラー:", error)
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