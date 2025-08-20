import { NextRequest, NextResponse } from 'next/server'

import {
  validateUpdateUserRoleParams,
  validateUpdateUserRoleRequest,
  createSuccessResponse,
  createErrorResponse
} from '@/core/dtos/users'
import { getRepositories } from '@/core/ports'
import { UpdateUserRoleUseCase } from '@/core/usecases/users/updateUserRole'
import { createClient } from '@/infra/supabase/serverClient'

/**
 * ユーザー役割更新API（リファクタリング済み）
 * DTO validate → usecase 呼び出し → HTTP 変換の薄い層
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
    const paramsValidation = validateUpdateUserRoleParams({ id })
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
    const validationResult = validateUpdateUserRoleRequest(body)
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
    const updateUserRoleUseCase = new UpdateUserRoleUseCase(repositories)
    const result = await updateUserRoleUseCase.execute({
      currentUserId: user.id,
      targetUserId: paramsValidation.data.id,
      role: validationResult.data.role
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
    console.error("ユーザー役割更新API エラー:", error)
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
