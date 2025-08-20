import { NextRequest, NextResponse } from "next/server";

import {
  validateGetInvitationInfoQuery,
  createSuccessResponse,
  createErrorResponse
} from '@/core/dtos/user-invitations'
import { getRepositories } from '@/core/ports'
import { GetInvitationInfoUseCase } from '@/core/usecases/users/getInvitationInfo'
import { createClient } from "@/infra/supabase/serverClient";

/**
 * 招待情報取得API（リファクタリング済み）
 * DTO validate → usecase 呼び出し → HTTP 変換の薄い層
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryParams = Object.fromEntries(searchParams.entries())

    // DTOバリデーション
    const validationResult = validateGetInvitationInfoQuery(queryParams)
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

    const supabase = await createClient()
    
    // リポジトリコンテナの取得
    const repositories = await getRepositories(supabase)

    // ユースケース実行
    const getInvitationInfoUseCase = new GetInvitationInfoUseCase(repositories)
    const result = await getInvitationInfoUseCase.execute({
      token: validationResult.data.token
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
    return NextResponse.json(createSuccessResponse(result.data))

  } catch (error) {
    console.error("招待情報取得API エラー:", error)
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', '招待情報の取得に失敗しました'),
      { status: 500 }
    )
  }
}

/**
 * エラーコードからHTTPステータスコードを取得するヘルパー
 */
function getStatusCodeFromError(errorCode: string): number {
  switch (errorCode) {
    case 'VALIDATION_ERROR':
      return 400
    case 'NOT_FOUND_ERROR':
    case 'EXPIRED_ERROR':
    case 'ALREADY_ACCEPTED_ERROR':
      return 400
    case 'INTERNAL_ERROR':
      return 500
    default:
      return 500
  }
}
