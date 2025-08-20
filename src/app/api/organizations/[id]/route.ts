import { NextRequest, NextResponse } from 'next/server'

import {
  validateGetOrganizationParams,
  validateUpdateOrganizationRequest,
  createSuccessResponse,
  createErrorResponse
} from '@/core/dtos/organizations'
import { getRepositories } from '@/core/ports'
import { GetOrganizationUseCase } from '@/core/usecases/organizations/getOrganization'
import { UpdateOrganizationUseCase } from '@/core/usecases/organizations/updateOrganization'
import { createClient } from '@/infra/supabase/serverClient'

/**
 * 組織更新API（リファクタリング済み）
 * DTO validate → usecase 呼び出し → HTTP 変換の薄い層
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // パスパラメータのバリデーション
    const { id } = await params
    const paramsValidation = validateGetOrganizationParams({ id })
    if (!paramsValidation.success) {
      return NextResponse.json(
        createErrorResponse(
          paramsValidation.error.code,
          paramsValidation.error.message,
          paramsValidation.error.details
        ),
        { status: 400 }
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
    const validationResult = validateUpdateOrganizationRequest(body)
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
    const updateOrganizationUseCase = new UpdateOrganizationUseCase(repositories)
    const result = await updateOrganizationUseCase.execute({
      currentUserId: user.id,
      organizationId: paramsValidation.data.id,
      updates: {
        name: validationResult.data.name,
        plan: validationResult.data.plan,
        max_users: validationResult.data.max_users,
        max_checks_per_month: validationResult.data.max_checks_per_month
      }
    })

    // 結果の処理
    if (!result.success) {
      const statusCode = getStatusCodeFromError(result.error.code)
      return NextResponse.json(
        createErrorResponse(result.error.code, result.error.message),
        { status: statusCode }
      )
    }

    // 成功レスポンス
    return NextResponse.json(
      createSuccessResponse(result.data)
    )

  } catch (error) {
    console.error("組織更新API エラー:", error)
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', 'サーバーエラーが発生しました'),
      { status: 500 }
    )
  }
}

/**
 * 組織取得API（リファクタリング済み）
 * DTO validate → usecase 呼び出し → HTTP 変換の薄い層
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // パスパラメータのバリデーション
    const { id } = await params
    const paramsValidation = validateGetOrganizationParams({ id })
    if (!paramsValidation.success) {
      return NextResponse.json(
        createErrorResponse(
          paramsValidation.error.code,
          paramsValidation.error.message,
          paramsValidation.error.details
        ),
        { status: 400 }
      )
    }

    // リポジトリコンテナの取得
    const repositories = await getRepositories(supabase)

    // ユースケース実行
    const getOrganizationUseCase = new GetOrganizationUseCase(repositories)
    const result = await getOrganizationUseCase.execute({
      currentUserId: user.id,
      organizationId: paramsValidation.data.id
    })

    // 結果の処理
    if (!result.success) {
      const statusCode = getStatusCodeFromError(result.error.code)
      return NextResponse.json(
        createErrorResponse(result.error.code, result.error.message),
        { status: statusCode }
      )
    }

    // 成功レスポンス
    return NextResponse.json(
      createSuccessResponse(result.data)
    )

  } catch (error) {
    console.error("組織取得API エラー:", error)
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